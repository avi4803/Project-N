const express = require('express');
const { OcrController } = require('../../controllers');
const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router();

// Process timetable image - Authenticated users only
router.post(
    '/process',
    AuthRequestMiddlewares.checkAuth,
    OcrController.uploadAndProcessTimetable
);

// Create timetable from OCR job - Authenticated users
router.post(
    '/jobs/:jobId/create-timetable',
    AuthRequestMiddlewares.checkAuth,
    OcrController.createTimetableFromOCR
);

// Get OCR job status - Authenticated users
router.get(
    '/jobs/:jobId',
    AuthRequestMiddlewares.checkAuth,
    OcrController.getOCRJobStatus
);

// Get user's OCR jobs - Authenticated users
router.get(
    '/jobs',
    AuthRequestMiddlewares.checkAuth,
    OcrController.getUserOCRJobs
);

// Retry failed OCR job - Authenticated users
router.post(
    '/jobs/:jobId/retry',
    AuthRequestMiddlewares.checkAuth,
    OcrController.retryOCRJob
);

module.exports = router;