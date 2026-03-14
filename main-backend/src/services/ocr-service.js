const { GoogleGenerativeAI } = require('@google/generative-ai');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const OcrJob = require('../models/OcrJob');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const SubjectService = require('./subject-service');
const WeeklySessionService = require('./weekly-session-service');
const { GEMINI_API_KEY } = require('../config/server-config');
const mongoose = require('mongoose');
const axios = require('axios');
const ocrQueue = require('../config/ocr-queue');

// Initialize Gemini AI with API key from config
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not configured in environment variables');
  throw new Error('GEMINI_API_KEY is required but not found in configuration');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 🚀 Queue OCR Job (Non-blocking - returns immediately)
 * This is the Step 1 (Submission) from your architecture.
 */
async function queueOCRImage(userId, imageUrl, batchId, sectionId) {
  try {
    // Validate image URL
    if (!imageUrl || !imageUrl.startsWith('http')) {
      throw new AppError('Invalid image URL provided', StatusCodes.BAD_REQUEST);
    }

    // Convert Google Drive View links to Direct Download links
    if (imageUrl.includes('drive.google.com') && imageUrl.includes('/view')) {
      const fileIdMatch = imageUrl.match(/\/d\/(.+?)\//);
      if (fileIdMatch && fileIdMatch[1]) {
        imageUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    }

    // Validate batch and section
    const batch = await Batch.findById(batchId);
    if (!batch) throw new AppError('Batch not found', StatusCodes.NOT_FOUND);

    const section = await Section.findById(sectionId);
    if (!section) throw new AppError('Section not found', StatusCodes.NOT_FOUND);

    // Create OCR job record (Job Table)
    const job = await OcrJob.create({ 
      userId, 
      batch: batchId,
      section: sectionId,
      fileUrl: imageUrl, 
      status: 'queued' 
    });

    // Step 2: Add to Bull queue (Task Queue)
    // This triggers the background worker without blocking the current request
    const queueJob = await ocrQueue.add(
      'process-timetable',
      {
        ocrJobId: job._id.toString(),
        userId,
        imageUrl,
        batchId,
        sectionId
      },
      {
        jobId: job._id.toString(), // Connect Bull Job ID with our DB Job ID
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );

    console.log(`📋 OCR Job ${job._id} successfully added to background queue.`);

    return {
      jobId: job._id,
      status: job.status,
      message: 'Timetable image queued for background processing'
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || 'Failed to queue OCR job', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 🤖 Process OCR Image (The Heavy Lifting)
 * This is Step 2 (Background Processing) from your architecture.
 * This function is called by the background worker (ocrJob.js).
 */
async function processOCRImage(ocrJobId, userId, imageUrl, batchId, sectionId, queueJob) {
  let job = await OcrJob.findById(ocrJobId);
  if (!job) throw new Error('OCR Job not found in database');

  try {
    // Update Job status to Processing
    job.status = 'processing';
    job.startedAt = new Date();
    await job.save();

    if (queueJob) await queueJob.progress(10);

    // 1. Download image
    console.log('📥 Worker downloading image from:', imageUrl);
    let imageBuffer;
    let mimeType = 'image/jpeg'; // Default
    try {
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      imageBuffer = Buffer.from(response.data);
      mimeType = response.headers['content-type'] || 'image/jpeg';
      console.log('✅ Image downloaded successfully.');
    } catch (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    if (queueJob) await queueJob.progress(30);

    // 2. Prepare Detailed Gemini Prompt
    const prompt = `
You are a university timetable digitization expert. Analyze the uploaded image and extract the FULL timetable exactly as it appears.

CRITICAL RULES:
1. Extract EVERY single class, lab, or tutorial.
2. Convert all time into 24-hour format (e.g., "13:30").
3. Map days as: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
4. Detect type: "Lab", "Lecture", "Tutorial", "Practical".

OUTPUT FORMAT:
Return ONLY valid JSON. Use this structure:
{
  "schedule": [
    {
      "day": "Monday",
      "startTime": "10:30",
      "endTime": "11:25",
      "subject": "Digital Signal Processing",
      "teacher": "Dr. Rashmi Panda",
      "room": "B-403",
      "type": "Lecture"
    }
  ]
}
`;

    if (queueJob) await queueJob.progress(40);

    // 3. Call AI Engine (Slow Part)
    const model = genAI.getGenerativeModel({ model: 'gemini-robotics-er-1.5-preview' });
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const aiResult = await model.generateContent([prompt, imagePart]);
    const responseText = aiResult.response.text();
    
    if (queueJob) await queueJob.progress(75);

    // 4. Parse AI Response
    let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*"schedule"[\s\S]*\}/);
    if (jsonMatch) cleanedText = jsonMatch[0];
    const jsonData = JSON.parse(cleanedText);

    if (queueJob) await queueJob.progress(90);

    // 5. Save Results to Database
    job.status = 'completed';
    job.parsedTimetable = { schedule: jsonData.schedule };
    job.completedAt = new Date();
    await job.save();

    if (queueJob) await queueJob.progress(100);
    console.log(`✅ OCR Background processing completed for Job ${ocrJobId}`);

    return { jobId: job._id, totalClasses: jsonData.schedule.length };

  } catch (error) {
    console.error(`❌ Worker Error for Job ${ocrJobId}:`, error.message);
    
    // Step 2 CRITICAL: If worker fails, mark row as failed in DB
    job.status = 'failed';
    job.error = error.message;
    await job.save();
    
    throw error; // Re-throw for Bull backoff logic
  }
}

/**
 * 🛰️ Get OCR Job Status
 * This is Step 3 (Polling) from your architecture.
 */
async function getOCRJobStatus(jobId, userId) {
  try {
    const job = await OcrJob.findById(jobId)
      .populate('batch', 'program year')
      .populate('section', 'name');

    if (!job) throw new AppError('Job not found', StatusCodes.NOT_FOUND);
    if (job.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized', StatusCodes.FORBIDDEN);
    }

    return job; // Includes status, result_data, or error
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching status', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Confirm and save the finalized timetable (Handled after polling is complete)
 */
async function createTimetableFromOCR(jobId, userId, confirmedSchedule) {
    const job = await OcrJob.findById(jobId);
    if (!job || job.status !== 'completed') throw new AppError('Valid completed job required', 400);

    const schedule = confirmedSchedule || job.parsedTimetable.schedule;
    
    // Find or Create Timetable
    let timetable = await Timetable.findOne({ batch: job.batch, section: job.section });
    if (timetable) {
        timetable.schedule = schedule;
        await timetable.save();
    } else {
        timetable = await Timetable.create({
            batch: job.batch,
            section: job.section,
            schedule: schedule,
            isActive: true
        });
    }

    // Auto-create subjects
    await SubjectService.createSubjectsFromTimetable(timetable._id);

    // 🚀 NEW: Generate sessions for the current week immediately
    // This solves the issue where "nothing reflects" after creation
    try {
        console.log(`🔄 Expanding timetable into weekly sessions for batch ${job.batch}...`);
        await WeeklySessionService.generateForWeek(new Date());
        
        // Invalidate cache so users see the new classes immediately
        await WeeklySessionService.invalidateDashboardCache(job.batch, job.section);
    } catch (sessionError) {
        console.error('⚠️ Failed to auto-generate weekly sessions:', sessionError.message);
    }
    
    // Cleanup the job record after success
    await OcrJob.findByIdAndDelete(jobId);

    return timetable;
}

async function getUserOCRJobs(userId, filters = {}) {
    return await OcrJob.find({ userId, ...filters }).sort({ createdAt: -1 }).limit(20);
}

async function retryOCRJob(jobId, userId) {
    const job = await OcrJob.findById(jobId);
    if (!job || job.status !== 'failed') throw new AppError('Job not found or not failed', 400);
    
    // Reset and re-queue
    return await queueOCRImage(userId, job.fileUrl, job.batch, job.section);
}

module.exports = {
  queueOCRImage,
  processOCRImage,
  getOCRJobStatus,
  getUserOCRJobs,
  retryOCRJob,
  createTimetableFromOCR
};