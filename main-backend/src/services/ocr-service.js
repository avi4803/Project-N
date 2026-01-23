const { GoogleGenerativeAI } = require('@google/generative-ai');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const OcrJob = require('../models/OcrJob');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const SubjectService = require('./subject-service');
const { GEMINI_API_KEY } = require('../config/server-config');
const mongoose = require('mongoose');
const axios = require('axios');



// Initialize Gemini AI with API key from config
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not configured in environment variables');
  throw new Error('GEMINI_API_KEY is required but not found in configuration');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Process OCR image and extract timetable
async function processOCRImage(userId, imageUrl, batchId, sectionId) {
  let job = null;

  try {
    // Validate image URL
    if (!imageUrl || !imageUrl.startsWith('http')) {
      throw new AppError('Invalid image URL provided', StatusCodes.BAD_REQUEST);
    }

    // Convert Google Drive View links to Direct Download links
    if (imageUrl.includes('drive.google.com') && imageUrl.includes('/view')) {
      const fileIdMatch = imageUrl.match(/\/d\/(.+?)\//);
      if (fileIdMatch && fileIdMatch[1]) {
        console.log('🔄 Converting Google Drive view link to direct download link...');
        imageUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    }

    // Validate batch and section
    const batch = await Batch.findById(batchId);
    if (!batch) {
      throw new AppError('Batch not found', StatusCodes.NOT_FOUND);
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      throw new AppError('Section not found', StatusCodes.NOT_FOUND);
    }

    // Create OCR job
    job = await OcrJob.create({ 
      userId, 
      batch: batchId,
      section: sectionId,
      fileUrl: imageUrl, 
      status: 'queued' 
    });

    // Update job status to processing
    job.status = 'processing';
    job.startedAt = new Date();
    await job.save();

    // Download image from URL
    console.log('📥 Downloading image from:', imageUrl);
    let imageBuffer;
    let responseHeaders; // Capture headers for MIME detection
    try {
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      imageBuffer = Buffer.from(response.data);
      responseHeaders = response.headers;
      console.log('✅ Image downloaded successfully, size:', imageBuffer.length, 'bytes');
    } catch (downloadError) {
      console.error('❌ Image download failed:', downloadError.message);
      throw new AppError(
        'Failed to download image from URL. Please check the URL is accessible.',
        StatusCodes.BAD_REQUEST
      );
    }

    // Detect image MIME type from headers or fallback to extension
    let mimeType = (responseHeaders && responseHeaders['content-type']) || 'image/jpeg';
    
    // Validate MIME type
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validMimeTypes.includes(mimeType)) {
        console.warn(`⚠️ Warning: Content-Type ${mimeType} might not be supported. Defaulting to image/jpeg if problematic.`);
        // Fallback logic for common misconfigurations
        if (imageUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (imageUrl.toLowerCase().endsWith('.jpg') || imageUrl.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
    }

    console.log(`📷 Detected MIME Type: ${mimeType}`);

    console.log('🤖 Initializing Gemini AI model...');
    
    // Detailed prompt for timetable extraction
    const prompt = `
You are a university timetable digitization expert.

Analyze the uploaded timetable image and extract the COMPLETE class schedule with 100% accuracy.

The image may contain:
• rotated pages
• merged table cells
• multiple rows per day
• labs spanning multiple time slots
• electives and grouped courses
• teacher and room information in separate tables

Your task is to reconstruct the FULL timetable exactly as it appears.

────────────────────────
CRITICAL RULES
────────────────────────

1. Extract **EVERY single class, lab, practical, or tutorial** shown in the timetable grid  
2. If a class spans multiple time blocks, **merge them into one entry**
3. Convert all time into **24-hour format** (e.g., "13:30", "16:45")
4. Map days strictly as:
   Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
5. If teacher or room is missing, use empty string ""
6. Detect class type using:
   • "Lab" → if LAB / practical / multi-hour session
   • "Lecture" → normal theory class
   • "Tutorial" → tutorial slot
   • "Practical" → hands-on non-lab session
7. If multiple sections or electives appear (like OE, EC-3106, etc), preserve them exactly
8. Subjects must be written in **full form** if visible anywhere on the page  
   (e.g., EC-3106 → Digital Signal Processing)

────────────────────────
OUTPUT FORMAT (STRICT)
────────────────────────

Return ONLY valid JSON.
No explanation. No markdown. No comments.

Use this exact structure:

{
  "college": "",
  "department": "",
  "semester": "",
  "section": "",
  "classroom": "",
  "schedule": [
    {
      "day": "Monday",
      "startTime": "10:30",
      "endTime": "11:25",
      "subjectCode": "EC-3006",
      "subject": "Digital Signal Processing",
      "teacher": "Dr. Rashmi Panda",
      "room": "B-403",
      "type": "Lecture"
    },
    {
      "day": "Tuesday",
      "startTime": "11:30",
      "endTime": "1:30",
      "subjectCode": "EC-3106",
      "subject": "Digital Signal Processing Lab(G2)",
      "teacher": "Dr. Rashmi Panda,Nishit Malviya",
      "room": "B-403",
      "type": "Lab"
    }
  ]
}

────────────────────────
ADVANCED EXTRACTION RULES
────────────────────────

• If a subject code appears multiple times, map it to the correct subject name using the course list table  
• If a teacher is listed separately, map it to the correct subject  
• If a lab appears as "EC-3106 / EC-3104 (G1, G2)", create **separate entries** for each group and include group name in the entry
• If a class appears in two columns, merge them into one entry combining the time slots 
• If break is shown, IGNORE it  
• If a time slot is empty, skip it  
• Do NOT guess — leave unknown fields empty ""

────────────────────────

Extract the complete timetable now.
Return ONLY the JSON.

`;

    // Prepare image part
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType
      }
    };

    // Try multiple models in order of preference
    const modelsToTry = [
      'gemini-robotics-er-1.5-preview'
    ];

    let result = null;
    let modelUsed = null;
    let lastError = null;

    // Try each model until one works
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔍 Trying model: ${modelName}...`);
        
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // ✅ REMOVED THE TEST CALL - Directly try with image
        // For gemini-pro-vision, use different structure
        if (modelName === 'gemini-pro-vision') {
          result = await model.generateContent([prompt, imagePart]);
        } else {
          // For newer models
          result = await model.generateContent([prompt, imagePart]);
        }
        
        modelUsed = modelName;
        console.log(`✅ Successfully used model: ${modelName}`);
        break;
        
      } catch (error) {
        lastError = error;
        console.log(`❌ Model ${modelName} failed: ${error.message}`);
        
        // If it's an auth error, stop trying other models
        if (error.status === 401 || error.status === 403) {
          throw new AppError(
            'Gemini API authentication failed. Please verify your API key is valid.',
            StatusCodes.UNAUTHORIZED
          );
        }

        // If rate limit, log specific warning
        if (error.status === 429) {
             console.warn(`⚠️ Rate limit hit for model ${modelName}. Trying next model...`);
        }
        
        // Continue to next model
        continue;
      }
    }

    // If no model worked, throw error
    if (!result || !modelUsed) {
      console.error('❌ All models failed. Last error:', lastError?.message);
      
      // Handle Rate Limits specifically
      if (lastError && (lastError.status === 429 || (lastError.message && lastError.message.includes('429')))) {
          throw new AppError(
             'Gemini API rate limit exceeded. Please try again later.',
             StatusCodes.TOO_MANY_REQUESTS
           );
      }

      throw new AppError(
        'Unable to access Gemini vision models. Please verify your API key or try again later.',
        StatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const responseText = result.response.text();
    console.log('📝 Extracted text from Gemini (first 500 chars):', responseText.substring(0, 500) + '...');

    // Save extracted text
    job.extractedText = responseText;
    await job.save();

    // Parse JSON response
    let jsonData;
    try {
      // Remove markdown code blocks if present
      let cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedText.match(/\{[\s\S]*"schedule"[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      jsonData = JSON.parse(cleanedText);
      console.log('✅ JSON parsed successfully, found', jsonData.schedule?.length || 0, 'classes');
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('Raw response:', responseText);
      
      // Try to fix common JSON issues
      try {
        // Remove any non-JSON text before/after
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const extractedJson = responseText.substring(jsonStart, jsonEnd);
          jsonData = JSON.parse(extractedJson);
          console.log('✅ JSON extracted and parsed after cleanup');
        } else {
          throw parseError;
        }
      } catch (retryError) {
        throw new AppError(
          'Failed to parse Gemini response as JSON. The image may not contain a clear timetable. Please try with a clearer image.',
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Validate parsed data structure
    if (!jsonData.schedule || !Array.isArray(jsonData.schedule)) {
      throw new AppError(
        'Invalid timetable format extracted. Missing schedule array.',
        StatusCodes.BAD_REQUEST
      );
    }

    if (jsonData.schedule.length === 0) {
      throw new AppError(
        'No classes found in the timetable image. Please upload a clearer image.',
        StatusCodes.BAD_REQUEST
      );
    }

    // Validate each schedule item
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const validTypes = ['Lecture', 'Lab', 'Tutorial', 'Practical'];

    for (let i = 0; i < jsonData.schedule.length; i++) {
      const item = jsonData.schedule[i];
      
      if (!item.day || !validDays.includes(item.day)) {
        console.warn(`⚠️ Invalid day at index ${i}:`, item.day);
        // Try to capitalize first letter
        if (item.day && typeof item.day === 'string') {
          item.day = item.day.charAt(0).toUpperCase() + item.day.slice(1).toLowerCase();
          if (!validDays.includes(item.day)) {
            throw new AppError(`Invalid day: ${item.day}`, StatusCodes.BAD_REQUEST);
          }
        } else {
          throw new AppError(`Invalid day at index ${i}`, StatusCodes.BAD_REQUEST);
        }
      }
      
      if (!item.startTime || !item.endTime || !item.subject) {
        console.warn(`⚠️ Missing required fields at index ${i}:`, item);
        throw new AppError(
          `Class at index ${i} is missing required fields (day, startTime, endTime, or subject)`,
          StatusCodes.BAD_REQUEST
        );
      }
      
      // Set default type if missing or invalid
      if (!item.type || !validTypes.includes(item.type)) {
        item.type = 'Lecture';
      }
      
      // Ensure teacher and room are strings
      item.teacher = item.teacher || '';
      item.room = item.room || '';
    }

    // Update job with parsed data
    job.status = 'completed';
    job.parsedTimetable = {
      schedule: jsonData.schedule, // This should be an array
      validFrom: jsonData.validFrom || null,
      validTo: jsonData.validTo || null
    };
    job.completedAt = new Date();
    
    // Save the job
    await job.save();

    console.log('✅ OCR job completed successfully:', job._id);

    console.log('✅ OCR job completed successfully:', job._id);

    // 🛑 AUTO-CREATION DISABLED via User Request. Waiting for frontend confirmation.
    // The data is saved in job.parsedTimetable and returned to frontend.
    let createdTimetable = null;

    /* 
    // PREVIOUS LOGIC (Commented out)
    try {
      console.log('🔄 Auto-creating timetable from OCR results...');
      // ... (Code removed/skipped for approval flow) ...
    } catch (timetableError) { ... }
    */

    // Populate job details before returning
    await job.populate([
      { path: 'userId', select: 'name email' },
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);

    return {
      jobId: job._id,
      status: job.status,
      parsedTimetable: jsonData,
      batch: job.batch,
      section: job.section,
      totalClasses: jsonData.schedule.length,
      modelUsed: modelUsed,
      timetableCreated: false, // Changed to false
      timetableId: null,
      timetable: null,
      message: "OCR processing complete. Please review and confirm the timetable data."
    };

  } catch (error) {
    console.error('❌ OCR Processing Error:', error.message);

    // CLEANUP: Delete failed job
    if (job) {
      await OcrJob.findByIdAndDelete(job._id);
      console.log(`🗑️ OCR Job ${job._id} deleted due to processing failure.`);
    }

    // Throw appropriate error
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      error.message || 'Failed to process timetable image. Please ensure the image is clear and try again.',
      error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

// Create (Confirm) timetable from OCR job
async function createTimetableFromOCR(jobId, userId, confirmedSchedule = null) {
  try {
    const job = await OcrJob.findById(jobId);
      
    if (!job) {
      throw new AppError('OCR job not found', StatusCodes.NOT_FOUND);
    }

    if (job.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized to access this job', StatusCodes.FORBIDDEN);
    }

    if (job.status !== 'completed') {
      throw new AppError(
        `Cannot create timetable. Job status is: ${job.status}`,
        StatusCodes.BAD_REQUEST
      );
    }
    
    // If confirmed schedule is provided, update the job
    let finalSchedule = job.parsedTimetable.schedule;
    if (confirmedSchedule && Array.isArray(confirmedSchedule)) {
        console.log('📝 Received confirmed schedule from frontend. Updating job...');
        finalSchedule = confirmedSchedule;
        
        job.parsedTimetable.schedule = confirmedSchedule;
        job.parsedTimetable.isConfirmed = true; // Flag to mark as user-confirmed
        await job.save();
    }

    // Get college from batch (needed for subjects)
    const batchWithCollege = await Batch.findById(job.batch).select('college');
    const collegeId = batchWithCollege?.college;

    if (!collegeId) {
        throw new AppError('Batch does not have an associated college', StatusCodes.BAD_REQUEST);
    }

    let savedTimetable;

    const existingTimetable = await Timetable.findOne({
      batch: job.batch,
      section: job.section
    });

    if (existingTimetable) {
        console.log('⚠️ Timetable already exists. Updating with confirmed data...');
        existingTimetable.schedule = finalSchedule;
        existingTimetable.validFrom = new Date(); // Reset validity
        existingTimetable.lastUpdated = new Date();
        existingTimetable.isActive = true;
        existingTimetable.college = collegeId;
        
        await existingTimetable.save();
        savedTimetable = existingTimetable;
    } else {
        console.log('✅ Creating new timetable from confirmed data...');
        savedTimetable = new Timetable({
            batch: job.batch,
            section: job.section,
            college: collegeId,
            schedule: finalSchedule,
            validFrom: new Date(),
            isActive: true
        });
        await savedTimetable.save();
    }

    await savedTimetable.populate([
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);

    // ✅ AUTO-CREATE SUBJECTS from confirmed timetable
    console.log('🔄 Creating/updating subjects from confirmed timetable...');
    const subjectResult = await SubjectService.createSubjectsFromTimetable(savedTimetable._id);
        
    console.log(`✅ Subjects processed:
          - Created: ${subjectResult.created.length}
          - Updated: ${subjectResult.updated.length}
          - Failed: ${subjectResult.errors.length}
    `);

    // CLEANUP: Delete the completed OCR job
    await OcrJob.findByIdAndDelete(jobId);
    console.log(`🗑️ OCR Job ${jobId} deleted from database as it is completed.`);

    return {
        timetable: savedTimetable,
        subjectStats: subjectResult
    };

  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Create Timetable Error:', error);
    throw new AppError('Error creating timetable from OCR', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get OCR job status
async function getOCRJobStatus(jobId, userId) {
  try {
    const job = await OcrJob.findById(jobId)
      .populate('userId', 'name email')
      .populate('batch', 'program year')
      .populate('section', 'name');

    if (!job) {
      throw new AppError('OCR job not found', StatusCodes.NOT_FOUND);
    }

    if (job.userId._id.toString() !== userId.toString()) {
      throw new AppError('Unauthorized to access this job', StatusCodes.FORBIDDEN);
    }

    return job;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching OCR job status', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get all OCR jobs for a user
async function getUserOCRJobs(userId, filters = {}) {
  try {
    const query = { userId, ...filters };
    const jobs = await OcrJob.find(query)
      .populate('batch', 'program year')
      .populate('section', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    return jobs;
  } catch (error) {
    throw new AppError('Error fetching user OCR jobs', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Retry failed OCR job
async function retryOCRJob(jobId, userId) {
  try {
    const job = await OcrJob.findById(jobId);

    if (!job) {
      throw new AppError('OCR job not found', StatusCodes.NOT_FOUND);
    }

    if (job.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized to retry this job', StatusCodes.FORBIDDEN);
    }

    if (job.status !== 'failed') {
      throw new AppError('Can only retry failed jobs', StatusCodes.BAD_REQUEST);
    }

    if (job.retryCount >= job.maxRetries) {
      throw new AppError('Maximum retry attempts exceeded', StatusCodes.BAD_REQUEST);
    }

    return await processOCRImage(userId, job.fileUrl, job.batch, job.section);

  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrying OCR job', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  processOCRImage,
  createTimetableFromOCR,
  getOCRJobStatus,
  getUserOCRJobs,
  retryOCRJob
};


// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const { StatusCodes } = require('http-status-codes');
// const AppError = require('../utils/errors/app-error');
// const OcrJob = require('../models/OcrJob');
// const Timetable = require('../models/Timetable');
// const Batch = require('../models/Batch');
// const Section = require('../models/Section');
// const { GEMINI_API_KEY } = require('../config/server-config');
// const axios = require('axios');
// const ocrQueue = require('../config/ocr-queue');

// if (!GEMINI_API_KEY) {
//   console.error('❌ GEMINI_API_KEY is not configured');
//   throw new Error('GEMINI_API_KEY is required');
// }

// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// // ✅ Queue OCR job (Non-blocking - returns immediately)
// async function queueOCRImage(userId, imageUrl, batchId, sectionId) {
//   try {
//     // Validate inputs
//     if (!imageUrl || !imageUrl.startsWith('http')) {
//       throw new AppError('Invalid image URL provided', StatusCodes.BAD_REQUEST);
//     }

//     // Validate batch and section exist
//     const batch = await Batch.findById(batchId);
//     if (!batch) {
//       throw new AppError('Batch not found', StatusCodes.NOT_FOUND);
//     }

//     const section = await Section.findById(sectionId);
//     if (!section) {
//       throw new AppError('Section not found', StatusCodes.NOT_FOUND);
//     }

//     // Check for existing processing/queued job
//     const existingJob = await OcrJob.findOne({
//       batch: batchId,
//       section: sectionId,
//       status: { $in: ['queued', 'processing'] }
//     });

//     if (existingJob) {
//       await existingJob.populate([
//         { path: 'userId', select: 'name email' },
//         { path: 'batch', select: 'program year' },
//         { path: 'section', select: 'name' }
//       ]);

//       return {
//         jobId: existingJob._id,
//         status: existingJob.status,
//         message: 'Job already in queue or processing',
//         isExisting: true,
//         batch: existingJob.batch,
//         section: existingJob.section
//       };
//     }

//     // Create OCR job record
//     const job = await OcrJob.create({
//       userId,
//       batch: batchId,
//       section: sectionId,
//       fileUrl: imageUrl,
//       status: 'queued'
//     });

//     // Add to Bull queue
//     const queueJob = await ocrQueue.add(
//       'process-timetable',
//       {
//         ocrJobId: job._id.toString(),
//         userId,
//         imageUrl,
//         batchId,
//         sectionId
//       },
//       {
//         jobId: job._id.toString(), // Use OCR job ID as queue job ID
//         attempts: 3,
//         backoff: {
//           type: 'exponential',
//           delay: 5000
//         },
//         timeout: 120000 // 2 minutes timeout per attempt
//       }
//     );

//     console.log(`📋 OCR Job ${job._id} added to queue`);

//     // Populate and return
//     await job.populate([
//       { path: 'userId', select: 'name email' },
//       { path: 'batch', select: 'program year' },
//       { path: 'section', select: 'name' }
//     ]);

//     // Get queue stats
//     const waitingCount = await ocrQueue.getWaitingCount();
//     const activeCount = await ocrQueue.getActiveCount();

//     return {
//       jobId: job._id,
//       queueJobId: queueJob.id,
//       status: 'queued',
//       message: 'Job queued for processing',
//       queuePosition: waitingCount + 1,
//       activeJobs: activeCount,
//       estimatedWaitTime: waitingCount * 30, // seconds
//       batch: job.batch,
//       section: job.section
//     };

//   } catch (error) {
//     if (error instanceof AppError) throw error;
//     throw new AppError(
//       error.message || 'Failed to queue OCR job',
//       error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
//     );
//   }
// }

// // ✅ Process OCR image (Called by queue worker)
// async function processOCRImage(ocrJobId, userId, imageUrl, batchId, sectionId, queueJob) {
//   let job = await OcrJob.findById(ocrJobId);
  
//   if (!job) {
//     throw new Error('OCR Job not found in database');
//   }

//   try {
//     // Update to processing
//     job.status = 'processing';
//     job.startedAt = new Date();
//     await job.save();

//     // Report progress
//     if (queueJob) await queueJob.progress(10);

//     // Download image
//     console.log('📥 Downloading image from:', imageUrl);
//     let imageBuffer;
//     try {
//       const response = await axios.get(imageUrl, {
//         responseType: 'arraybuffer',
//         timeout: 30000,
//         headers: {
//           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
//         }
//       });
//       imageBuffer = Buffer.from(response.data);
//       console.log('✅ Image downloaded, size:', imageBuffer.length, 'bytes');
//     } catch (downloadError) {
//       throw new AppError(
//         'Failed to download image from URL',
//         StatusCodes.BAD_REQUEST
//       );
//     }

//     if (queueJob) await queueJob.progress(30);

//     // Detect MIME type
//     let mimeType = 'image/jpeg';
//     const urlLower = imageUrl.toLowerCase();
//     if (urlLower.includes('.png')) mimeType = 'image/png';
//     else if (urlLower.includes('.webp')) mimeType = 'image/webp';
//     else if (urlLower.includes('.gif')) mimeType = 'image/gif';

//     console.log('🤖 Calling Gemini API...');

//     const prompt = `
// You are a timetable extraction expert. Analyze the uploaded timetable image and extract ALL class information in strict JSON format.

// **IMPORTANT INSTRUCTIONS:**
// 1. Extract EVERY class/lecture shown in the image
// 2. Map days exactly as shown (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
// 3. Use 24-hour time format (e.g., "09:00", "14:30")
// 4. If teacher name is not visible, use empty string ""
// 5. If room number is not visible, use empty string ""
// 6. Classify type as: "Lecture", "Lab", "Tutorial", or "Practical"
// 7. Do NOT include any explanatory text, ONLY return valid JSON

// **Required JSON Structure:**
// {
//   "schedule": [
//     {
//       "day": "Monday",
//       "startTime": "09:00",
//       "endTime": "10:00",
//       "subject": "Data Structures",
//       "teacher": "Dr. Sharma",
//       "room": "301",
//       "type": "Lecture"
//     }
//   ]
// }

// Extract the complete timetable now. Return ONLY the JSON, no other text.
// `;

//     const imagePart = {
//       inlineData: {
//         data: imageBuffer.toString('base64'),
//         mimeType: mimeType
//       }
//     };

//     if (queueJob) await queueJob.progress(50);

//     const modelsToTry = ['gemini-robotics-er-1.5-preview'];
//     let result = null;
//     let modelUsed = null;

//     for (const modelName of modelsToTry) {
//       try {
//         console.log(`🔍 Trying model: ${modelName}...`);
//         const model = genAI.getGenerativeModel({ model: modelName });
//         result = await model.generateContent([prompt, imagePart]);
//         modelUsed = modelName;
//         console.log(`✅ Successfully used model: ${modelName}`);
//         break;
//       } catch (error) {
//         console.log(`❌ Model ${modelName} failed: ${error.message}`);
//         if (error.status === 401 || error.status === 403) {
//           throw new AppError('Gemini API authentication failed', StatusCodes.UNAUTHORIZED);
//         }
//         continue;
//       }
//     }

//     if (!result || !modelUsed) {
//       throw new AppError('Unable to access Gemini vision models', StatusCodes.SERVICE_UNAVAILABLE);
//     }

//     if (queueJob) await queueJob.progress(70);

//     const responseText = result.response.text();
//     console.log('📝 Extracted text (first 500 chars):', responseText.substring(0, 500));

//     job.extractedText = responseText;
//     await job.save();

//     // Parse JSON
//     let jsonData;
//     try {
//       let cleanedText = responseText
//         .replace(/```json\n?/g, '')
//         .replace(/```\n?/g, '')
//         .trim();

//       const jsonMatch = cleanedText.match(/\{[\s\S]*"schedule"[\s\S]*\}/);
//       if (jsonMatch) cleanedText = jsonMatch[0];

//       jsonData = JSON.parse(cleanedText);
//       console.log('✅ JSON parsed, found', jsonData.schedule?.length || 0, 'classes');
//     } catch (parseError) {
//       try {
//         const jsonStart = responseText.indexOf('{');
//         const jsonEnd = responseText.lastIndexOf('}') + 1;
//         if (jsonStart !== -1 && jsonEnd > jsonStart) {
//           jsonData = JSON.parse(responseText.substring(jsonStart, jsonEnd));
//         } else {
//           throw parseError;
//         }
//       } catch (retryError) {
//         throw new AppError('Failed to parse Gemini response', StatusCodes.BAD_REQUEST);
//       }
//     }

//     if (queueJob) await queueJob.progress(80);

//     // Validate
//     if (!jsonData.schedule || !Array.isArray(jsonData.schedule)) {
//       throw new AppError('Invalid timetable format', StatusCodes.BAD_REQUEST);
//     }

//     if (jsonData.schedule.length === 0) {
//       throw new AppError('No classes found in image', StatusCodes.BAD_REQUEST);
//     }

//     const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
//     const validTypes = ['Lecture', 'Lab', 'Tutorial', 'Practical'];

//     for (let i = 0; i < jsonData.schedule.length; i++) {
//       const item = jsonData.schedule[i];
//       if (item.day) {
//         item.day = item.day.charAt(0).toUpperCase() + item.day.slice(1).toLowerCase();
//       }
//       if (!item.day || !validDays.includes(item.day)) {
//         throw new AppError(`Invalid day at index ${i}`, StatusCodes.BAD_REQUEST);
//       }
//       if (!item.startTime || !item.endTime || !item.subject) {
//         throw new AppError(`Missing fields at index ${i}`, StatusCodes.BAD_REQUEST);
//       }
//       if (!item.type || !validTypes.includes(item.type)) item.type = 'Lecture';
//       item.teacher = item.teacher || '';
//       item.room = item.room || '';
//     }

//     // Save parsed data
//     job.status = 'completed';
//     job.parsedTimetable = {
//       schedule: jsonData.schedule,
//       validFrom: jsonData.validFrom || null,
//       validTo: jsonData.validTo || null
//     };
//     job.completedAt = new Date();
//     await job.save();

//     if (queueJob) await queueJob.progress(90);

//     console.log('✅ OCR job completed:', job._id);

//     // Auto-create/update timetable
//     let createdTimetable = null;
//     try {
//       const existingTimetable = await Timetable.findOne({
//         batch: batchId,
//         section: sectionId
//       });

//       if (existingTimetable) {
//         existingTimetable.schedule = jsonData.schedule;
//         existingTimetable.validFrom = jsonData.validFrom || new Date();
//         existingTimetable.validTo = jsonData.validTo || null;
//         existingTimetable.isActive = true;
//         existingTimetable.lastUpdated = new Date();
//         await existingTimetable.save();
//         createdTimetable = existingTimetable;
//         console.log('✅ Timetable updated:', existingTimetable._id);
//       } else {
//         const newTimetable = new Timetable({
//           batch: batchId,
//           section: sectionId,
//           schedule: jsonData.schedule,
//           validFrom: jsonData.validFrom || new Date(),
//           validTo: jsonData.validTo || null,
//           isActive: true
//         });
//         await newTimetable.save();
//         createdTimetable = newTimetable;
//         console.log('✅ Timetable created:', newTimetable._id);
//       }

//       await createdTimetable.populate([
//         { path: 'batch', select: 'program year' },
//         { path: 'section', select: 'name' }
//       ]);
//     } catch (timetableError) {
//       console.error('⚠️ Failed to auto-create timetable:', timetableError.message);
//     }

//     if (queueJob) await queueJob.progress(100);

//     await job.populate([
//       { path: 'userId', select: 'name email' },
//       { path: 'batch', select: 'program year' },
//       { path: 'section', select: 'name' }
//     ]);

//     return {
//       jobId: job._id,
//       status: job.status,
//       parsedTimetable: jsonData,
//       batch: job.batch,
//       section: job.section,
//       totalClasses: jsonData.schedule.length,
//       modelUsed: modelUsed,
//       timetableCreated: createdTimetable ? true : false,
//       timetableId: createdTimetable?._id || null,
//       timetable: createdTimetable || null
//     };

//   } catch (error) {
//     console.error('❌ OCR Processing Error:', error.message);

//     if (job) {
//       job.status = 'failed';
//       job.error = error.message || 'Unknown error';
//       job.retryCount += 1;
//       job.completedAt = new Date();
//       await job.save();
//     }

//     throw error;
//   }
// }

// // Get OCR job status
// async function getOCRJobStatus(jobId, userId) {
//   try {
//     const job = await OcrJob.findById(jobId)
//       .populate('userId', 'name email')
//       .populate('batch', 'program year')
//       .populate('section', 'name');

//     if (!job) {
//       throw new AppError('OCR job not found', StatusCodes.NOT_FOUND);
//     }

//     if (job.userId._id.toString() !== userId.toString()) {
//       throw new AppError('Unauthorized', StatusCodes.FORBIDDEN);
//     }

//     // Get queue job status if still in queue
//     let queueStatus = null;
//     if (job.status === 'queued' || job.status === 'processing') {
//       try {
//         const queueJob = await ocrQueue.getJob(jobId);
//         if (queueJob) {
//           queueStatus = {
//             progress: await queueJob.progress(),
//             attemptsMade: queueJob.attemptsMade,
//             state: await queueJob.getState(),
//             finishedOn: queueJob.finishedOn,
//             processedOn: queueJob.processedOn
//           };
//         }
//       } catch (queueError) {
//         console.warn('Could not fetch queue job status:', queueError.message);
//       }
//     }

//     return {
//       ...job.toObject(),
//       queueStatus
//     };

//   } catch (error) {
//     if (error instanceof AppError) throw error;
//     throw new AppError('Error fetching job status', StatusCodes.INTERNAL_SERVER_ERROR);
//   }
// }

// // Get user's OCR jobs
// async function getUserOCRJobs(userId, filters = {}) {
//   try {
//     const query = { userId, ...filters };
//     const jobs = await OcrJob.find(query)
//       .populate('batch', 'program year')
//       .populate('section', 'name')
//       .sort({ createdAt: -1 })
//       .limit(50);

//     return jobs;
//   } catch (error) {
//     throw new AppError('Error fetching jobs', StatusCodes.INTERNAL_SERVER_ERROR);
//   }
// }

// // Retry failed job
// async function retryOCRJob(jobId, userId) {
//   try {
//     const job = await OcrJob.findById(jobId);

//     if (!job) {
//       throw new AppError('OCR job not found', StatusCodes.NOT_FOUND);
//     }

//     if (job.userId.toString() !== userId.toString()) {
//       throw new AppError('Unauthorized', StatusCodes.FORBIDDEN);
//     }

//     if (job.status !== 'failed') {
//       throw new AppError('Can only retry failed jobs', StatusCodes.BAD_REQUEST);
//     }

//     if (job.retryCount >= job.maxRetries) {
//       throw new AppError('Maximum retries exceeded', StatusCodes.BAD_REQUEST);
//     }

//     // Re-queue the job
//     return await queueOCRImage(userId, job.fileUrl, job.batch, job.section);

//   } catch (error) {
//     if (error instanceof AppError) throw error;
//     throw new AppError('Error retrying job', StatusCodes.INTERNAL_SERVER_ERROR);
//   }
// }

// // Get queue statistics
// async function getQueueStats() {
//   try {
//     const [waiting, active, completed, failed, delayed] = await Promise.all([
//       ocrQueue.getWaitingCount(),
//       ocrQueue.getActiveCount(),
//       ocrQueue.getCompletedCount(),
//       ocrQueue.getFailedCount(),
//       ocrQueue.getDelayedCount()
//     ]);

//     return {
//       waiting,
//       active,
//       completed,
//       failed,
//       delayed,
//       total: waiting + active + completed + failed + delayed
//     };
//   } catch (error) {
//     throw new AppError('Error fetching queue stats', StatusCodes.INTERNAL_SERVER_ERROR);
//   }
// }

// module.exports = {
//   queueOCRImage,
//   processOCRImage,
//   getOCRJobStatus,
//   getUserOCRJobs,
//   retryOCRJob,
//   getQueueStats
// };