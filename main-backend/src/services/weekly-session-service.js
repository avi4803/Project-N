const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const Timetable = require('../models/Timetable');
const WeeklySession = require('../models/WeeklySession');
const WeeklySessionClass = require('../models/WeeklySessionClass');
const Subject = require('../models/Subject');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { publishNotification } = require('./notification-publisher');
const reminderQueue = require('../config/reminder-queue');
const CacheService = require('./cache-service');

class WeeklySessionService {

  /**
   * Schedule 10, 15, 30 min reminders for a class
   */
  async scheduleReminders(cls) {
    try {
        const offsets = [10, 15, 30];
        const [hours, minutes] = cls.startTime.split(':').map(Number);
        
        // Construct precise start time
        const classTime = new Date(cls.date);
        classTime.setHours(hours, minutes, 0, 0);

        for (const offset of offsets) {
            const reminderTime = new Date(classTime.getTime() - offset * 60000);
            const delay = reminderTime.getTime() - Date.now();

            if (delay > 0) {
                // Job Data
                const jobData = {
                    classId: cls._id.toString(),
                    offsetMinutes: offset,
                    sectionId: cls.section._id || cls.section,
                    batchId: cls.batch._id || cls.batch,
                    subjectId: cls.subject
                };

                // Job Options (Deterministic ID to easier removal)
                const jobId = `remind:${offset}:${cls._id.toString()}`;

                await reminderQueue.add(jobData, {
                    delay,
                    jobId, // Allows overwriting/removal
                    attempts: 2
                });
            }
        }
       // console.log(`⏰ Scheduled reminders for class ${cls.title || cls.subject} (${cls.startTime})`);
    } catch (error) {
        console.error('Failed to schedule reminders:', error);
    }
  }

  /**
   * Remove pending reminders for a class
   */
  async cancelReminders(classId) {
    try {
        const offsets = [10, 15, 30];
        for (const offset of offsets) {
            const jobId = `remind:${offset}:${classId}`;
            const job = await reminderQueue.getJob(jobId);
            if (job) {
                await job.remove();
            }
        }
        // console.log(`🗑️  Cancelled reminders for class ${classId}`);
    } catch (error) {
        console.error('Failed to cancel reminders:', error);
    }
  }

