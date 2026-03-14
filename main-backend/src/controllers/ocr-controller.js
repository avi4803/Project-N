const { StatusCodes } = require('http-status-codes');
const { OcrService } = require('../services');
const User = require('../models/User');
const { ErrorResponse, SuccessResponse } = require('../utils/');

/**
 * Step 1: Submission
 * POST /api/v1/ocr/submit
 */
async function submitOcrJob(req, res) {
  try {
    const userId = req.user;
    const { imageUrl, batchId, sectionId } = req.body;

    if (!imageUrl) {
      ErrorResponse.message = 'Image URL is required';
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    // Capture Batch/Section either from body or user profile
    let targetBatch = batchId;
    let targetSection = sectionId;

    if (!targetBatch || !targetSection) {
        const user = await User.findById(userId);
        targetBatch = targetBatch || user?.batch;
        targetSection = targetSection || user?.section;
    }

    if (!targetBatch || !targetSection) {
        ErrorResponse.message = 'Batch and Section are required for OCR processing';
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    // 🚀 Queue the job (Immediate response)
    const result = await OcrService.queueOCRImage(userId, imageUrl, targetBatch, targetSection);

    SuccessResponse.data = result;
    SuccessResponse.message = 'OCR processing successfully started in background';

    // Return 202 Accepted for long-running processes
    return res.status(StatusCodes.ACCEPTED).json(SuccessResponse);

  } catch (error) {
    console.error('OCR Submit Error:', error);
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error starting OCR processing';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Step 3: Polling
 * GET /api/v1/ocr/status/:jobId
 */
async function getOcrJobStatus(req, res) {
  try {
    const userId = req.user;
    const { jobId } = req.params;

    const job = await OcrService.getOCRJobStatus(jobId, userId);

    SuccessResponse.data = {
        jobId: job._id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : (job.status === 'failed' ? 0 : 50), // Approximation
        result_data: job.status === 'completed' ? job.parsedTimetable : null,
        error_message: job.error || null,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
    };
    
    SuccessResponse.message = 'OCR job status fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);

  } catch (error) {
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error fetching OCR job status';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Final Step: Confirmation
 * POST /api/v1/ocr/confirm/:jobId
 */
async function confirmOcrTimetable(req, res) {
  try {
    const userId = req.user;
    const { jobId } = req.params;
    const { schedule } = req.body;

    const result = await OcrService.createTimetableFromOCR(jobId, userId, schedule);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Timetable confirmed and created successfully';

    return res.status(StatusCodes.CREATED).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message || 'Error confirming OCR results';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Auxiliary: List recent jobs
 */
async function getJobHistory(req, res) {
    try {
        const userId = req.user;
        const jobs = await OcrService.getUserOCRJobs(userId, req.query);
        SuccessResponse.data = jobs;
        SuccessResponse.message = 'OCR history fetched successfully';
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        ErrorResponse.message = error.message || 'Error fetching history';
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

/**
 * Auxiliary: Retry failed job
 */
async function retryJob(req, res) {
    try {
        const userId = req.user;
        const { jobId } = req.params;
        const result = await OcrService.retryOCRJob(jobId, userId);
        SuccessResponse.data = result;
        SuccessResponse.message = 'OCR retry initiated';
        return res.status(StatusCodes.ACCEPTED).json(SuccessResponse);
    } catch (error) {
        ErrorResponse.message = error.message || 'Error retrying job';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

module.exports = {
  submitOcrJob,
  getOcrJobStatus,
  confirmOcrTimetable,
  getJobHistory,
  retryJob
};