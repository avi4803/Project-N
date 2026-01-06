const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const User = require('../models/User');
const College = require('../models/College');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const { Auth } = require('../utils/index');
const mongoose = require('mongoose');

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
      throw new AppError('Missing JWT token', StatusCodes.BAD_REQUEST);
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
      throw new AppError('Invalid JWT token', StatusCodes.BAD_REQUEST);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('JWT token expired', StatusCodes.BAD_REQUEST);
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
        const user = await User.findById(userId)
            .populate('college', 'name')
            .populate('batch', 'program year')
            .populate('section', 'name');

        if (!user) {
            throw new AppError('User not found', StatusCodes.NOT_FOUND);
        }

        // 1. Get Today's Classes
        const attendanceService = require('./attendance-service');
        // attendanceService is exported as an instance
        let todaysClasses = await attendanceService.getTodaysClasses(userId);
        
        // DEV MOMENT: If no classes found, try to auto-create them (in case cron didn't run)
        if (todaysClasses.length === 0) {
            console.log("⚠️ No sessions found for today. Attempting to auto-create...");
            await attendanceService.createTodaySessions();
            todaysClasses = await attendanceService.getTodaysClasses(userId);
        }

        // 2. Get Next Class
        const nextClass = await attendanceService.getNextClass(userId);

        // 3. Get Overall Attendance Stats
        const attendanceStats = await attendanceService.getOverallStats(userId, 'week'); // defaulting to week view or all

        // 4. Get Full Timetable (for reference)
        const TimetableService = require('./timetable-service');
        const timetable = await TimetableService.getTimetable(user.batch._id.toString(), user.section._id.toString())
            .catch(() => null); // If no timetable found, return null without erroring

        return {
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
                nextClass,
                fullTimetable: timetable
            },
            attendance: attendanceStats,
            notifications: [] // Placeholder for now, or fetch from Notification Service if stored
        };

    } catch (error) {
        console.log("Error fetching dashboard data:", error);
        if (error instanceof AppError) throw error;
        throw new AppError('Error fetching dashboard data', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

module.exports = {
  createUser,
  userSignIn,
  isAuthenticated,
  addRoleToUser,
  isAdmin,
  isLocalAdmin,
  getDashboardData
};