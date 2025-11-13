const { GoogleGenerativeAI } = require('@google/generative-ai');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const OcrJob = require('../models/OcrJob');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
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
    try {
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      imageBuffer = Buffer.from(response.data);
      console.log('✅ Image downloaded successfully, size:', imageBuffer.length, 'bytes');
    } catch (downloadError) {
      console.error('❌ Image download failed:', downloadError.message);
      throw new AppError(
        'Failed to download image from URL. Please check the URL is accessible.',
        StatusCodes.BAD_REQUEST
      );
    }

    // Detect image MIME type
    let mimeType = 'image/jpeg';
    const urlLower = imageUrl.toLowerCase();
    
    if (urlLower.includes('.png')) {
      mimeType = 'image/png';
    } else if (urlLower.includes('.webp')) {
      mimeType = 'image/webp';
    } else if (urlLower.includes('.gif')) {
      mimeType = 'image/gif';
    }

    console.log('🤖 Initializing Gemini AI model...');
    
    // Detailed prompt for timetable extraction
    const prompt = `
You are a timetable extraction expert. Analyze the uploaded timetable image and extract ALL class information in strict JSON format.

**IMPORTANT INSTRUCTIONS:**
1. Extract EVERY class/lecture shown in the image
2. Map days exactly as shown (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
3. Use 24-hour time format (e.g., "09:00", "14:30")
4. If teacher name is not visible, use empty string ""
5. If room number is not visible, use empty string ""
6. Classify type as: "Lecture", "Lab", "Tutorial", or "Practical"
7. Do NOT include any explanatory text, ONLY return valid JSON

**Required JSON Structure:**
{
  "schedule": [
    {
      "day": "Monday",
      "startTime": "09:00",
      "endTime": "10:00",
      "subject": "Data Structures",
      "teacher": "Dr. Sharma",
      "room": "301",
      "type": "Lecture"
    },
    {
      "day": "Monday",
      "startTime": "10:00",
      "endTime": "11:00",
      "subject": "Operating Systems",
      "teacher": "Prof. Kumar",
      "room": "302",
      "type": "Lecture"
    }
  ]
}

**Example for Labs (3-hour sessions):**
{
  "day": "Tuesday",
  "startTime": "09:00",
  "endTime": "12:00",
  "subject": "Data Structures Lab",
  "teacher": "Dr. Sharma",
  "room": "Lab-1",
  "type": "Lab"
}

Extract the complete timetable now. Return ONLY the JSON, no other text.
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
        
        // Continue to next model
        continue;
      }
    }

    // If no model worked, throw error
    if (!result || !modelUsed) {
      console.error('❌ All models failed. Last error:', lastError?.message);
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

     // ✅ AUTO-CREATE TIMETABLE AFTER SUCCESSFUL OCR
    let createdTimetable = null;
    try {
      console.log('🔄 Auto-creating timetable from OCR results...');
      
      // Check if timetable already exists
      const existingTimetable = await Timetable.findOne({
        batch: batchId,
        section: sectionId
      });

      if (existingTimetable) {
        console.log('⚠️ Timetable already exists, updating instead...');
        
        // Update existing timetable
        existingTimetable.schedule = jsonData.schedule;
        existingTimetable.validFrom = jsonData.validFrom || new Date();
        existingTimetable.validTo = jsonData.validTo || null;
        existingTimetable.isActive = true;
        existingTimetable.lastUpdated = new Date();
        
        await existingTimetable.save();
        createdTimetable = existingTimetable;
        
        console.log('✅ Timetable updated successfully:', existingTimetable._id);
      } else {
        // Create new timetable
        const newTimetable = new Timetable({
          batch: batchId,
          section: sectionId,
          schedule: jsonData.schedule,
          validFrom: jsonData.validFrom || new Date(),
          validTo: jsonData.validTo || null,
          isActive: true
        });

        await newTimetable.save();
        createdTimetable = newTimetable;
        
        console.log('✅ New timetable created successfully:', newTimetable._id);
      }

      // Populate timetable
      await createdTimetable.populate([
        { path: 'batch', select: 'program year' },
        { path: 'section', select: 'name' }
      ]);

    } catch (timetableError) {
      console.error('⚠️ Failed to auto-create timetable:', timetableError.message);
      // Don't throw error - OCR was successful, timetable creation is bonus
    }

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
      timetableCreated: createdTimetable ? true : false,
      timetableId: createdTimetable?._id || null,
      timetable: createdTimetable || null
    };

  } catch (error) {
    console.error('❌ OCR Processing Error:', error.message);

    // Update job status to failed
    if (job) {
      job.status = 'failed';
      job.error = error.message || 'Unknown error occurred';
      job.retryCount += 1;
      job.completedAt = new Date();
      await job.save();
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

// Create timetable from OCR job
async function createTimetableFromOCR(jobId, userId) {
  try {
    const job = await OcrJob.findById(jobId)
      .populate('batch')
      .populate('section');

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

    const existingTimetable = await Timetable.findOne({
      batch: job.batch._id,
      section: job.section._id
    });

    if (existingTimetable) {
      throw new AppError(
        'Timetable already exists for this batch and section. Please update instead.',
        StatusCodes.CONFLICT
      );
    }

    const timetable = new Timetable({
      batch: job.batch._id,
      section: job.section._id,
      schedule: job.parsedTimetable.schedule,
      validFrom: job.parsedTimetable.validFrom || new Date(),
      validTo: job.parsedTimetable.validTo,
      isActive: true
    });

    await timetable.save();
    await timetable.populate([
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);

    console.log('✅ Timetable created from OCR job:', timetable._id);
    return timetable;

  } catch (error) {
    if (error instanceof AppError) throw error;
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