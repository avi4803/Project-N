const { StatusCodes } = require('http-status-codes');
const { OcrService } = require('../services');
const { ErrorResponse, SuccessResponse } = require('../utils/');

// Upload and process timetable image
async function uploadAndProcessTimetable(req, res) {
  try {
    const userId = req.user; // From checkAuth middleware
    const { imageUrl, batchId, sectionId } = req.body;

    // Validate required fields
    if (!imageUrl) {
      ErrorResponse.message = 'Image URL is required';
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    if (!batchId || !sectionId) {
      ErrorResponse.message = 'Batch ID and Section ID are required';
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    // Process OCR
    const result = await OcrService.processOCRImage(userId, imageUrl, batchId, sectionId);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Timetable image processed successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);

  } catch (error) {
    console.error('OCR Controller Error:', error);
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error processing timetable image';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

// Create timetable from OCR job
async function createTimetableFromOCR(req, res) {
  try {
    const userId = req.user;
    const { jobId } = req.params;

    const timetable = await OcrService.createTimetableFromOCR(jobId, userId);

    SuccessResponse.data = timetable;
    SuccessResponse.message = 'Timetable created successfully from OCR';

    return res.status(StatusCodes.CREATED).json(SuccessResponse);

  } catch (error) {
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error creating timetable from OCR';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

// Get OCR job status
async function getOCRJobStatus(req, res) {
  try {
    const userId = req.user;
    const { jobId } = req.params;

    const job = await OcrService.getOCRJobStatus(jobId, userId);

    SuccessResponse.data = job;
    SuccessResponse.message = 'OCR job status fetched successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);

  } catch (error) {
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error fetching OCR job status';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

// Get user's OCR jobs
async function getUserOCRJobs(req, res) {
  try {
    const userId = req.user;
    const filters = {};

    // Optional filters from query params
    if (req.query.status) filters.status = req.query.status;
    if (req.query.batch) filters.batch = req.query.batch;
    if (req.query.section) filters.section = req.query.section;

    const jobs = await OcrService.getUserOCRJobs(userId, filters);

    SuccessResponse.data = jobs;
    SuccessResponse.message = 'OCR jobs fetched successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);

  } catch (error) {
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error fetching OCR jobs';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

// Retry failed OCR job
async function retryOCRJob(req, res) {
  try {
    const userId = req.user;
    const { jobId } = req.params;

    const result = await OcrService.retryOCRJob(jobId, userId);

    SuccessResponse.data = result;
    SuccessResponse.message = 'OCR job retry initiated successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);

  } catch (error) {
    ErrorResponse.error = error;
    ErrorResponse.message = error.message || 'Error retrying OCR job';
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

module.exports = {
  uploadAndProcessTimetable,
  createTimetableFromOCR,
  getOCRJobStatus,
  getUserOCRJobs,
  retryOCRJob
};


// const { StatusCodes } = require('http-status-codes');
// const OcrService = require('../services/ocr-service');
// const { ErrorResponse, SuccessResponse } = require('../utils/');

// // Upload and queue timetable processing
// async function uploadAndProcessTimetable(req, res) {
//   try {
//     const userId = req.user;
//     const { imageUrl, batchId, sectionId } = req.body;

//     if (!imageUrl) {
//       ErrorResponse.message = 'Image URL is required';
//       return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
//     }

//     if (!batchId || !sectionId) {
//       ErrorResponse.message = 'Batch ID and Section ID are required';
//       return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
//     }

//     // Queue the job (non-blocking)
//     const result = await OcrService.queueOCRImage(userId, imageUrl, batchId, sectionId);

//     SuccessResponse.data = result;
//     SuccessResponse.message = result.isExisting 
//       ? 'Job already in queue or processing' 
//       : 'Timetable image queued for processing';

//     return res.status(StatusCodes.ACCEPTED).json(SuccessResponse);

//   } catch (error) {
//     console.error('OCR Controller Error:', error);
//     ErrorResponse.error = error;
//     ErrorResponse.message = error.message || 'Error queueing timetable image';
//     return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
//   }
// }


// // Create timetable from completed OCR job
// async function createTimetableFromOCR(req, res) {
//   try {
//     const userId = req.user;
//     const { jobId } = req.params;

//     const timetable = await OcrService.createTimetableFromOCR(jobId, userId);

//     SuccessResponse.data = timetable;
//     SuccessResponse.message = 'Timetable created successfully from OCR';

//     return res.status(StatusCodes.CREATED).json(SuccessResponse);

//   } catch (error) {
//     console.error('Create Timetable from OCR Error:', error);
//     ErrorResponse.error = error;
//     ErrorResponse.message = error.message || 'Error creating timetable from OCR';
//     return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
//   }
// }



// // Get OCR job status
// async function getOCRJobStatus(req, res) {
//   try {
//     const userId = req.user;
//     const { jobId } = req.params;

//     const job = await OcrService.getOCRJobStatus(jobId, userId);

//     SuccessResponse.data = job;
//     SuccessResponse.message = 'OCR job status fetched successfully';

//     return res.status(StatusCodes.OK).json(SuccessResponse);

//   } catch (error) {
//     ErrorResponse.error = error;
//     ErrorResponse.message = error.message || 'Error fetching OCR job status';
//     return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
//   }
// }

// // Get user's OCR jobs
// async function getUserOCRJobs(req, res) {
//   try {
//     const userId = req.user;
//     const filters = {};

//     if (req.query.status) filters.status = req.query.status;
//     if (req.query.batch) filters.batch = req.query.batch;
//     if (req.query.section) filters.section = req.query.section;

//     const jobs = await OcrService.getUserOCRJobs(userId, filters);

//     SuccessResponse.data = jobs;
//     SuccessResponse.message = 'OCR jobs fetched successfully';

//     return res.status(StatusCodes.OK).json(SuccessResponse);

//   } catch (error) {
//     ErrorResponse.error = error;
//     ErrorResponse.message = error.message || 'Error fetching OCR jobs';
//     return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
//   }
// }

// // Retry failed OCR job
// async function retryOCRJob(req, res) {
//   try {
//     const userId = req.user;
//     const { jobId } = req.params;

//     const result = await OcrService.retryOCRJob(jobId, userId);

//     SuccessResponse.data = result;
//     SuccessResponse.message = 'OCR job retry queued successfully';

//     return res.status(StatusCodes.ACCEPTED).json(SuccessResponse);

//   } catch (error) {
//     ErrorResponse.error = error;
//     ErrorResponse.message = error.message || 'Error retrying OCR job';
//     return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
//   }
// }

// // Get queue statistics
// async function getQueueStats(req, res) {
//   try {
//     const stats = await OcrService.getQueueStats();

//     SuccessResponse.data = stats;
//     SuccessResponse.message = 'Queue statistics fetched successfully';

//     return res.status(StatusCodes.OK).json(SuccessResponse);

//   } catch (error) {
//     ErrorResponse.error = error;
//     ErrorResponse.message = error.message || 'Error fetching queue stats';
//     return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
//   }
// }

// module.exports = {
//   createTimetableFromOCR,
//   uploadAndProcessTimetable,
//   getOCRJobStatus,
//   getUserOCRJobs,
//   retryOCRJob,
//   getQueueStats
// };