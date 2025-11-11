const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const User = require('../models/Users');
const College = require('../models/College');
const { Auth } = require('../utils/index');

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

    // Create user (password will be hashed by pre-save hook)
    const user = new User({
      name: data.name,
      email: data.collegeEmailId,
      password: data.password,
      college: college._id,
      collegeId: college.collegeId,
      batch: data.batch,
      section: data.section,
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
      id: user._id, 
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

module.exports = {
  createUser,
  userSignIn,
  isAuthenticated,
  addRoleToUser,
  isAdmin,
  isLocalAdmin
};