const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const Timetable = require('../models/Timetable');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const mongoose = require('mongoose');

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
async function updateTimetable(id, updateData) {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    // Validate schedule if being updated
    if (updateData.schedule) {
      if (!Array.isArray(updateData.schedule) || updateData.schedule.length === 0) {
        throw new AppError('Schedule must be a non-empty array', StatusCodes.BAD_REQUEST);
      }

      for (const classItem of updateData.schedule) {
        if (!classItem.day || !classItem.startTime || !classItem.endTime || !classItem.subject) {
          throw new AppError(
            'Each class must have day, startTime, endTime, and subject',
            StatusCodes.BAD_REQUEST
          );
        }
      }
    }

    const timetable = await Timetable.findByIdAndUpdate(
      id,
      { $set: updateData },
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
    throw new AppError('Error updating timetable', StatusCodes.INTERNAL_SERVER_ERROR);
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

// Remove a class from timetable
async function removeClass(timetableId, classId) {
  try {
    if (!mongoose.Types.ObjectId.isValid(timetableId)) {
      throw new AppError('Invalid timetable ID', StatusCodes.BAD_REQUEST);
    }

    const timetable = await Timetable.findByIdAndUpdate(
      timetableId,
      { $pull: { schedule: { _id: classId } } },
      { new: true }
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
  getTimetableByDay,
  deleteTimetable,
  getTimetablesByCollege
};