  /**
   * Calculate week number and year from date
   */
  getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
  }

  /**
   * Generate weekly sessions for all active timetables for a given start date (Monday)
   */
  async generateForWeek(startDateInput) {
    // --- IST-Aware Week Calculation ---
    // Force all input to be treated relative to Indian Time
    const istTime = new Date(startDateInput.getTime() + (5.5 * 60 * 60 * 1000));
    
    // Find Monday of the current week in IST
    const day = istTime.getUTCDay();
    const diff = istTime.getUTCDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(istTime);
    monday.setUTCDate(diff);
    monday.setUTCHours(0,0,0,0);
    
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);

    const [year, weekNumber] = this.getWeekNumber(monday);

    console.log(`🔄 Generating Weekly Sessions for Week ${weekNumber}, ${year} (${monday.toDateString()} - ${sunday.toDateString()})`);

    // Fetch all active timetables with batch populated to access college
    const timetables = await Timetable.find({ isActive: true }).populate({path: 'batch', select: 'college'});

    let createdCount = 0;

    for (const timetable of timetables) {
      try {
        // 1. Create or Find WeeklySession Container
        let session = await WeeklySession.findOne({
          batch: timetable.batch._id, // batch is populated
          section: timetable.section,
          year,
          weekNumber
        });

        if (!session) {
          // Get college from populated batch
          const college = timetable.batch.college; 
          
          if (!college) {
             console.warn(`⚠️ Batch ${timetable.batch._id} has no college linked. Skipping session generation.`);
             continue;
          }

          session = await WeeklySession.create({
            batch: timetable.batch._id,
            section: timetable.section,
            college: college,
            startDate: monday,
            endDate: sunday,
            year,
            weekNumber
          });
        }

        // 2. Map Template Classes to Real Dates
        const templateClasses = timetable.schedule;
        const daysMap = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6 };

        for (const cls of templateClasses) {
            // Calculate actual date for this class
            const dayIndex = daysMap[cls.day];
            if (dayIndex === undefined) continue; // Invalid day name

            const classDate = new Date(monday);
            classDate.setDate(monday.getDate() + dayIndex);

            // Check if class already exists (idempotency)
            const existingClass = await WeeklySessionClass.findOne({
                weeklySession: session._id,
                templateId: cls._id,
                date: classDate,
                startTime: cls.startTime
            });

            if (existingClass) continue;

            // Find subject ID
            const subjectDoc = await Subject.findOne({
                name: cls.subject,
                batch: timetable.batch._id,
                section: timetable.section
            });
            
            if (!subjectDoc) {
                console.warn(`⚠️ Subject '${cls.subject}' not found for batch ${timetable.batch._id}. Skipping class.`);
                continue;
            }

            const newClass = await WeeklySessionClass.create({
                weeklySession: session._id,
                templateId: cls._id,
                title: cls.subject, 
                subject: subjectDoc._id,
                batch: timetable.batch._id,
                section: timetable.section,
                college: session.college, 
                date: classDate,
                dayNum: istComp.day,
                monthNum: istComp.month,
                yearNum: istComp.year,
                dateString: istComp.dateString,
                day: cls.day,
                startTime: cls.startTime,
                endTime: cls.endTime,
                room: cls.room,
                type: cls.type || 'Lecture',
                status: 'scheduled'
            });

            // Schedule Reminders
            this.scheduleReminders(newClass);
        }


        createdCount++;

      } catch (err) {
        console.error(`❌ Error generating session for timetable ${timetable._id}:`, err);
      }
    }

    return { weekNumber, year, generatedSessions: createdCount };
  }

  // ================= CHANGE MANAGEMENT =================

  async cancelClass(classId, reason, currentUser) {
    const cls = await WeeklySessionClass.findById(classId)
        .populate('subject batch section');
    if (!cls) throw new AppError('Class not found', StatusCodes.NOT_FOUND);

    if (cls.status === 'cancelled') {
        throw new AppError('Class is already cancelled', StatusCodes.BAD_REQUEST);
    }

    // Prevent past class modification (Timezone-Agnostic Numeric Validation)
    const [h, m] = cls.startTime.split(':').map(Number);
    // Construct class start as a local Date object based on stored IST numbers
    const classStart = new Date(cls.yearNum, cls.monthNum - 1, cls.dayNum, h, m);
    
    // Construct "Now" in the same local context (Server's current actual time)
    // If the server and students are in different TZs, we compare actual timestamps
    // However, the most robust way is to compare absolute epoch timestamps.
    const now = new Date();
    
    // We need to calculate the EXACT timestamp of the class in IST
    // yearNum, monthNum, dayNum are IST.
    const classTimestamp = new Date(`${cls.yearNum}-${String(cls.monthNum).padStart(2,'0')}-${String(cls.dayNum).padStart(2,'0')}T${cls.startTime}:00+05:30`);

    if (classTimestamp < now) {
        throw new AppError('This class has passed', StatusCodes.BAD_REQUEST);
    }

    cls.status = 'cancelled';
    cls.cancellationReason = reason;
    await cls.save();

    // Cancel pending reminders
    await this.cancelReminders(classId);

    // 📣 Notify Section (Smart Routing)
    // Always target the section the class belongs to
    const batchId = cls.batch._id.toString();
    const sectionId = cls.section._id.toString();

    const dateFormatted = new Date(cls.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    
    await publishNotification('CLASS_CANCELLED', {
        batchId,
        sectionId,
        title: 'Class Cancelled',
        message: `${cls.subject.name} on ${dateFormatted} at ${cls.startTime} - ${cls.endTime} has been cancelled.`,
        subjectName: cls.subject.name,
        date: dateFormatted,
        time: `${cls.startTime} - ${cls.endTime}`,
        reason
    });

    // 🚀 Invalidate Cache
    await this.invalidateDashboardCache(cls.batch._id, cls.section._id);

    return cls;
  }

  async rescheduleClass(classId, newDate, newStartTime, newEndTime, room, currentUser) {
    console.log(`🚀 Rescheduling Class ${classId} to ${newDate} ${newStartTime}`);
    const cls = await WeeklySessionClass.findById(classId)
        .populate('subject batch section');
    if (!cls) throw new AppError('Class not found', StatusCodes.NOT_FOUND);

    const oldDate = cls.date;
    const oldTime = cls.startTime;
    
    // Prevent past class modification (Timezone-Agnostic Numeric Validation)
    const classTimestamp = new Date(`${cls.yearNum}-${String(cls.monthNum).padStart(2,'0')}-${String(cls.dayNum).padStart(2,'0')}T${cls.startTime}:00+05:30`);
    
    if (classTimestamp < new Date()) {
        throw new AppError('This class has passed', StatusCodes.BAD_REQUEST);
    }

    const targetDate = new Date(newDate);
    targetDate.setHours(0, 0, 0, 0);

    // Date limit validation handled by middleware


    // Check if target date is in the same week
    const [currentYear, currentWeek] = this.getWeekNumber(oldDate);
    const [targetYear, targetWeek] = this.getWeekNumber(targetDate);

    // 1. Mark current class as 'rescheduled'
    const istCompNew = this.getISTComponents(targetDate);
    const oldStatus = cls.status;
    cls.status = 'rescheduled';
    cls.cancellationReason = `Rescheduled to ${targetDate.toDateString()} at ${newStartTime}`;
    await cls.save();

    // 2. Ensure target week session exists (for cross-week or first class of week)
    let targetSession = await WeeklySession.findOne({
        batch: cls.batch._id,
        section: cls.section._id,
        year: targetYear,
        weekNumber: targetWeek
    });

    if (!targetSession) {
        console.log(`Target week session not found. Auto-generating for Week ${targetWeek}...`);
        await this.generateForWeek(targetDate);
        targetSession = await WeeklySession.findOne({
            batch: cls.batch._id,
            section: cls.section._id,
            year: targetYear,
            weekNumber: targetWeek
        });
    }

    // 3. Create NEW class record
    const newClass = await WeeklySessionClass.create({
        weeklySession: targetSession._id,
        templateId: cls.templateId, 
        title: cls.title,
        subject: cls.subject._id,
        batch: cls.batch._id,
        section: cls.section._id,
        college: cls.college,
        date: targetDate,
        dayNum: istCompNew.day,
        monthNum: istCompNew.month,
        yearNum: istCompNew.year,
        dateString: istCompNew.dateString,
        day: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
        startTime: newStartTime,
        endTime: newEndTime,
        room: room || cls.room,
        type: cls.type,
        status: 'scheduled',
        isExtraClass: true
    });

    // 4. Update reminders
    await this.cancelReminders(classId);
    await this.scheduleReminders(newClass);

    // Determine reschedule type (Postponed vs Preponed)
    // Construct simplified Date objects for comparison
    // Note: oldDate and targetDate are Date objects (00:00 time). We need to combine with startTime string (HH:MM)
    const [oldHours, oldMinutes] = oldTime.split(':').map(Number);
    const oldFullDate = new Date(oldDate);
    oldFullDate.setHours(oldHours, oldMinutes);

    const [newHours, newMinutes] = newStartTime.split(':').map(Number);
    const newFullDate = new Date(targetDate);
    newFullDate.setHours(newHours, newMinutes);

    let updateType = 'Rescheduled';
    if (newFullDate > oldFullDate) updateType = 'Postponed';
    else if (newFullDate < oldFullDate) updateType = 'Preponed';
    
    console.log(`Class ${updateType}: ${oldTime} -> ${newStartTime}`);

    // 📣 Notify Section (Smart Routing)
    // Always target the section the class belongs to
    const batchId = cls.batch._id.toString();
    const sectionId = cls.section._id.toString();

    const oldDateFormatted = new Date(oldDate).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const newDateFormatted = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    
    await publishNotification('CLASS_RESCHEDULED', {
        batchId,
        sectionId,
        title: 'Class Rescheduled',
        message: `RESCHEDULED: ${cls.subject.name} to ${newDateFormatted} at ${newStartTime} - ${newEndTime}`,
        subjectName: cls.subject.name,
        oldDate: oldDateFormatted,
        oldTime,
        newDate: newDateFormatted,
        newTime: `${newStartTime} - ${newEndTime}`,
        rescheduleType: updateType
    });

    // 🚀 Invalidate Cache
    await this.invalidateDashboardCache(batchId, sectionId);

    return cls;
  }

  async addExtraClass(data, currentUser) {
    // data: { batchId, sectionId, subjectId, date, startTime, endTime, room, type }
    
    let { batchId, sectionId, subjectId, date, startTime, endTime, room, type = 'Extra' } = data;

    // Fallback to currentUser context if batch/section are missing
    if (!batchId && currentUser?.batch) batchId = currentUser.batch;
    if (!sectionId && currentUser?.section) sectionId = currentUser.section;

    if (!batchId || !sectionId) {
        throw new AppError('Batch and Section ID are required and could not be determined from user context.', StatusCodes.BAD_REQUEST);
    }

    // 1. Normalize Date to Local Midnight
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Date limit validation handled by middleware


    const [year, weekNumber] = this.getWeekNumber(dateObj);
    
    let session = await WeeklySession.findOne({
      batch: batchId,
      section: sectionId,
      year,
      weekNumber
    });

    if (!session) {
      console.log(`⚠️ Weekly session not found for Week ${weekNumber}, ${year}. Auto-generating...`);
      await this.generateForWeek(dateObj);
      
      
      session = await WeeklySession.findOne({
          batch: batchId,
          section: sectionId,
          year,
          weekNumber
      });

      if (!session) {
           console.log(`⚠️ No active timetable found. Creating ad-hoc session container for extra class.`);
           
           const batchDoc = await Batch.findById(batchId);
           if (!batchDoc) throw new AppError('Batch not found', StatusCodes.NOT_FOUND);

           // Calculate Week Start/End
           const d = new Date(dateObj);
           const day = d.getDay();
           const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
           const monday = new Date(d.setDate(diff));
           monday.setHours(0,0,0,0);
           
           const sunday = new Date(monday);
           sunday.setDate(monday.getDate() + 6);
           sunday.setHours(23, 59, 59, 999);

           session = await WeeklySession.create({
            batch: batchId,
            section: sectionId,
            college: batchDoc.college,
            startDate: monday,
            endDate: sunday,
            year,
            weekNumber
          });
      }
    }

    const subject = await Subject.findById(subjectId);
    if(!subject) throw new AppError('Subject not found', StatusCodes.NOT_FOUND);

    const istComp = this.getISTComponents(dateObj);

    const newClass = await WeeklySessionClass.create({
        weeklySession: session._id,
        title: subject.name + (type ? ` (${type})` : ''),
        subject: subjectId,
        batch: batchId,
        section: sectionId,
        college: session.college,
        date: dateObj,
        dayNum: istComp.day,
        monthNum: istComp.month,
        yearNum: istComp.year,
        day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        startTime,
        endTime,
        room: room || '',
        type: type || 'Extra',
        status: 'scheduled',
        isExtraClass: true
    });

    // 📣 Notify Section (Smart Routing)
    const targetBatch = (batchId._id || batchId).toString();
    const targetSection = (sectionId._id || sectionId).toString();

    const dateFormatted = new Date(dateObj).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    
    await publishNotification('CLASS_ADDED', {
        batchId: targetBatch,
        sectionId: targetSection,
        title: 'New Class Added',
        message: `${subject.name} on ${dateFormatted} at ${startTime} - ${endTime}`,
        subjectName: subject.name,
        date: dateFormatted,
        time: `${startTime} - ${endTime}`
    });


    this.scheduleReminders(newClass);

    // 🚀 Invalidate Cache
    await this.invalidateDashboardCache(targetBatch, targetSection);

    return newClass;
  }

  async deleteSessionClass(classId) {
    const cls = await WeeklySessionClass.findById(classId).populate('subject batch section');
    if (!cls) throw new AppError('Class not found', StatusCodes.NOT_FOUND);

    // Safety Check: Don't delete if attendance data exists
    const Attendance = require('../models/Attendance');
    const hasAttendance = await Attendance.exists({ session: classId });
    if (hasAttendance) {
        throw new AppError('Cannot delete class that has attendance records. Please cancel it instead.', StatusCodes.BAD_REQUEST);
    }

    // Prevent past class deletion (Timezone-Agnostic Numeric Validation)
    const classTimestamp = new Date(`${cls.yearNum}-${String(cls.monthNum).padStart(2,'0')}-${String(cls.dayNum).padStart(2,'0')}T${cls.startTime}:00+05:30`);
    
    if (classTimestamp < new Date()) {
        throw new AppError('This class has passed', StatusCodes.BAD_REQUEST);
    }

    // Cancel reminders
    await this.cancelReminders(classId);

    // Delete
    await WeeklySessionClass.findByIdAndDelete(classId);

    // 📣 Notify Section
    try {
        const batchId = cls.batch._id.toString();
        const sectionId = cls.section._id.toString();
        const dateFormatted = new Date(cls.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        await publishNotification('CLASS_CANCELLED', {
            batchId,
            sectionId,
            title: 'Class Removed',
            message: `${cls.subject.name} on ${dateFormatted} at ${cls.startTime} has been removed from the schedule.`,
            subjectName: cls.subject.name,
            reason: 'Class removed from schedule'
        });
    } catch (err) {
        console.error('Failed to send notification for class deletion:', err);
    }

    // 🚀 Invalidate Cache
    this.invalidateDashboardCache(cls.batch._id, cls.section._id);

    return { message: 'Class deleted successfully' };
  }

  async getSessionForWeek(batchId, sectionId, date) {
      const dateObj = new Date(date || new Date());
      const [year, weekNumber] = this.getWeekNumber(dateObj);

      const session = await WeeklySession.findOne({
          batch: batchId,
          section: sectionId,
          year,
          weekNumber
      });

      if (!session) return null;

      const classes = await WeeklySessionClass.find({ weeklySession: session._id })
        .populate('subject', 'name code')
        .sort({ date: 1, startTime: 1 });

      return { session, classes };
  }

  /**
   * Helper to extract IST day, month, year from any date object
   * Correctly handles timezone shifts regardless of server location
   */
  getISTComponents(date) {
      const istStr = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' });
      const [m, d, y] = istStr.split('/').map(Number);
      const dateString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { day: d, month: m, year: y, dateString };
  }

  /**
   * Clears the dashboard and next-class cache for all students in a section
   * Called whenever a class is added, removed, or modified.
   */
  async invalidateDashboardCache(batchId, sectionId) {
      try {
          // 1. Find all students in this section
          const students = await User.find({ batch: batchId, section: sectionId }, '_id');
          if (students.length === 0) return;

          console.log(`🧹 Invalidating cache for ${students.length} students in Section ${sectionId}`);

          // 2. Pattern to clear all date variants (today and future shifts)
          // We use delByPattern for the specific user's dashboard-related keys
          const deletePromises = students.map(student => {
              const id = student._id.toString();
              return [
                  CacheService.delByPattern(`user:${id}:dashboard:*`),
                  CacheService.delByPattern(`user:${id}:next-class:*`),
                  CacheService.del(`user:${id}:active-class`),
                  CacheService.del(`user:${id}:full-dashboard`)
              ];
          }).flat();

          await Promise.all(deletePromises);
      } catch (err) {
          console.error('Failed to invalidate section cache:', err);
      }
  }
}

module.exports = new WeeklySessionService();
