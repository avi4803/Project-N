const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const User = require('../models/User');
const College = require('../models/College');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Auth = require('../utils/auth');
const PasswordReset = require('../models/PasswordReset');
const mongoose = require('mongoose');
const CacheService = require('./cache-service');

// Helper function to extract email domain
function extractEmailDomain(email) {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

// User Signup: name, college, collegeEmailId, password, batch, section
async function createUser(data) {
  try {
    // Validate required fields
    if (!data.name || !data.collegeEmailId || !data.password || !data.batch || !data.section ) {
      throw new AppError('Missing required fields: name, collegeEmailId, password, batch, section, collegeId', StatusCodes.BAD_REQUEST);
    }

    // Find college
    const college = await College.findOne({ collegeId: data.collegeId });
    if (!college) {
      throw new AppError('College not found. Please contact admin.', StatusCodes.NOT_FOUND);
    }

    // Check if college is active
    if (!college.isActive) {
      throw new AppError('This college is currently inactive', StatusCodes.FORBIDDEN);
    }

    // Validate email domain
    const emailDomain = extractEmailDomain(data.collegeEmailId);
    if (!emailDomain) {
      throw new AppError('Invalid email format', StatusCodes.BAD_REQUEST);
    }

    // Check if email domain is allowed for this college
    if (college.allowedEmailDomains.length > 0) {
      if (!college.isEmailDomainAllowed(data.collegeEmailId)) {
        throw new AppError(
          `Email domain @${emailDomain} is not allowed for ${college.name}. Please use an official college email.`,
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Resolve Batch
    let batchId = data.batch;
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
        // Try to find by year and college
        const batchDoc = await Batch.findOne({ 
            year: batchId, 
            college: college._id 
        });
        
        if (!batchDoc) {
             throw new AppError(`Batch '${batchId}' not found for this college`, StatusCodes.BAD_REQUEST);
        }
        batchId = batchDoc._id;
    }

    // Resolve Section
    let sectionId = data.section;
    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
        const sectionDoc = await Section.findOne({ 
            name: sectionId, 
            batch: batchId 
        });
        
        if (!sectionDoc) {
             throw new AppError(`Section '${sectionId}' not found in batch`, StatusCodes.BAD_REQUEST);
        }
        sectionId = sectionDoc._id;
    }

    // Create user (password will be hashed by pre-save hook)
    const user = new User({
      name: data.name,
      email: data.collegeEmailId,
      password: data.password,
      college: college._id,
      collegeId: college.collegeId,
      batch: batchId,
      section: sectionId,
      roles: ['student']
    });

    await user.save();

    // Update college statistics
    college.totalStudents += 1;
    college.registeredEmails.push({
      email: data.collegeEmailId,
      userId: user._id,
      registeredAt: new Date()
    });
    await college.save();
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    
    return userResponse;
    
  } catch (error) {
    console.log("Error creating user:", error.message);
    if (error.code === 11000) {
      throw new AppError('This email is already registered for this college', StatusCodes.CONFLICT);
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating user', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function userSignIn(data) {
  try {
    const user = await User.findOne({ email: data.email }).populate('college');
    if (!user) {
      throw new AppError('No user found for given email', StatusCodes.NOT_FOUND);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', StatusCodes.FORBIDDEN);
    }

    // Use the model's comparePassword method
    const passwordMatch = await user.comparePassword(data.password);
    if (!passwordMatch) {
      throw new AppError('Invalid Password', StatusCodes.BAD_REQUEST);
    }

    const jwt = Auth.createToken({ 
      id: user._id.toString(), // Convert ObjectId to string
      email: user.email,
      roles: user.roles 
    });
    
    return jwt;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Something went wrong during sign in', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function isAuthenticated(token) {
  try {
    if (!token) {
      throw new AppError('Missing JWT token', StatusCodes.UNAUTHORIZED);
    }
    const response = await Auth.verifyToken(token);
    const user = await User.findById(response.id);
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }
    if (!user.isActive) {
      throw new AppError('User account is inactive', StatusCodes.FORBIDDEN);
    }
    return user._id;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid JWT token', StatusCodes.UNAUTHORIZED);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('JWT token expired', StatusCodes.UNAUTHORIZED);
    }
    throw new AppError('Authentication failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function addRoleToUser(data) {
  try {
    const user = await User.findById(data.id);
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }
    const role = data.role;
    if (!role) {
      throw new AppError('Role not provided', StatusCodes.BAD_REQUEST);
    }
    if (!user.roles.includes(role)) {
      user.roles.push(role);
      await user.save();
    }
    return user;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding role to user', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function isAdmin(id) {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }
    return user.roles.includes('admin');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error checking admin status', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

async function isLocalAdmin(id) {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }
    return user.roles.includes('local-admin');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error checking admin status', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Get aggregated dashboard data for logged-in user
async function getDashboardData(userId) {
    try {
        const studentIdStr = userId.toString();
        
        // --- 1. REDIS CACHE CHECK ---
        const cacheKey = `user:${studentIdStr}:full-dashboard`;
        const cachedDashboard = await CacheService.get(cacheKey);
        if (cachedDashboard) {
            return cachedDashboard;
        }

        const user = await User.findById(studentIdStr)
            .populate('college', 'name')
            .populate('batch', 'program year')
            .populate('section', 'name');

        if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
        }

        // 1. Prepare Services
        const attendanceService = require('./attendance-service');
        const TimetableService = require('./timetable-service');

        // 2. Fetch all components in parallel
        // Note: These don't depend on each other, so running them concurrently is much faster.
        const [todaysClasses, attendanceStats, timetable] = await Promise.all([
            attendanceService.getTodaysClasses(studentIdStr),
            attendanceService.getOverallStats(studentIdStr, 'week'),
            TimetableService.getTimetable(user.batch._id.toString(), user.section._id.toString()).catch(() => null)
        ]);

        const dashboardData = {
            user: {
                name: user.name,
                email: user.email,
                role: user.roles,
                college: user.college,
                batch: user.batch,
                section: user.section
            },
            schedule: {
                todaysClasses,
                fullTimetable: timetable
            },
            attendance: attendanceStats,
            notifications: [] 
        };

        // --- 2. SAVE TO CACHE (TTL: 5 minutes) ---
        await CacheService.set(cacheKey, dashboardData, 300);

        return dashboardData;

    } catch (error) {
        console.log("Error fetching dashboard data:", error);
        if (error instanceof AppError) throw error;
        throw new AppError('Error fetching dashboard data', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

// Update FCM Token for user
async function updateFcmToken(userId, fcmToken) {
    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { fcmToken: fcmToken },
            { new: true }
        );
        
        if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
        }
        
        return { message: 'FCM Token updated successfully' };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error updating FCM token', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

// Update Class Reminder Settings
async function updateReminderSettings(userId, settings, dailySummaryEnabled) {
    try {
        const updateData = {};
        if (settings !== undefined) updateData.reminderSettings = settings;
        if (dailySummaryEnabled !== undefined) updateData.dailySummaryEnabled = dailySummaryEnabled;

        // settings should be an array of [10, 15, 30] or [] for OFF
        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
        }
        
        return { 
            message: 'Reminder settings updated successfully',
            reminderSettings: user.reminderSettings,
            dailySummaryEnabled: user.dailySummaryEnabled
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Error updating reminder settings', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

async function resetUserPassword(userId, newPassword) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', StatusCodes.NOT_FOUND);
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    // Clear password reset record
    await PasswordReset.deleteOne({ email: user.email });

    return { message: 'Password updated successfully' };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Error resetting password', StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

module.exports = {
  userSignUp: createUser ,
  createUser, // Renamed createUser to userSignUp as per instruction
  userSignIn,
  isAuthenticated,
  addRoleToUser,
  isAdmin,
  isLocalAdmin,
  getDashboardData,
  updateFcmToken,
  updateReminderSettings,
  resetUserPassword
};