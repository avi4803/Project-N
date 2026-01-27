const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceStreak = require('../models/AttendanceStreak');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const NotificationPublisher = require('../events/notification-publisher');
const { publishNotification } = require('../services/notification-publisher');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');

class AttendanceService {
  
  // ==================== AUTO-SESSION CREATION ====================
  
  /**
   * Auto-create sessions for today based on timetable
   * Called by a cron job daily at midnight
   */
  async createTodaySessions() {
    try {
      const today = new Date();
      const WeeklySessionService = require('./weekly-session-service');
      console.log(`🚀 Automated Task: Ensuring live sessions exist for today...`);
      await WeeklySessionService.generateForWeek(today);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error in live session automation:`, error);
      throw error;
    }
  }

  /**
   * Auto-activate sessions based on current time
   * Sessions are already active when created, this sends reminders
   */
  async activateSessions() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find today's active sessions that haven't sent notifications yet
      const sessions = await AttendanceSession.find({
        date: today,
        status: 'active',
        isMarkingOpen: true
      }).populate('subject batch section');
      
      console.log(`ℹ️  ${sessions.length} sessions are active today (attendance marking is open all day)`);
      
      return sessions;
    } catch (error) {
      console.error('Error checking active sessions:', error);
      throw error;
    }
  }
  
  /**
   * Auto-close sessions at end of day (23:59)
   * Called by a cron job at midnight to close previous day's sessions
   */
  async closeSessions() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      // Find yesterday's sessions that are still open
      const sessions = await AttendanceSession.find({
        date: yesterday,
        isMarkingOpen: true,
        status: 'active'
      });
      
      const closed = [];
      
      for (const session of sessions) {
        await session.closeMarking();
        
        // Mark absent students
        await this.markAbsentStudents(session._id);
        
        // Update session statistics
        const stats = await this.getSessionStatistics(session._id);
        session.presentCount = stats.present;
        session.absentCount = stats.absent;
        await session.save();
        
        closed.push(session);
      }
      
      if (closed.length > 0) {
        console.log(`✅ Closed ${closed.length} sessions from previous day`);
      }
      
      return closed;
    } catch (error) {
      console.error('Error closing sessions:', error);
      throw error;
    }
  }
  
  // ==================== STUDENT ATTENDANCE MARKING ====================
  
  /**
   * Mark self-attendance for active session
   */
  async markAttendance(sessionId, studentId, verificationData = {}) {
    try {
      // Convert to string - handle Buffer by converting to hex
      let studentIdStr;
      if (Buffer.isBuffer(studentId)) {
        studentIdStr = studentId.toString('hex');
      } else if (typeof studentId === 'object' && studentId?._id) {
        studentIdStr = studentId._id.toString();
      } else {
        studentIdStr = studentId?.toString() || studentId;
      }
      
      let session = await AttendanceSession.findById(sessionId).populate('subject');
      
      // FALLBACK: Check WeeklySessionClass if standard session not found
      let isWeeklyClass = false;
      if (!session) {
        const WeeklySessionClass = require('../models/WeeklySessionClass');
        session = await WeeklySessionClass.findById(sessionId).populate('subject');
        isWeeklyClass = !!session;
      }

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }
      
      // Check if marking is open
      if (!session.isMarkingOpen) {
        throw new AppError('Attendance marking is not open for this session', StatusCodes.BAD_REQUEST);
      }
      
      // Check if within marking window
      // For WeeklySessionClass, we check manually if methods aren't present
      let withinWindow = false;
      if (typeof session.isWithinMarkingWindow === 'function') {
        withinWindow = session.isWithinMarkingWindow();
      } else {
        // Validation logic for WeeklySessionClass
        if (!session.lateMarkingDeadline) withinWindow = true;
        else withinWindow = new Date() <= new Date(session.lateMarkingDeadline);
      }

      if (!withinWindow) {
        throw new AppError('Attendance marking deadline has passed', StatusCodes.BAD_REQUEST);
      }
      
      // Verify student belongs to this batch/section
      const student = await User.findById(studentIdStr);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      
      if (student.batch.toString() !== session.batch.toString() ||
          student.section.toString() !== session.section.toString()) {
        throw new AppError('You are not enrolled in this class', StatusCodes.FORBIDDEN);
      }
      
      // Check if already marked
      const existingAttendance = await Attendance.findOne({
        student: studentIdStr,
        session: sessionId
      });
      
      if (existingAttendance) {
        throw new AppError('Attendance already marked for this session', StatusCodes.BAD_REQUEST);
      }
      
      // Create attendance record
      const attendance = await Attendance.create({
        student: studentIdStr,
        subject: session.subject._id,
        session: sessionId,
        college: session.college,
        batch: session.batch,
        section: session.section,
        date: session.date,
        status: 'present',
        markedBy: studentIdStr,
        markedByRole: 'student',
        markedAt: new Date(),
        verification: verificationData
      });
      
      await attendance.populate([
        { path: 'subject', select: 'name code' },
        { path: 'student', select: 'name email' }
      ]);
      
      // Update streak
      await this.updateStreak(studentIdStr, session.subject._id, true, sessionId);
      
      // Get updated stats
      const attendanceStats = await Attendance.getAttendanceStats(studentId, session.subject._id);
      
      // Send confirmation notification
      await NotificationPublisher.publish('ATTENDANCE_MARKED', {
        userId: studentId.toString(),
        to: student.email, // Ensure student email is populated
        name: student.name,
        subjectName: session.subject.name,
        status: 'present',
        date: session.date,
        time: `${session.startTime} - ${session.endTime}`,
        percentage: attendanceStats.percentage
      });
      
      // Check for low attendance warning
      if (parseFloat(attendanceStats.percentage) < session.subject.attendanceConfig.warningThreshold) {
        await NotificationPublisher.publish('ATTENDANCE_LOW', {
          userId: studentId.toString(),
          to: student.email,
          name: student.name,
          subjectName: session.subject.name,
          percentage: attendanceStats.percentage,
          threshold: session.subject.attendanceConfig.warningThreshold
        });
      }
      
      return {
        attendance,
        stats: attendanceStats,
        streak: await AttendanceStreak.findOne({ student: studentId, subject: session.subject._id })
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Mark absent students automatically when session closes
   */
  async markAbsentStudents(sessionId) {
    try {
      const session = await AttendanceSession.findById(sessionId);
      
      // Get all students in batch/section
      const allStudents = await User.find({
        batch: session.batch,
        section: session.section,
        role: 'student',
        isActive: true
      }).select('_id college');
      
      // Get students who already marked
      const markedStudents = await Attendance.find({ session: sessionId }).distinct('student');
      
      // Find students who didn't mark
      const absentStudents = allStudents.filter(
        student => !markedStudents.some(marked => marked.toString() === student._id.toString())
      );
      
      // Create absent records
      const absentRecords = absentStudents.map(student => ({
        student: student._id,
        subject: session.subject,
        session: sessionId,
        college: student.college,
        batch: session.batch,
        section: session.section,
        date: session.date,
        status: 'absent',
        markedByRole: 'system',
        markedAt: new Date()
      }));
      
      if (absentRecords.length > 0) {
        await Attendance.insertMany(absentRecords);
        
        // Update streaks and notify absent students
        for (const record of absentRecords) {
          await this.updateStreak(record.student, session.subject, false, null);
          
          // Notify Absent Student
          // We need to fetch student details (email/phone) to send notification
          // Optimization: Could populate earlier or fetch in batch
          const studentUser = await User.findById(record.student).select('email name phone');
          if (studentUser && studentUser.email) {
             await NotificationPublisher.publish('ATTENDANCE_ABSENT', {
                userId: studentUser._id.toString(),
                to: studentUser.email,
                name: studentUser.name,
                phone: studentUser.phone,
                subjectName: session.subject.name,
                date: session.date
             });
          }
        }
      }
      
      return absentRecords.length;
    } catch (error) {
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  // ==================== STUDENT QUERIES ====================
  
  /**
   * Get today's classes for a student
   */
  async getTodaysClasses(studentId) {
    try {
      // Convert to string - handle Buffer by converting to hex
      let studentIdStr;
      if (Buffer.isBuffer(studentId)) {
        studentIdStr = studentId.toString('hex');
      } else if (typeof studentId === 'object' && studentId._id) {
        studentIdStr = studentId._id.toString();
      } else {
        studentIdStr = studentId?.toString() || studentId;
      }
      
      const student = await User.findById(studentIdStr);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      
      console.log('Student found:', {
        id: student._id,
        batch: student.batch,
        section: student.section
      });
      
      // --- Timezone Aware Date Calculation (IST) ---
      const now = new Date();
      // Calculate IST time (UTC + 5.5 hours)
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const hours = istTime.getUTCHours().toString().padStart(2, '0');
      const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      // Calculate Academic "Today" (IST)
      const today = new Date(istTime);
      today.setUTCHours(0, 0, 0, 0);

      // After 9:00 PM IST, show tomorrow's classes as "today"
      if (currentTime >= "21:00") {
          today.setUTCDate(today.getUTCDate() + 1);
          console.log("🌙 Late night (IST): Shifting dashboard view to tomorrow");
      }

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1);
      
      console.log(`Searching dashboard sessions for IST Date: ${today.toISOString().split('T')[0]}`);
      
      // 1. Fetch from WeeklySessionClass (New Architecture)
      const WeeklySessionClass = require('../models/WeeklySessionClass');
      const WeeklySessionService = require('./weekly-session-service');
      const WeeklySession = require('../models/WeeklySession');

      // Extract numeric components and the dateString from our IST-calculated "today"
      const istComp = WeeklySessionService.getISTComponents(today);

      let sessions = await WeeklySessionClass.find({
        batch: student.batch,
        section: student.section,
        dateString: istComp.dateString
      })
      .populate('subject', 'name code facultyName')
      .sort({ startTime: 1 });

      if (sessions.length === 0) {
           const [year, weekNo] = WeeklySessionService.getWeekNumber(today);
           const sessionContainer = await WeeklySession.findOne({
               batch: student.batch,
               section: student.section,
               year,
               weekNumber: weekNo
           });

           if (!sessionContainer) {
               console.log(`⚠️ No WeeklySession found for Week ${weekNo}, ${year}. Auto-generating...`);
               await WeeklySessionService.generateForWeek(today);
               
               sessions = await WeeklySessionClass.find({
                    batch: student.batch,
                    section: student.section,
                    date: today
               })
               .populate('subject', 'name code facultyName')
               .sort({ startTime: 1 });
           }
      }

      const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`Classes found for today (${dayName}): ${sessions.length}`);
      
      // Check attendance status for each session
      const sessionsWithStatus = await Promise.all(
        sessions.map(async session => {
          const attendance = await Attendance.findOne({
            student: studentIdStr,
            session: session._id
          });
          
          let canMark = false;
          if (session.isMarkingOpen) {
                 if (!session.lateMarkingDeadline) canMark = true;
                 else canMark = new Date() <= new Date(session.lateMarkingDeadline);
          }

          return {
            ...session.toObject(),
            attendanceMarked: !!attendance,
            attendanceStatus: attendance?.status || null,
            canMark: canMark
          };
        })
      );
      
      return sessionsWithStatus;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get active class (currently happening)
   */
  async getActiveClass(studentId) {
    try {
      // Convert to string - handle Buffer by converting to hex
      let studentIdStr;
      if (Buffer.isBuffer(studentId)) {
        studentIdStr = studentId.toString('hex');
      } else if (typeof studentId === 'object' && studentId?._id) {
        studentIdStr = studentId._id.toString();
      } else {
        studentIdStr = studentId?.toString() || studentId;
      }
      
      const student = await User.findById(studentIdStr);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const WeeklySessionClass = require('../models/WeeklySessionClass');
      
      // 1. Try WeeklySessionClass
      let sessions = await WeeklySessionClass.find({
        batch: student.batch,
        section: student.section,
        date: today,
        status: 'active', // For weekly class, we might rely on isMarkingOpen=true status? Or string status?
        // In WeeklySessionClass schema: status enum is ['scheduled', 'cancelled', 'rescheduled', 'completed']
        // It does NOT have 'active'. It uses `isMarkingOpen` to denote active marking.
        // So query: isMarkingOpen: true
        isMarkingOpen: true,
        startTime: { $lte: currentTime },
        endTime: { $gte: currentTime }
      })
        .populate('subject', 'name code facultyName')
        .sort({ startTime: 1 })
        .limit(1);

      console.log('Active Class found:', sessions.length);
      
      if (sessions.length === 0) return null;
      
      const session = sessions[0];
      
      // Check if student has marked attendance
      const attendance = await Attendance.findOne({
        student: studentIdStr,
        session: session._id
      });
      
      let canMark = false;
      if (session.isMarkingOpen) {
             if (!session.lateMarkingDeadline) canMark = true;
             else canMark = new Date() <= new Date(session.lateMarkingDeadline);
      }

      return {
        ...session.toObject(),
        attendanceMarked: !!attendance,
        attendanceStatus: attendance?.status || null,
        canMark: canMark
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get next upcoming class
   */
  async getNextClass(studentId) {
    try {
      // Convert to string - handle Buffer by converting to hex
      let studentIdStr;
      if (Buffer.isBuffer(studentId)) {
        studentIdStr = studentId.toString('hex');
      } else if (typeof studentId === 'object' && studentId?._id) {
        studentIdStr = studentId._id.toString();
      } else {
        studentIdStr = studentId?.toString() || studentId;
      }
      
      const student = await User.findById(studentIdStr);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }
      
      // --- Timezone Aware Date Calculation (IST) ---
      const now = new Date();
      // Calculate IST time (UTC + 5.5 hours)
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const hours = istTime.getUTCHours().toString().padStart(2, '0');
      const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
      const actualTime = `${hours}:${minutes}`;

      // Calculate Academic "Today"
      const today = new Date(istTime);
      today.setUTCHours(0, 0, 0, 0);
      
      let searchTime = actualTime;

      // After 9:00 PM IST, treat tomorrow as the "active" day
      if (actualTime >= "21:00") {
          today.setUTCDate(today.getUTCDate() + 1);
          searchTime = "00:00"; 
      }

      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1);
      
      const WeeklySessionClass = require('../models/WeeklySessionClass');
      const WeeklySessionService = require('./weekly-session-service');

      // Get IST components for our targeted search day
      const istComp = WeeklySessionService.getISTComponents(today);

      // 1. WeeklySessionClass query - Find the first upcoming class on the active day
      let sessions = await WeeklySessionClass.find({
        batch: student.batch,
        section: student.section,
        dateString: istComp.dateString,
        status: { $in: ['scheduled', 'rescheduled'] }, 
        startTime: { $gt: searchTime }
      })
      .populate('subject', 'name code facultyName')
      .sort({ startTime: 1 })
      .limit(1);
      
      // If none found for the rest of today, look for the literal next day
      if (sessions.length === 0) {
          const nextDay = new Date(today.getTime() + 24 * 60 * 60 * 1000);
          const nextIstComp = WeeklySessionService.getISTComponents(nextDay);
          
          sessions = await WeeklySessionClass.find({
            batch: student.batch,
            section: student.section,
            dateString: nextIstComp.dateString,
            status: { $in: ['scheduled', 'rescheduled'] }
          })
          .populate('subject', 'name code facultyName')
          .sort({ startTime: 1 })
          .limit(1);
      }
      
      
      
      return sessions.length > 0 ? sessions[0] : null;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get attendance history for a subject
   */
  async getAttendanceHistory(studentId, subjectId, options = {}) {
    try {
      // Convert to string to handle Buffer from JWT
      const studentIdStr = studentId.toString();
      
      const { startDate, endDate, limit = 50, skip = 0 } = options;
      
      const query = {
        student: studentIdStr,
        subject: subjectId
      };
      
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }
      
      const records = await Attendance.find(query)
        .populate('session', 'startTime endTime classType room')
        .sort({ date: -1 })
        .limit(limit)
        .skip(skip);
      
      const stats = await Attendance.getAttendanceStats(studentIdStr, subjectId);
      
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
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get overall attendance stats (all subjects)
   */
  async getOverallStats(studentId, timeRange = 'all') {
    try {
      // Convert to string to handle Buffer from JWT
      const studentIdStr = studentId.toString();
      
      const query = { student: studentIdStr };
      
      // Apply time range filter
      if (timeRange !== 'all') {
        const now = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'semester':
            startDate.setMonth(now.getMonth() - 6);
            break;
        }
        
        query.date = { $gte: startDate };
      }
      
      const subjectWise = await Attendance.getSubjectWiseAttendance(studentIdStr);
      
      const overall = await Attendance.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
            },
            absent: {
              $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
            }
          }
        }
      ]);
      
      const overallStats = overall[0] || { total: 0, present: 0, absent: 0 };
      overallStats.percentage = overallStats.total > 0 
        ? ((overallStats.present / overallStats.total) * 100).toFixed(2)
        : 100;
      
      return {
        overall: overallStats,
        subjectWise,
        timeRange
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Get attendance streak for subject or overall
   */
  async getStreak(studentId, subjectId = null) {
    try {
      // Convert to string to handle Buffer from JWT
      const studentIdStr = studentId.toString();
      
      const query = { student: studentIdStr };
      if (subjectId) query.subject = subjectId;
      
      const streaks = await AttendanceStreak.find(query).populate('subject', 'name code');
      
      if (subjectId) {
        return streaks[0] || null;
      }
      
      return streaks;
    } catch (error) {
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  /**
   * Update attendance streak (consecutive classes, not days)
   */
  async updateStreak(studentId, subjectId, isPresent, sessionId = null) {
    try {
      // Convert to string to handle Buffer from JWT
      const studentIdStr = studentId.toString();
      
      let streak = await AttendanceStreak.findOne({
        student: studentIdStr,
        subject: subjectId
      });
      
      if (!streak) {
        // Create new streak
        streak = await AttendanceStreak.create({
          student: studentIdStr,
          subject: subjectId,
          currentStreak: isPresent ? 1 : 0,
          longestStreak: isPresent ? 1 : 0,
          totalPresent: isPresent ? 1 : 0,
          totalAbsent: isPresent ? 0 : 1,
          lastAttendedSession: sessionId,
          lastAttendanceDate: new Date()
        });
      } else {
        if (isPresent) {
          // Increment streak for consecutive class attendance
          await streak.incrementStreak(sessionId);
          
          // Notify on milestone (e.g., every 5 days)
          if (streak.currentStreak % 5 === 0) {
             const user = await User.findById(studentIdStr).select('email name');
             if (user && user.email) {
                 publishNotification('STREAK_MILESTONE', {
                    userId: user._id.toString(),
                    to: user.email,
                    name: user.name,
                    streakCount: streak.currentStreak,
                    subjectName: 'Subject' // Ideally fetch subject name
                 });
             }
          }

        } else {
          // Break streak on absence
          const previousStreak = streak.currentStreak;
          await streak.breakStreak();
          
          if (previousStreak >= 3) {
             const user = await User.findById(studentIdStr).select('email name');
             if (user && user.email) {
                 publishNotification('STREAK_BROKEN', {
                    userId: user._id.toString(),
                    to: user.email,
                    name: user.name,
                    previousStreak: previousStreak
                 });
             }
          }
        }
      }
      
      return streak;
    } catch (error) {
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  // ==================== ADMIN CORRECTIONS ====================
  
  /**
   * Update attendance record (admin/faculty only)
   */
  async updateAttendance(attendanceId, adminId, newStatus, reason) {
    try {
      const attendance = await Attendance.findById(attendanceId).populate('student subject');
      
      if (!attendance) {
        throw new AppError('Attendance record not found', StatusCodes.NOT_FOUND);
      }
      
      const oldStatus = attendance.status;
      
      if (oldStatus === newStatus) {
        throw new AppError('New status is same as current status', StatusCodes.BAD_REQUEST);
      }
      
      // Update status
      attendance.status = newStatus;
      attendance.isModified = true;
      
      // Add to modification history
      attendance.modificationHistory.push({
        modifiedBy: adminId,
        previousStatus: oldStatus,
        newStatus: newStatus,
        reason: reason || 'Manual correction by admin',
        modifiedAt: new Date()
      });
      
      await attendance.save();
      
      // Update streak
      await this.updateStreak(
        attendance.student._id,
        attendance.subject._id,
        newStatus === 'present'
      );
      
      // Notify student
      await NotificationPublisher.publish('attendance.updated', {
        studentId: attendance.student._id.toString(),
        subjectName: attendance.subject.name,
        oldStatus,
        newStatus,
        reason
      });
      
      return attendance;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
  
  // ==================== HELPER METHODS ====================
  
  async getSessionStatistics(sessionId) {
    try {
      const stats = await Attendance.aggregate([
        { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      const result = { total: 0, present: 0, absent: 0 };
      
      stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });
      
      return result;
    } catch (error) {
      throw new AppError(error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = new AttendanceService();
