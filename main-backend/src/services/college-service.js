const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const College = require('../models/College');
const mongoose = require('mongoose');

// Create new college (Admin only)
async function createCollege(data) {
  try {
    if (!data.adminId) {
      throw new AppError('Admin ID is required to create a college', StatusCodes.BAD_REQUEST);
    }

    // Check if college with same collegeId already exists
    const existingCollege = await College.findOne({ collegeId: data.collegeId });
    if (existingCollege) {
      throw new AppError('College with this ID already exists', StatusCodes.CONFLICT);
    }

    const college = new College({
      name: data.name,
      collegeId: data.collegeId,
      location: data.location,
      website: data.website,
      allowedEmailDomains: data.allowedEmailDomains || [],
      createdBy: data.adminId
    });

    await college.save();
    
    // Populate createdBy before returning
    await college.populate('createdBy', 'name email');
    
    return college;
  } catch (error) {
    console.log("Error creating college:", error.message);
    if (error.code === 11000) {
      throw new AppError('College ID already exists', StatusCodes.CONFLICT);
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating college', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get all colleges
async function getAllColleges() {
  try {
    const colleges = await College.find({ isActive: true })
      .select('-registeredEmails')
      .populate('createdBy', 'name email')
      .sort({ name: 1 });
    return colleges;
  } catch (error) {
    throw new AppError('Error fetching colleges', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get college by ID/collegeId with statistics
async function getCollegeById(identifier) {
  try {
    let college;
    
    // Check if identifier is MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findById(identifier).populate('createdBy', 'name email');
    } else {
      // Search by collegeId
      college = await College.findOne({ collegeId: identifier }).populate('createdBy', 'name email');
    }
    
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
async function getRegisteredEmails(identifier) {
  try {
    let college;
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findById(identifier)
        .populate('registeredEmails.userId', 'name email batch section')
        .select('name collegeId registeredEmails');
    } else {
      college = await College.findOne({ collegeId: identifier })
        .populate('registeredEmails.userId', 'name email batch section')
        .select('name collegeId registeredEmails');
    }
    
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
async function updateCollege(identifier, updateData) {
  try {
    let college;
    
    // Prevent updating critical fields
    delete updateData.collegeId;
    delete updateData.createdBy;
    delete updateData.registeredEmails;
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findByIdAndUpdate(
        identifier,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');
    } else {
      college = await College.findOneAndUpdate(
        { collegeId: identifier },
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');
    }
    
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
async function deactivateCollege(identifier) {
  try {
    let college;
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findByIdAndUpdate(
        identifier,
        { $set: { isActive: false } },
        { new: true }
      );
    } else {
      college = await College.findOneAndUpdate(
        { collegeId: identifier },
        { $set: { isActive: false } },
        { new: true }
      );
    }
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return college;
  } catch (error) {
    throw new AppError('Error deactivating college', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Activate college
async function activateCollege(identifier) {
  try {
    let college;
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findByIdAndUpdate(
        identifier,
        { $set: { isActive: true } },
        { new: true }
      );
    } else {
      college = await College.findOneAndUpdate(
        { collegeId: identifier },
        { $set: { isActive: true } },
        { new: true }
      );
    }
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return college;
  } catch (error) {
    throw new AppError('Error activating college', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Add email domain to allowed list
async function addEmailDomain(identifier, domain) {
  try {
    let college;
    
    const normalizedDomain = domain.toLowerCase().trim();
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findById(identifier);
    } else {
      college = await College.findOne({ collegeId: identifier });
    }
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    if (college.allowedEmailDomains.includes(normalizedDomain)) {
      throw new AppError('Email domain already exists', StatusCodes.CONFLICT);
    }
    
    college.allowedEmailDomains.push(normalizedDomain);
    await college.save();
    
    return college;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding email domain', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Remove email domain from allowed list
async function removeEmailDomain(identifier, domain) {
  try {
    let college;
    
    const normalizedDomain = domain.toLowerCase().trim();
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findByIdAndUpdate(
        identifier,
        { $pull: { allowedEmailDomains: normalizedDomain } },
        { new: true }
      );
    } else {
      college = await College.findOneAndUpdate(
        { collegeId: identifier },
        { $pull: { allowedEmailDomains: normalizedDomain } },
        { new: true }
      );
    }
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return college;
  } catch (error) {
    throw new AppError('Error removing email domain', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get college statistics
async function getCollegeStats(identifier) {
  try {
    let college;
    
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      college = await College.findById(identifier);
    } else {
      college = await College.findOne({ collegeId: identifier });
    }
    
    if (!college) {
      throw new AppError('College not found', StatusCodes.NOT_FOUND);
    }
    
    return {
      name: college.name,
      collegeId: college.collegeId,
      totalStudents: college.totalStudents,
      totalAdmins: college.totalAdmins,
      registeredEmailsCount: college.getRegisteredEmailsCount(),
      allowedDomainsCount: college.allowedEmailDomains.length,
      isActive: college.isActive,
      createdAt: college.createdAt
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error fetching college statistics', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  createCollege,
  getAllColleges,
  getCollegeById,
  getRegisteredEmails,
  updateCollege,
  deactivateCollege,
  activateCollege,
  addEmailDomain,
  removeEmailDomain,
  getCollegeStats
};