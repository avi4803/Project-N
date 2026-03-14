const express = require('express');
const { OcrController } = require('../../controllers');
const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router();

/**
 * @route   POST /api/v1/ocr/submit
 * @desc    Start an asynchronous OCR process (Step 1: Submission)
 */
router.post(
    '/submit',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(3, 15 * 60 * 1000, 'ocr-submit'),
    OcrController.submitOcrJob
);

/**
 * @route   GET /api/v1/ocr/status/:jobId
 * @desc    Check status of an OCR process (Step 3: Polling)
 */
router.get(
    '/status/:jobId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.getOcrJobStatus
);

/**
 * @route   POST /api/v1/ocr/confirm/:jobId
 * @desc    Confirm and finalize OCR results into a timetable
 */
router.post(
    '/confirm/:jobId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.confirmOcrTimetable
);

/**
 * @route   GET /api/v1/ocr/history
 * @desc    Get list of recent OCR jobs
 */
router.get(
    '/history',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.getJobHistory
);

/**
 * @route   POST /api/v1/ocr/retry/:jobId
 * @desc    Retry a failed OCR job
 */
router.post(
    '/retry/:jobId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    OcrController.retryJob
);

module.exports = router;