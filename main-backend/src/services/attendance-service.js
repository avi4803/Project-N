const Attendance = require('../models/Attendance');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceStreak = require('../models/AttendanceStreak');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const NotificationPublisher = require('../events/notification-publisher');
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
      today.setHours(0, 0, 0, 0);
      
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
      
      // Get all active timetables
      const timetables = await Timetable.find({ isActive: true })
        .populate('batch section');
      
      const sessionsCreated = [];
      
      for (const timetable of timetables) {
        // Get today's classes
        const todayClasses = timetable.schedule.filter(cls => cls.day === dayName);
        
        for (const classItem of todayClasses) {
          // Find subject
          const subject = await Subject.findOne({
            name: classItem.subject,
            batch: timetable.batch._id,
            section: timetable.section._id
          });
          
          if (!subject) {
            console.warn(`Subject not found: ${classItem.subject} for ${timetable.batch.program} ${timetable.section.name}`);
            continue;
          }
          
          // Get college from subject or batch
          let collegeId = subject.college;
          if (!collegeId) {
            const Batch = require('../models/Batch');
            const batch = await Batch.findById(timetable.batch._id).select('college');
            collegeId = batch?.college;
          }
          
          if (!collegeId) {
            console.warn(`College not found for subject: ${classItem.subject}`);
            continue;
          }
          
          // Check if session already exists
          const existing = await AttendanceSession.findOne({
            subject: subject._id,
            date: today,
            startTime: classItem.startTime
          });
          
          if (existing) continue;
          
          // Create session with marking open for entire day
          const endOfDay = new Date(today);
          endOfDay.setHours(23, 59, 59, 999);
          
          const session = await AttendanceSession.create({
            subject: subject._id,
            college: collegeId,
            batch: timetable.batch._id,
            section: timetable.section._id,
            date: today,
            startTime: classItem.startTime,
            endTime: classItem.endTime,
            classType: classItem.type?.toLowerCase() || 'lecture',
            room: classItem.room,
            autoCreated: true,
            timetableClassId: classItem._id,
            status: 'active',
            isMarkingOpen: true,
            markingOpenedAt: today,
            lateMarkingDeadline: endOfDay,
            allowLateMarking: true
          });
          
          sessionsCreated.push(session);
        }
      }
      
      console.log(`✅ Created ${sessionsCreated.length} sessions for ${dayName}, ${today.toDateString()}`);
      return sessionsCreated;
    } catch (error) {
      console.error('Error creating today\'s sessions:', error);
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
      } else {
        studentIdStr = studentId?.toString() || studentId;
      }
      
      const session = await AttendanceSession.findById(sessionId).populate('subject');
      
      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }
      
      // Check if marking is open
      if (!session.isMarkingOpen) {
        throw new AppError('Attendance marking is not open for this session', StatusCodes.BAD_REQUEST);
      }
      
      // Check if within marking window
      if (!session.isWithinMarkingWindow()) {
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
      await NotificationPublisher.publish('attendance.marked', {
        studentId: studentId.toString(),
        subjectId: session.subject._id.toString(),
        subjectName: session.subject.name,
        status: 'present',
        date: session.date,
        time: `${session.startTime} - ${session.endTime}`,
        percentage: attendanceStats.percentage
      });
      
      // Check for low attendance warning
      if (parseFloat(attendanceStats.percentage) < session.subject.attendanceConfig.warningThreshold) {
        await NotificationPublisher.publish('attendance.low_warning', {
          studentId: studentId.toString(),
          subjectId: session.subject._id.toString(),
          subjectName: session.subject.name,
          percentage: attendanceStats.percentage,
          threshold: session.subject.attendanceConfig.warningThreshold,
          required: session.subject.attendanceConfig.minimumPercentage
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
        
        // Update streaks
        for (const record of absentRecords) {
          await this.updateStreak(record.student, session.subject, false, null);
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
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log('Searching for sessions with:', {
        batch: student.batch,
        section: student.section,
        date: today
      });
      
      const sessions = await AttendanceSession.find({
        batch: student.batch,
        section: student.section,
        date: today,
        status: { $ne: 'cancelled' }
      })
        .populate('subject', 'name code')
        .sort({ startTime: 1 });
      
      console.log('Sessions found:', sessions.length);
      console.log('Sessions:', sessions);
      
      // Check attendance status for each session
      const sessionsWithStatus = await Promise.all(
        sessions.map(async session => {
          const attendance = await Attendance.findOne({
            student: studentIdStr,
            session: session._id
          });
          
          return {
            ...session.toObject(),
            attendanceMarked: !!attendance,
            attendanceStatus: attendance?.status || null,
            canMark: session.isMarkingOpen && session.isWithinMarkingWindow()
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
      
      const sessions = await AttendanceSession.find({
        batch: student.batch,
        section: student.section,
        date: today,
        status: 'active',
        isMarkingOpen: true,
        startTime: { $lte: currentTime },
        endTime: { $gte: currentTime }
      })
        .populate('subject', 'name code')
        .sort({ startTime: 1 })
        .limit(1);
      
      if (sessions.length === 0) return null;
      
      const session = sessions[0];
      
      // Check if student has marked attendance
      const attendance = await Attendance.findOne({
        student: studentIdStr,
        session: session._id
      });
      
      return {
        ...session.toObject(),
        attendanceMarked: !!attendance,
        attendanceStatus: attendance?.status || null,
        canMark: session.isWithinMarkingWindow()
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
      
      const sessions = await AttendanceSession.find({
        batch: student.batch,
        section: student.section,
        date: today,
        status: { $in: ['scheduled', 'active'] },
        startTime: { $gt: currentTime }
      })
        .populate('subject', 'name code')
        .sort({ startTime: 1 })
        .limit(1);
      
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
        } else {
          // Break streak on absence
          await streak.breakStreak();
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
