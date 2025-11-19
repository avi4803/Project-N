const express = require('express');
const {AttendanceController} = require('../../controllers/');
const { AuthRequestMiddlewares } = require('../../middlewares/index');

const router = express.Router();

// ==================== STUDENT ROUTES ====================

/**
 * @route   GET /api/v1/attendance/today
 * @desc    Get today's classes for logged-in student
 * @access  Private (Student)
 */
router.get(
  '/today',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getTodaysClasses
);

/**
 * @route   GET /api/v1/attendance/active
 * @desc    Get currently active class (happening now)
 * @access  Private (Student)
 */
router.get(
  '/active',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getActiveClass
);

/**
 * @route   GET /api/v1/attendance/next
 * @desc    Get next upcoming class
 * @access  Private (Student)
 */
router.get(
  '/next',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getNextClass
);

/**
 * @route   POST /api/v1/attendance/mark/:sessionId
 * @desc    Mark self-attendance for active session
 * @access  Private (Student)
 * @body    { method: 'manual'|'geolocation', geolocation: { latitude, longitude } }
 */
router.post(
  '/mark/:sessionId',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.markAttendance
);

/**
 * @route   GET /api/v1/attendance/history/:subjectId
 * @desc    Get attendance history for a subject
 * @access  Private (Student)
 * @query   ?startDate=2024-01-01&endDate=2024-12-31&limit=50&skip=0
 */
router.get(
  '/history/:subjectId',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getAttendanceHistory
);

/**
 * @route   GET /api/v1/attendance/stats
 * @desc    Get overall attendance statistics
 * @access  Private (Student)
 * @query   ?timeRange=all|week|month|semester
 */
router.get(
  '/stats',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getOverallStats
);

/**
 * @route   GET /api/v1/attendance/streak
 * @desc    Get attendance streak (overall or for specific subject)
 * @access  Private (Student)
 * @query   ?subjectId=<id>
 */
router.get(
  '/streak',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getStreak
);

// ==================== ADMIN/FACULTY ROUTES ====================

/**
 * @route   PUT /api/v1/attendance/:attendanceId/update
 * @desc    Update attendance record (Admin/Faculty only)
 * @access  Private (Admin/Faculty)
 * @body    { status: 'present'|'absent', reason: string }
 */
router.put(
  '/:attendanceId/update',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.updateAttendance
);

/**
 * @route   POST /api/v1/attendance/admin/create-sessions
 * @desc    Manually create today's sessions (for testing/recovery)
 * @access  Private (Admin)
 */
router.post(
  '/admin/create-sessions',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.createTodaysSessions
);

/**
 * @route   POST /api/v1/attendance/admin/activate-sessions
 * @desc    Manually activate sessions (for testing)
 * @access  Private (Admin)
 */
router.post(
  '/admin/activate-sessions',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.activateSessions
);

/**
 * @route   POST /api/v1/attendance/admin/close-sessions
 * @desc    Manually close sessions (for testing)
 * @access  Private (Admin)
 */
router.post(
  '/admin/close-sessions',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.closeSessions
);

module.exports = router;
