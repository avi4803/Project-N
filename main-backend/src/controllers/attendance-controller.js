const { AttendanceService} = require('../services');
const { publishNotification } = require('../services/notification-publisher');
const SuccessResponse = require('../utils/success-response');
const ErrorResponse = require('../utils/error-response');
const { StatusCodes } = require('http-status-codes');

// ==================== STUDENT ENDPOINTS ====================

/**
 * Get today's classes for logged-in student
 */

async function getTodaysClasses(req, res) {
  try {
    const studentId = req.user.id;
    const classes = await AttendanceService.getTodaysClasses(studentId);

    SuccessResponse.data = classes;
    SuccessResponse.message = 'Today\'s classes fetched successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Get currently active class
 */
async function getActiveClass(req, res) {
  try {
    const studentId = req.user.id;
    const activeClass = await AttendanceService.getActiveClass(studentId);

    SuccessResponse.data = activeClass;
    SuccessResponse.message = activeClass 
      ? 'Active class found' 
      : 'No active class at the moment';

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Get next upcoming class
 */
async function getNextClass(req, res) {
  try {
    const studentId = req.user.id;
    const nextClass = await AttendanceService.getNextClass(studentId);

    SuccessResponse.data = nextClass;
    SuccessResponse.message = nextClass 
      ? 'Next class fetched successfully' 
      : 'No more classes today';

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Mark self-attendance for a session
 */
async function markAttendance(req, res) {
  try {
    const studentId = req.user.id;
    const { sessionId } = req.params;
    
    const verificationData = {
      method: req.body.method || 'manual',
      geolocation: req.body.geolocation,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent']
    };

    const result = await AttendanceService.markAttendance(
      sessionId,
      studentId,
      verificationData
    );

    SuccessResponse.data = result;
    SuccessResponse.message = 'Attendance marked successfully';

    // Send Notification
    if (req.user.email) {
      publishNotification('ATTENDANCE_MARKED', {
        userId: req.user.id,
        to: req.user.email,
        name: req.user.name,
        sessionId: sessionId,
        subject: 'Attendance Marked', // Fallback subject
        // Add other fields needed for Novu template
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

/**
 * Get attendance history for a subject
 */
async function getAttendanceHistory(req, res) {
  try {
    const studentId = req.user.id;
    const { subjectId } = req.params;
    const { startDate, endDate, limit, skip } = req.query;

    const result = await AttendanceService.getAttendanceHistory(studentId, subjectId, {
      startDate,
      endDate,
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

/**
 * Get overall attendance stats
 */
async function getOverallStats(req, res) {
  try {
    const studentId = req.user.id;
    const { timeRange = 'all' } = req.query; // all, week, month, semester

    const result = await AttendanceService.getOverallStats(studentId, timeRange);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Attendance stats fetched successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Get attendance streak
 */
async function getStreak(req, res) {
  try {
    const studentId = req.user.id;
    const { subjectId } = req.query;

    const result = await AttendanceService.getStreak(studentId, subjectId || null);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Streak data fetched successfully';

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

// ==================== ADMIN/FACULTY ENDPOINTS ====================

/**
 * Update attendance record (Admin/Faculty)
 */
async function updateAttendance(req, res) {
  try {
    const adminId = req.user.id;
    const { attendanceId } = req.params;
    const { status, reason } = req.body; // status: 'present' or 'absent'

    const result = await AttendanceService.updateAttendance(
      attendanceId,
      adminId,
      status,
      reason
    );

    SuccessResponse.data = result;
    SuccessResponse.message = 'Attendance updated successfully';

    // Send Notification to the student
    // result contains the updated attendance record, we need to fetch student email if not populated
    // Assuming result.student is populated with email based on service logic
    if (result.student && result.student.email) {
        publishNotification('CORRECTION_UPDATE', {
            userId: result.student._id.toString(),
            to: result.student.email,
            name: result.student.name,
            status: status,
            reason: reason,
            subjectName: result.subject ? result.subject.name : 'Subject'
        });
    }
    
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Manually create today's sessions (Admin - for testing or recovery)
 */
async function createTodaysSessions(req, res) {
  try {
    const sessions = await AttendanceService.createTodaySessions();

    SuccessResponse.data = sessions;
    SuccessResponse.message = `${sessions.length} sessions created successfully`;

    return res.status(StatusCodes.CREATED).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Manually activate sessions (Admin - for testing)
 */
async function activateSessions(req, res) {
  try {
    const sessions = await AttendanceService.activateSessions();

    SuccessResponse.data = sessions;
    SuccessResponse.message = `${sessions.length} sessions activated`;

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Manually close sessions (Admin - for testing)
 */
async function closeSessions(req, res) {
  try {
    const sessions = await AttendanceService.closeSessions();

    SuccessResponse.data = sessions;
    SuccessResponse.message = `${sessions.length} sessions closed`;

    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

module.exports = {
  // Student endpoints
  getTodaysClasses,
  getActiveClass,
  getNextClass,
  markAttendance,
  getAttendanceHistory,
  getOverallStats,
  getStreak,
  
  // Admin/Faculty endpoints
  updateAttendance,
  createTodaysSessions,
  activateSessions,
  closeSessions
};
