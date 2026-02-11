const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const WeeklySessionClass = require('../models/WeeklySessionClass');
const mongoose = require('mongoose');
const CacheService = require('./cache-service');

// Create new timetable (Admin/Local-Admin only)
async function createTimetable(data) {
  try {
    // Validate required fields
    if (!data.batch || !data.section || !data.schedule || !Array.isArray(data.schedule)) {
      throw new AppError('Batch, section, and schedule are required', StatusCodes.BAD_REQUEST);
    }

    if (data.schedule.length === 0) {
      throw new AppError('Schedule cannot be empty', StatusCodes.BAD_REQUEST);
    }

    // Find batch
    let batch;
    if (mongoose.Types.ObjectId.isValid(data.batch) && data.batch.length === 24) {
      batch = await Batch.findById(data.batch);
    } else {
      batch = await Batch.findOne({
        $or: [
          { program: data.batch },
          { _id: data.batch }
        ]
      });
    }

    if (!batch) {
      throw new AppError('Batch not found', StatusCodes.NOT_FOUND);
    }

    // Find section
    let section;
    if (mongoose.Types.ObjectId.isValid(data.section) && data.section.length === 24) {
      section = await Section.findById(data.section);
    } else {
      section = await Section.findOne({
        name: data.section,
        batch: batch._id
      });
    }

    if (!section) {
      throw new AppError('Section not found for this batch', StatusCodes.NOT_FOUND);
    }

    // Check if timetable already exists for this batch-section combination
    const existingTimetable = await Timetable.findOne({
      batch: batch._id,
      section: section._id
    });

    if (existingTimetable) {
      throw new AppError(
        'Timetable already exists for this batch and section. Use update instead.',
        StatusCodes.CONFLICT
      );
    }

    // Validate schedule items
    for (const classItem of data.schedule) {
      if (!classItem.day || !classItem.startTime || !classItem.endTime || !classItem.subject) {
        throw new AppError(
          'Each class must have day, startTime, endTime, and subject',
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Create timetable
    const timetable = new Timetable({
      batch: batch._id,
      section: section._id,
      schedule: data.schedule,
      validFrom: data.validFrom,
      validTo: data.validTo
    });

    await timetable.save();
    
    // Populate before returning
    await timetable.populate([
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);
    
    return timetable;
    
  } catch (error) {
    console.log("Error creating timetable:", error.message);
    if (error.code === 11000) {
      throw new AppError('Timetable already exists for this batch-section', StatusCodes.CONFLICT);
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get timetable by batch and section
async function getTimetable(batchId, sectionId) {
  try {
    // --- 1. REDIS CACHE CHECK ---
    const bId = batchId.toString();
    const sId = sectionId.toString();
    const cacheKey = `tt:${bId}:${sId}`;
    const cachedTT = await CacheService.get(cacheKey);
    if (cachedTT) return cachedTT;

    // Find batch
    let batch;
    if (mongoose.Types.ObjectId.isValid(batchId) && batchId.length === 24) {
      batch = await Batch.findById(batchId);
    } else {
      batch = await Batch.findOne({ program: batchId });
    }

    if (!batch) {
      throw new AppError('Batch not found', StatusCodes.NOT_FOUND);
    }

    // Find section
    let section;
    if (mongoose.Types.ObjectId.isValid(sectionId) && sectionId.length === 24) {
      section = await Section.findById(sectionId);
    } else {
      section = await Section.findOne({
        name: sectionId,
        batch: batch._id
      });
    }

    if (!section) {
      throw new AppError('Section not found', StatusCodes.NOT_FOUND);
    }

    const timetable = await Timetable.findOne({
      batch: batch._id,
      section: section._id
    }).populate([
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);

    if (!timetable) {
      throw new AppError('Timetable not found for this batch and section', StatusCodes.NOT_FOUND);
    }

    // --- 2. SAVE TO CACHE (TTL: 1 Hour) ---
    await CacheService.set(cacheKey, timetable, 3600);

    return timetable;
    
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get all timetables (with optional filters)
async function getAllTimetables(filters = {}) {
  try {
    const timetables = await Timetable.find(filters)
      .populate([
        { path: 'batch', select: 'program year college' },
        { path: 'section', select: 'name' }
      ])
      .sort({ 'batch.year': -1, 'batch.program': 1, 'section.name': 1 });
    
    return timetables;
  } catch (error) {
    throw new AppError('Error fetching timetables', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get timetable by ID
async function getTimetableById(id) {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    const timetable = await Timetable.findById(id)
      .populate([
        { path: 'batch', select: 'program year college', populate: { path: 'college', select: 'name collegeId' } },
        { path: 'section', select: 'name' }
      ]);

    if (!timetable) {
      throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
    }

    return timetable;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Update timetable
// async function updateTimetable(id, updateData) {
//   try {
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
//     }

//     // Validate schedule if being updated
//     if (updateData.schedule) {
//       if (!Array.isArray(updateData.schedule) || updateData.schedule.length === 0) {
//         throw new AppError('Schedule must be a non-empty array', StatusCodes.BAD_REQUEST);
//       }

//       for (const classItem of updateData.schedule) {
//         if (!classItem.day || !classItem.startTime || !classItem.endTime || !classItem.subject) {
//           throw new AppError(
//             'Each class must have day, startTime, endTime, and subject',
//             StatusCodes.BAD_REQUEST
//           );
//         }
//       }
//     }

//     const timetable = await Timetable.findByIdAndUpdate(
//       id,
//       { $set: updateData },
//       { new: true, runValidators: true }
//     ).populate([
//       { path: 'batch', select: 'program year' },
//       { path: 'section', select: 'name' }
//     ]);

//     if (!timetable) {
//       throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
//     }

//     return timetable;
//   } catch (error) {
//     if (error instanceof AppError) throw error;
//     throw new AppError('Error updating timetable', StatusCodes.INTERNAL_SERVER_ERROR);
//   }
// }

// Update timetable
async function updateTimetable(timetableId, updateData, adminId) {
  try {
    const timetable = await Timetable.findById(timetableId)
      .populate('batch')
      .populate('section');

    if (!timetable) {
      throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
    }

    // Update timetable
    Object.assign(timetable, updateData);
    timetable.lastUpdated = new Date();
    await timetable.save();

    // 1. ✅ Sync subjects with updated timetable
    console.log('🔄 Syncing subjects with updated timetable...');
    const subjectResult = await SubjectService.syncSubjectsWithTimetable(timetableId);
    
    // 2. 🔄 SYNC CURRENT WEEK SESSIONS
    // Delete future scheduled sessions derived from old blueprint
    const WeeklySessionClass = require('../models/WeeklySessionClass');
    const WeeklySessionService = require('./weekly-session-service');
    
    // Check if we need to regenerate sessions (only if schedule changed)
    if (updateData.schedule) {
        console.log('🔄 Schedule changed. Regenerating future sessions for this week...');
        
        // Delete "scheduled" classes from today onwards that haven't started attendance
        const deleteResult = await WeeklySessionClass.deleteMany({
            batch: timetable.batch._id,
            section: timetable.section._id,
            date: { $gte: new Date().setHours(0,0,0,0) }, // Today onwards
            status: 'scheduled',
            isMarkingOpen: false 
        });
        
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} old sessions.`);

        // Regenerate sessions for this week (idempotent)
        await WeeklySessionService.generateForWeek(new Date());
    }

    console.log(`✅ Subjects synced:
      - Created: ${subjectResult.created.length}
      - Updated: ${subjectResult.updated.length}
    `);

    // 3. 📣 Notify students
    const User = require('../models/User');
    const students = await User.find({
      batch: timetable.batch._id,
      section: timetable.section._id,
      role: 'student'
    }).select('_id');

    if (students.length > 0) {
      const NotificationPublisher = require('./notification-publisher'); // Require inside to avoid circular deps if any
      await NotificationPublisher.publishTimetableUpdated({
        studentIds: students.map(s => s._id.toString()),
        timetableId: timetable._id.toString(),
        batchName: timetable.batch.program,
        sectionName: timetable.section.name,
        subjectsAffected: subjectResult.summary.totalSubjects,
        message: `The timetable for ${timetable.batch.program} (${timetable.section.name}) has been updated. Future classes for this week have been synced.`
      });
    }

    return {
      timetable,
      subjects: subjectResult
    };
  } catch (error) {
    throw error;
  }
}

// Add a single class to existing timetable
async function addClass(timetableId, classData) {
  try {
    if (!mongoose.Types.ObjectId.isValid(timetableId)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    // Validate class data
    if (!classData.day || !classData.startTime || !classData.endTime || !classData.subject) {
      throw new AppError(
        'Class must have day, startTime, endTime, and subject',
        StatusCodes.BAD_REQUEST
      );
    }

    const timetable = await Timetable.findByIdAndUpdate(
      timetableId,
      { $push: { schedule: classData } },
      { new: true, runValidators: true }
    ).populate([
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);

    if (!timetable) {
      throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
    }

    return timetable;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding class to timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Update a single class in timetable (Blueprint Edit)
async function updateClass(timetableId, classId, updateData) {
  try {
    if (!mongoose.Types.ObjectId.isValid(timetableId)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);

    const classDoc = timetable.schedule.id(classId);
    if (!classDoc) throw new AppError('Class not found in timetable', StatusCodes.NOT_FOUND);

    // Capture old state for response/notification
    const oldClass = {
        subject: classDoc.subject,
        day: classDoc.day,
        startTime: classDoc.startTime,
        endTime: classDoc.endTime
    };

    // Update fields
    if(updateData.subject) classDoc.subject = updateData.subject;
    if(updateData.day) classDoc.day = updateData.day;
    if(updateData.startTime) classDoc.startTime = updateData.startTime;
    if(updateData.endTime) classDoc.endTime = updateData.endTime;
    if(updateData.room) classDoc.room = updateData.room;
    if(updateData.type) classDoc.type = updateData.type;
    if(updateData.teacher) classDoc.teacher = updateData.teacher;

    await timetable.save();

    // Clean up future sessions derived from this blueprint (Old versions)
    // The classId (templateId) remains the same, so we just clear future slots 
    // to allow regeneration or avoid ghost sessions.
    const deleteResult = await WeeklySessionClass.deleteMany({
        templateId: classId,
        date: { $gte: new Date().setHours(0,0,0,0) },
        status: 'scheduled',
        isMarkingOpen: false
    });
    
    console.log(`♻️ Updated blueprint class. Removed ${deleteResult.deletedCount} future sessions.`);

    return { 
        timetable, 
        oldClass, 
        newClass: {
            subject: classDoc.subject,
            day: classDoc.day,
            startTime: classDoc.startTime,
            endTime: classDoc.endTime
        }
    };

  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(error);
    throw new AppError('Error updating class in timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Remove a class from timetable
async function removeClass(timetableId, classId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(timetableId)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    // Find first to get details
    const originalTimetable = await Timetable.findById(timetableId);
    if (!originalTimetable) throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);

    const classDoc = originalTimetable.schedule.id(classId);
    const removedClassDetails = classDoc ? {
        subject: classDoc.subject,
        day: classDoc.day,
        startTime: classDoc.startTime,
        endTime: classDoc.endTime
    } : null;

    const timetable = await Timetable.findByIdAndUpdate(
      timetableId,
      { $pull: { schedule: { _id: classId } } },
      { new: true }
    ).populate([
      { path: 'batch', select: 'program year' },
      { path: 'section', select: 'name' }
    ]);

    // Clean up future scheduled sessions derived from this blueprint
    const deleteResult = await WeeklySessionClass.deleteMany({
        templateId: classId,
        date: { $gte: new Date().setHours(0,0,0,0) }, // From today onwards
        status: 'scheduled',
        isMarkingOpen: false // Don't delete if attendance has started
    });

    console.log(`🗑️ Removed ${deleteResult.deletedCount} future sessions linked to blueprint class ${classId}`);

    return { timetable, removedClass: removedClassDetails };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error removing class from timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get timetable by day
async function getTimetableByDay(timetableId, day) {
  try {
    if (!mongoose.Types.ObjectId.isValid(timetableId)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    const timetable = await Timetable.findById(timetableId)
      .populate([
        { path: 'batch', select: 'program year' },
        { path: 'section', select: 'name' }
      ]);

    if (!timetable) {
      throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
    }

    const daySchedule = timetable.schedule.filter(
      classItem => classItem.day.toLowerCase() === day.toLowerCase()
    );

    return {
      batch: timetable.batch,
      section: timetable.section,
      day: day,
      classes: daySchedule.sort((a, b) => a.startTime.localeCompare(b.startTime))
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching day schedule', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Delete timetable
async function deleteTimetable(id) {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    const timetable = await Timetable.findByIdAndDelete(id);

    if (!timetable) {
      throw new AppError('Timetable not found', StatusCodes.NOT_FOUND);
    }

    return { message: 'Timetable deleted successfully' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting timetable', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get timetables by college
async function getTimetablesByCollege(collegeId) {
  try {
    const batches = await Batch.find({ college: collegeId }).select('_id');
    const batchIds = batches.map(b => b._id);

    const timetables = await Timetable.find({ batch: { $in: batchIds } })
      .populate([
        { path: 'batch', select: 'program year', populate: { path: 'college', select: 'name collegeId' } },
        { path: 'section', select: 'name' }
      ])
      .sort({ 'batch.year': -1, 'batch.program': 1 });

    return timetables;
  } catch (error) {
    throw new AppError('Error fetching college timetables', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  createTimetable,
  getTimetable,
  getAllTimetables,
  getTimetableById,
  updateTimetable,
  addClass,
  removeClass,
  updateClass,
  getTimetableByDay,
  deleteTimetable,
  getTimetablesByCollege
};