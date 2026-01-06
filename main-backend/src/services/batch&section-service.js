const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const College = require('../models/College')
const mongoose = require('mongoose');


// Create new batch (Admin only)
async function createBatch(data) {
  try {
    // Validate required fields
    if (!data.program || !data.year || !data.college) {
      throw new AppError('Program, year, and college are required', StatusCodes.BAD_REQUEST);
    }

    // Find college by collegeId or name
    let college;
    
    // Check if it's already an ObjectId
    if (mongoose.Types.ObjectId.isValid(data.college) && data.college.length === 24) {
      college = await College.findById(data.college);
    } else {
      // Search by collegeId or name
      college = await College.findOne({
        $or: [
          { collegeId: data.college },
          { name: data.college }
        ]
      });
    }

    if (!college) {
      throw new AppError(
        `College "${data.college}" not found. Please provide a valid college ID or name.`,
        StatusCodes.NOT_FOUND
      );
    }

    // Check if college is active
    if (!college.isActive) {
      throw new AppError('This college is currently inactive', StatusCodes.FORBIDDEN);
    }

    // ✅ FIX: Check if batch already exists using correct fields
    const existingBatch = await Batch.findOne({
      program: data.program,
      year: data.year,
      college: college._id
    });

    if (existingBatch) {
      throw new AppError(
        `Batch "${data.program} ${data.year}" already exists for ${college.name}`,
        StatusCodes.CONFLICT
      );
    }

    // Create batch with college ObjectId
    const batch = new Batch({
      program: data.program,
      college: college._id,
      year: data.year,
      createdBy: data.adminId
    });

    await batch.save();
    
    // Populate college details before returning
    await batch.populate('college', 'name collegeId location');
    
    return batch;
    
  } catch (error) {
    console.log(error);
    console.log("Error creating batch:", error.message);
    if (error.code === 11000) {
      throw new AppError('This batch already exists', StatusCodes.CONFLICT);
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating batch', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get batches (optionally filtered by collegeId)
async function getBatches(query) {
  try {
    const filter = {};
    
    // If collegeId is provided in query, filter by it
    if (query.collegeId) {
      if (mongoose.Types.ObjectId.isValid(query.collegeId)) {
         filter.college = query.collegeId;
      } else {
         // If passed ID is custom string ID (like "IIITR"), find the college _id first
         // Or if 'collegeId' string in model matches
         const college = await College.findOne({ collegeId: query.collegeId });
         if (college) {
             filter.college = college._id;
         } else {
             // Return empty if college not found matching custom ID
             return [];
         }
      }
    }

    const batches = await Batch.find(filter).populate('college', 'name collegeId');
    return batches;

  } catch (error) {
    console.log("Error fetching batches:", error.message);
    throw new AppError('Error fetching batches', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function createSection(data) {
  try {
    if (!data.adminId) {
      throw new AppError('Admin ID is required to create a Section', StatusCodes.BAD_REQUEST);
    }

    if (!data.name || !data.batch) {
      throw new AppError('Section name and batch are required', StatusCodes.BAD_REQUEST);
    }

    // Find batch by ObjectId or name
    let batch;
    if (mongoose.Types.ObjectId.isValid(data.batch) && data.batch.length === 24) {
      batch = await Batch.findById(data.batch);
    } else {
      // Search by batch name/program
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

    // ✅ Check if section already exists for this batch
    const existingSection = await Section.findOne({
      name: data.name,
      batch: batch._id
    });

    if (existingSection) {
      throw new AppError(
        `Section "${data.name}" already exists for this batch`,
        StatusCodes.CONFLICT
      );
    }

    const section = new Section({
      batch: batch._id,
      name: data.name,
      createdBy: data.adminId
    });

    await section.save();
    
    // Populate batch details
    await section.populate('batch', 'program year');
    
    return section;
  } catch (error) {
    console.log("Error creating section:", error.message);
    if (error.code === 11000) {
      throw new AppError('Section already exists', StatusCodes.CONFLICT);
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating section', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get sections (optionally filtered by batchId)
async function getSections(query) {
  try {
    const filter = {};
    if (query.batchId) {
        // If batchId corresponds to _id
       if (mongoose.Types.ObjectId.isValid(query.batchId)) {
        filter.batch = query.batchId;
       } else {
         return[]
           // If 'batch' in query is something else (like year/program), logic is complex without college context.
           // Assuming frontend sends the Batch's _id selected from the Batch Dropdown.
           // So minimal logic here: filter by _id if provided.
       }
    }

    const sections = await Section.find(filter).populate('batch', 'program year');
    return sections;

  } catch (error) {
    console.log("Error fetching sections:", error.message);
    throw new AppError('Error fetching sections', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}


module.exports = {
  createBatch,
  createSection,
  getBatches,
  getSections
};