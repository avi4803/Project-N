const express = require('express');
const { OcrController } = require('../../controllers');
const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router();

// Process timetable image - Authenticated users only
router.post(
    '/process',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(3, 15 * 60 * 1000, 'ocr-process'),
    OcrController.uploadAndProcessTimetable
);

// Create timetable from OCR job - Authenticated users
router.post(
    '/jobs/:jobId/create-timetable',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.createTimetableFromOCR
);

// Get OCR job status - Authenticated users
router.get(
    '/jobs/:jobId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.getOCRJobStatus
);

// Get user's OCR jobs - Authenticated users
router.get(
    '/jobs',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.getUserOCRJobs
);

// Retry failed OCR job - Authenticated users
router.post(
    '/jobs/:jobId/retry',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(5, 15 * 60 * 1000, 'ocr-retry'),
    OcrController.retryOCRJob
);

module.exports = router;