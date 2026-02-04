const express = require('express');
const { AttendanceController } = require('../../controllers/');
const { AuthRequestMiddlewares } = require('../../middlewares/index');

const router = express.Router();

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
 * @desc    Get currently active class (based on time)
 * @access  Private (Student)
 */
router.get(
  '/active',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getActiveClass
);

/**
 * @route   POST /api/v1/attendance/mark/:sessionId
 * @desc    Mark/Toggle attendance for a specific session
 * @access  Private (Student)
 * @body    { status: 'present'|'absent' }
 */
router.post(
  '/mark/:sessionId',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.markAttendance
);

/**
 * @route   GET /api/v1/attendance/history
 * @desc    Get overall attendance history for logged-in student
 * @access  Private (Student)
 */
router.get(
  '/history',
  AuthRequestMiddlewares.checkAuth,
  AttendanceController.getAttendanceHistory
);

/**
 * @route   GET /api/v1/attendance/history/:subjectId
 * @desc    Get attendance history for a subject
 * @access  Private (Student)
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

module.exports = router;
