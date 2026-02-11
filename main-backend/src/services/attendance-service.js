const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const CacheService = require('./cache-service');
const WeeklySessionClass = require('../models/WeeklySessionClass');
const WeeklySession = require('../models/WeeklySession');
const WeeklySessionService = require('./weekly-session-service');

class AttendanceService {
  
  /**
   * Auto-create sessions for today based on timetable
   */
  async createTodaySessions() {
    try {
      const today = new Date();
      await WeeklySessionService.generateForWeek(today);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error in session automation:`, error);
      throw error;
    }
  }

  /**
   * Toggle attendance for a session (Present/Absent/None)
   */
  async markAttendance(sessionId, studentId, status = 'present') {
    try {
      if (!studentId) throw new AppError('Student ID is required', StatusCodes.BAD_REQUEST);
      const studentIdStr = studentId.toString();
      
      const session = await WeeklySessionClass.findById(sessionId).populate('subject');
      if (!session) {
        throw new AppError('Class session not found', StatusCodes.NOT_FOUND);
      }
      
      const student = await User.findById(studentIdStr);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      
      // Upsert attendance record
      let attendance = await Attendance.findOne({
        student: studentIdStr,
        session: sessionId
      });
      
      if (attendance) {
        if (attendance.status === status) {
          // If clicking the same status, we could delete it (unmark) or just keep it
          // Let's implement toggle: if same status, delete it. If different, update it.
          await Attendance.findByIdAndDelete(attendance._id);
          attendance = null;
        } else {
          attendance.status = status;
          await attendance.save();
        }
      } else {
        attendance = await Attendance.create({
          student: studentIdStr,
          subject: session.subject._id,
          session: sessionId,
          batch: session.batch,
          section: session.section,
          date: session.date,
          status: status
        });
      }
      
      // Invalidate Cache
      await this._invalidateUserCache(studentIdStr, session.dateString || new Date(session.date).toISOString().split('T')[0]);

      const stats = await Attendance.getAttendanceStats(studentIdStr, session.subject._id);
      
      return {
        attendance,
        stats
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get today's classes for a student with their attendance status
   */
  async getTodaysClasses(studentId) {
    try {
      if (!studentId) throw new AppError('Student ID is required', StatusCodes.BAD_REQUEST);
      const studentIdStr = studentId.toString();
      const student = await User.findById(studentIdStr);
      if (!student) throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      
      const now = new Date();
      const istComp = WeeklySessionService.getISTComponents(now);

      const cacheKey = `user:${studentIdStr}:dashboard:${istComp.dateString}`;
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData) return cachedData;
      
      console.log(`🔍 [DEBUG] querying todays classes for Student ${studentIdStr} | Batch: ${student.batch} | Section: ${student.section} | Date: ${istComp.dateString}`);

      let sessions = await WeeklySessionClass.find({
        batch: student.batch,
        section: student.section,
        dateString: istComp.dateString
      })
      .populate('subject', 'name code facultyName')
      .sort({ startTime: 1 });
      
      console.log(`🔍 [DEBUG] Found ${sessions.length} sessions.`);

      if (sessions.length === 0) {
        await WeeklySessionService.generateForWeek(now);
        sessions = await WeeklySessionClass.find({
          batch: student.batch,
          section: student.section,
          dateString: istComp.dateString
        })
        .populate('subject', 'name code facultyName')
        .sort({ startTime: 1 });
      }
      
      const sessionsWithStatus = await Promise.all(
        sessions.map(async session => {
          const attendance = await Attendance.findOne({
            student: studentIdStr,
            session: session._id
          });
          
          return {
            ...session.toObject(),
            attendanceMarked: !!attendance,
            attendanceStatus: attendance?.status || null
          };
        })
      );
      
      await CacheService.set(cacheKey, sessionsWithStatus, 300);
      return sessionsWithStatus;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get currently active class (based on time only, no marking windows)
   */
  async getActiveClass(studentId) {
    try {
      if (!studentId) throw new AppError('Student ID is required', StatusCodes.BAD_REQUEST);
      const studentIdStr = studentId.toString();
      const student = await User.findById(studentIdStr);
      
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
      const istComp = WeeklySessionService.getISTComponents(now);

      const cacheKey = `user:${studentIdStr}:active-class`;
      const cachedData = await CacheService.get(cacheKey);
      if (cachedData !== undefined) return cachedData;
      
      const session = await WeeklySessionClass.findOne({
        batch: student.batch,
        section: student.section,
        dateString: istComp.dateString,
        startTime: { $lte: currentTime },
        endTime: { $gte: currentTime }
      })
      .populate('subject', 'name code facultyName');
      
      if (!session) {
        await CacheService.set(cacheKey, null, 60);
        return null;
      }
      
      const attendance = await Attendance.findOne({
        student: studentIdStr,
        session: session._id
      });
      
      const result = {
        ...session.toObject(),
        attendanceMarked: !!attendance,
        attendanceStatus: attendance?.status || null
      };

      await CacheService.set(cacheKey, result, 60);
      return result;
    } catch (error) {
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  async getAttendanceHistory(studentId, subjectId, options = {}) {
    try {
      if (!studentId) throw new AppError('Student ID is required', StatusCodes.BAD_REQUEST);
      const studentIdStr = studentId.toString();
      const { startDate, endDate, limit = 50, skip = 0 } = options;
      
      const query = { student: studentIdStr };
      if (subjectId) {
        query.subject = subjectId;
      }

      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }
      
      const records = await Attendance.find(query)
        .populate('session', 'startTime endTime classType room')
        .populate('subject', 'name code')
        .sort({ date: -1 })
        .limit(limit)
        .skip(skip);
      
      let stats = null;
      if (subjectId) {
          const overallStats = await this.getOverallStats(studentIdStr, 'all'); 
          stats = overallStats.subjectWise.find(s => s.subjectId.toString() === subjectId.toString()) || { total: 0, present: 0, absent: 0, percentage: 100 };
      }
      
      return {
        records,
        stats,
        pagination: {
          limit,
          skip,
          total: await Attendance.countDocuments(query)
        }
      };
    } catch (error) {
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getOverallStats(studentId, timeRange = 'all') {
    try {
      if (!studentId) throw new AppError('Student ID is required', StatusCodes.BAD_REQUEST);
      const studentIdStr = studentId.toString();
      const student = await User.findById(studentIdStr);
      if (!student) throw new AppError('Student not found', StatusCodes.NOT_FOUND);

      const cacheKey = `user:${studentIdStr}:overall-stats:${timeRange}`;
      const cachedStats = await CacheService.get(cacheKey);
      if (cachedStats) return cachedStats;

      const now = new Date();
      const istComp = WeeklySessionService.getISTComponents(now);

      // 1. Calculate Total Scheduled Classes (Placeholders) that happened in the past
      // For precision, we include all days before today, and today's classes that have already started
      const currentTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
      
      let scheduledQuery = {
        batch: student.batch,
        section: student.section,
        status: { $nin: ['cancelled', 'rescheduled'] },
        $or: [
            { dateString: { $lt: istComp.dateString } }, // Previous days (using dateString for IST safety)
            { dateString: istComp.dateString, startTime: { $lte: currentTime } } // Today's past classes
        ]
      };

      if (timeRange !== 'all') {
        const startDate = new Date();
        if (timeRange === 'week') startDate.setDate(startDate.getDate() - 7);
        else if (timeRange === 'month') startDate.setMonth(startDate.getMonth() - 1);
        else if (timeRange === 'semester') startDate.setMonth(startDate.getMonth() - 6);
        const startIst = WeeklySessionService.getISTComponents(startDate);
        scheduledQuery.date = { ...scheduledQuery.date, $gte: startIst.dateString };
      }

      // 2. Calculate Actual 'Present' Records Template
      let attendanceQuery = { student: studentIdStr, status: 'present' };
      if (timeRange !== 'all') {
          const startDate = new Date();
          if (timeRange === 'week') startDate.setDate(startDate.getDate() - 7);
          else if (timeRange === 'month') startDate.setMonth(startDate.getMonth() - 1);
          else if (timeRange === 'semester') startDate.setMonth(startDate.getMonth() - 6);
          attendanceQuery.date = { $gte: startDate };
      }

      // 3. Subject-wise breakdown (Placeholder-aware)
      const subjects = await Subject.find({ batch: student.batch, section: student.section });
      const subjectWise = await Promise.all(subjects.map(async (sub) => {
          const subScheduledCount = await WeeklySessionClass.countDocuments({
              ...scheduledQuery,
              subject: sub._id
          });
          const subPresentCount = await Attendance.countDocuments({
              ...attendanceQuery,
              subject: sub._id
          });

          return {
              subjectId: sub._id,
              subjectName: sub.name,
              subjectCode: sub.code,
              total: subScheduledCount,
              present: subPresentCount,
              absent: Math.max(0, subScheduledCount - subPresentCount),
              percentage: subScheduledCount > 0 ? ((subPresentCount / subScheduledCount) * 100).toFixed(2) : 100
          };
      }));

      // 4. Calculate Overall from SubjectWise (Ensures perfect consistency)
      const totalScheduled = subjectWise.reduce((acc, s) => acc + s.total, 0);
      const presentCount = subjectWise.reduce((acc, s) => acc + s.present, 0);

      const result = {
        overall: {
            total: totalScheduled,
            present: presentCount,
            absent: Math.max(0, totalScheduled - presentCount),
            percentage: totalScheduled > 0 ? ((presentCount / totalScheduled) * 100).toFixed(2) : 100
        },
        subjectWise,
        timeRange
      };

      await CacheService.set(cacheKey, result, 600);
      return result;
    } catch (error) {
      console.error('Stats Error:', error);
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async _invalidateUserCache(userId, dateString) {
    await Promise.all([
        CacheService.del(`user:${userId}:dashboard:${dateString}`),
        CacheService.del(`user:${userId}:active-class`),
        CacheService.delByPattern(`user:${userId}:overall-stats:*`)
    ]);
  }
}

module.exports = new AttendanceService();
