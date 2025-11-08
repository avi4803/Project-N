const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const College = require('../models/College');

// Create new college (Admin only)
async function createCollege(data) {
  try {

    if (!data.adminId) {
      throw new AppError('Admin ID is required to create a college', StatusCodes.BAD_REQUEST);
    }

    const college = new College({
      name: data.name,
      collegeId:data.collegeId,
      location: data.location,
      website: data.website,
      allowedEmailDomains: data.allowedEmailDomains || [],
      createdBy: data.adminId // This field should be a valid MongoDB ObjectId
    });

    await college.save();
    return college;
  } catch (error) {
    console.log("Error creating college:", error.message);
    if (error.code === 11000) {
      throw new AppError('College ID already exists', StatusCodes.CONFLICT);
    }
    throw new AppError('Error creating college', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get all colleges
async function getAllColleges() {
  try {
    const colleges = await College.find({ isActive: true })
      .select('-registeredEmails')
      .sort({ name: 1 });
    return colleges;
  } catch (error) {
    throw new AppError('Error fetching colleges', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get college by ID with statistics
async function getCollegeById(collegeId) {
  try {
    const college = await College.findOne({ collegeId }).populate('createdBy', 'name email');
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    const stats = {
      ...college.toObject(),
      registeredEmailsCount: college.getRegisteredEmailsCount()
    };
    
    return stats;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching college details', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get registered emails for a college
async function getRegisteredEmails(collegeId) {
  try {
    const college = await College.findOne({ collegeId })
      .populate('registeredEmails.userId', 'name email batch section')
      .select('name collegeId registeredEmails');
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return {
      collegeName: college.name,
      collegeId: college.collegeId,
      totalRegistrations: college.registeredEmails.length,
      registeredEmails: college.registeredEmails
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching registered emails', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Update college
async function updateCollege(collegeId, updateData) {
  try {
    const college = await College.findOneAndUpdate(
      { collegeId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return college;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating college', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Delete/Deactivate college
async function deactivateCollege(collegeId) {
  try {
    const college = await College.findOneAndUpdate(
      { collegeId },
      { $set: { isActive: false } },
      { new: true }
    );
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return college;
  } catch (error) {
    throw new AppError('Error deactivating college', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  createCollege,
  getAllColleges,
  getCollegeById,
  getRegisteredEmails,
  updateCollege,
  deactivateCollege
};