const { AttendanceService} = require('../services');
const { publishNotification } = require('../services/notification-publisher');
const SuccessResponse = require('../utils/success-response');
const ErrorResponse = require('../utils/error-response');
const { StatusCodes } = require('http-status-codes');

// ==================== STUDENT ENDPOINTS ====================

async function getTodaysClasses(req, res) {
  try {
    const studentId = req.user.id || req.user;
    const classes = await AttendanceService.getTodaysClasses(studentId);

    SuccessResponse.data = classes;
    SuccessResponse.message = 'Today\'s classes fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function getActiveClass(req, res) {
  try {
    const studentId = req.user.id || req.user;
    const activeClass = await AttendanceService.getActiveClass(studentId);

    SuccessResponse.data = activeClass;
    SuccessResponse.message = activeClass ? 'Active class found' : 'No active class at the moment';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function markAttendance(req, res) {
  try {
    const studentId = req.user.id || req.user;
    const { sessionId } = req.params;
    const { status = 'present' } = req.body;
    
    const result = await AttendanceService.markAttendance(sessionId, studentId, status);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Attendance updated successfully';

    // Simple notification if marking present
    if (status === 'present' && req.user.email) {
      publishNotification('ATTENDANCE_MARKED', {
        userId: req.user.id,
        to: req.user.email,
        name: req.user.name,
        date: new Date().toDateString(),
        time: new Date().toLocaleTimeString()
      });
    }

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function getAttendanceHistory(req, res) {
  try {
    const studentId = req.user.id || req.user;
    const { subjectId } = req.params;
    const { startDate, endDate, limit, skip } = req.query;

    const result = await AttendanceService.getAttendanceHistory(studentId, subjectId, {
      startDate, endDate,
      limit: limit ? parseInt(limit) : undefined,
      skip: skip ? parseInt(skip) : undefined
    });

    SuccessResponse.data = result;
    SuccessResponse.message = 'Attendance history fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function getOverallStats(req, res) {
  try {
    const studentId = req.user.id || req.user;
    const { timeRange = 'all' } = req.query;

    const result = await AttendanceService.getOverallStats(studentId, timeRange);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Attendance stats fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

module.exports = {
  getTodaysClasses,
  getActiveClass,
  markAttendance,
  getAttendanceHistory,
  getOverallStats
};
