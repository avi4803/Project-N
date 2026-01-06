const { StatusCodes } = require('http-status-codes');
const { ErrorResponse } = require('../utils/');
const AppError = require('../utils/errors/app-error');
const {UserService} = require('../services/');
const { response } = require('express');
const { message } = require('../utils/error-response');

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/server-config');



/**
 * Authentication Middleware
 * Verifies JWT token and checks user roles
 * @param {Array} allowedRoles - Array of roles allowed to access the route (optional)
 * @returns {Function} Express middleware function
 */
function authenticate(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      // 1. Check if Authorization header exists
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError(
          'Authentication required. Please provide a valid token.',
          StatusCodes.UNAUTHORIZED
        );
      }

      // 2. Extract token
      const token = authHeader.split(' ')[1];
      
      if (!token) {
        throw new AppError(
          'Token not found. Please login again.',
          StatusCodes.UNAUTHORIZED
        );
      }

      // 3. Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          throw new AppError(
            'Token has expired. Please login again.',
            StatusCodes.UNAUTHORIZED
          );
        } else if (error.name === 'JsonWebTokenError') {
          throw new AppError(
            'Invalid token. Please login again.',
            StatusCodes.UNAUTHORIZED
          );
        } else {
          throw new AppError(
            'Token verification failed.',
            StatusCodes.UNAUTHORIZED
          );
        }
      }

      // 4. Check if user exists and is active (optional but recommended)
      // You can uncomment this if you want to verify user existence in DB
      /*
      const User = require('../models/User');
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        throw new AppError(
          'User associated with this token no longer exists.',
          StatusCodes.UNAUTHORIZED
        );
      }
      
      if (!user.isActive) {
        throw new AppError(
          'Your account has been deactivated. Please contact support.',
          StatusCodes.FORBIDDEN
        );
      }
      */

      // 5. Attach user info to request object
      // Ensure ID is properly converted to string (handles both old and new tokens)
      let userId = decoded.id;
      
      // Handle various ObjectId formats that might come from JWT
      if (userId) {
        if (Buffer.isBuffer(userId)) {
          // Buffer needs to be converted to hex string for ObjectId
          userId = userId.toString('hex');
        }
        else if (typeof userId === 'object') {
          // BSON ObjectId object
          if (userId._bsontype === 'ObjectId' || userId.constructor?.name === 'ObjectId') {
            userId = userId.toString();
          }
          // Object with id property
          else if (userId.id) {
            userId = String(userId.id);
          }
          else {
            // Try to stringify the object
            userId = JSON.stringify(userId);
          }
        } 
        // String - keep as is
        else if (typeof userId !== 'string') {
          userId = String(userId);
        }
      }
      
      req.user = {
        id: userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
        college: decoded.college,
        batch: decoded.batch,
        section: decoded.section
      };

      // 6. Check role-based access if allowedRoles is specified
      if (allowedRoles.length > 0) {
        if (!allowedRoles.includes(req.user.role)) {
          throw new AppError(
            `Access denied. This route requires one of the following roles: ${allowedRoles.join(', ')}`,
            StatusCodes.FORBIDDEN
          );
        }
      }

      // 7. Proceed to next middleware
      next();

    } catch (error) {
      // Handle errors
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(
          ErrorResponse(error.message, error)
        );
      }
      
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
        ErrorResponse('Authentication failed', error)
      );
    }
  };
}



function validateAuthRequest(req, res, next) {
    console.log(req.body)
    
    if(!req.body.email) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['email not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.password) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['password not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.name) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['name not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.batch) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['Batch not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
    

    if(!req.body.college) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['College not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }

    
    
    next();
}


function validateCreateCollegeRequest(req, res, next) {
    console.log(req.body)
    
    if(!req.body.name) {
        ErrorResponse.message = 'Something went wrong while creating college';
        ErrorResponse.error = new AppError(['College Name not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.location) {
        ErrorResponse.message = 'Something went wrong while creating college';
        ErrorResponse.error = new AppError(['location not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
       
    
    next();
}

function validateCreateSectionRequest(req, res, next) {

    
    if(!req.body.name) {
        ErrorResponse.message = 'Something went wrong while creating Section';
        ErrorResponse.error = new AppError(['Section Name not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.batch) {
        ErrorResponse.message = 'Something went wrong while creating Section';
        ErrorResponse.error = new AppError(['Batch not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
       
    
    next();
}


function validateCreateBatchRequest(req, res, next) {

    
    if(!req.body.college) {
        ErrorResponse.message = 'Something went wrong while creating Batch';
        ErrorResponse.error = new AppError(['College not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.year) {
        ErrorResponse.message = 'Something went wrong while creating Batch';
        ErrorResponse.error = new AppError(['Year not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
    
    
    if(!req.body.program) {
        ErrorResponse.message = 'Something went wrong while creating Batch';
        ErrorResponse.error = new AppError(['Program not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
      
    
    next();
}

function validateSignupInitRequest(req, res, next) {
    if (!req.body.name || !req.body.email || !req.body.password) {
        ErrorResponse.message = 'Missing required fields';
        ErrorResponse.error = new AppError(['name, email, and password are required'], StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    next();
}

function validateSignupVerifyRequest(req, res, next) {
    if (!req.body.email || !req.body.otp) {
        ErrorResponse.message = 'Missing required fields';
        ErrorResponse.error = new AppError(['email and otp are required'], StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    next();
}

function validateLoginRequest(req, res, next) {
    if(!req.body.email) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['email not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.password) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['password not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   
    next();
}


async function checkAuth(req, res, next) {
    try {
        const userId = await UserService.isAuthenticated(req.headers['x-access-token']);
        if (userId) {
            req.user = userId;
            next();
        }   
    } catch (error) {
        console.log('Issue in checkAuth in middleware');
        
        // Handle specific error cases
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.explanation,
                error: {
                    statusCode: error.statusCode,
                    explanation: error.explanation
                }
            });
        }
        
        // Generic error response
        return res.status(StatusCodes.UNAUTHORIZED).json({
            success: false,
            message: 'Authentication failed',
            error: {
                statusCode: StatusCodes.UNAUTHORIZED,
                explanation: error.message || 'Authentication failed'
            }
        });
    }
}

function validateAddRoleRequest(req, res, next) {
    if(!req.body.role) {
        ErrorResponse.message = 'Something went wrong while adding user';
        ErrorResponse.error = new AppError(['Role not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }

    if(!req.body.id) {
        ErrorResponse.message = 'Something went wrong while adding user';
        ErrorResponse.error = new AppError(['User Id not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
    
    next();
}

async function isAdmin(req, res, next) {
    try {
        const adminStatus = await UserService.isAdmin(req.user);
        if (!adminStatus) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied. Admin privileges required.',
                error: {
                    statusCode: StatusCodes.FORBIDDEN,
                    explanation: 'You do not have permission to perform this action'
                }
            });
        }
        next();
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error verifying admin status',
            error: {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                explanation: error.message
            }
        });
    }
}

async function isAdminOrLocalAdmin(req, res, next) {
    try {
        const userId = req.user; // Set by checkAuth middleware
        
        const adminStatus = await UserService.isAdmin(userId);
        const localAdminStatus = await UserService.isLocalAdmin(userId);
        
        if (!adminStatus && !localAdminStatus) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied. Admin or Local-Admin privileges required.',
                error: {
                    statusCode: StatusCodes.FORBIDDEN,
                    explanation: 'You do not have permission to perform this action'
                }
            });
        }
        
        next();
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error verifying privileges',
            error: {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                explanation: error.message
            }
        });
    }
}


/**
 * Check if user belongs to the same college
 * Used for local-admin to manage resources within their college only
 */
function verifySameCollege(req, res, next) {
  try {
    // Super admin can access all colleges
    if (req.user.role === 'super-admin') {
      return next();
    }

    const resourceCollegeId = req.params.collegeId || req.body.college;
    
    if (!resourceCollegeId) {
      throw new AppError(
        'College information is required.',
        StatusCodes.BAD_REQUEST
      );
    }

    // Check if user's college matches resource college
    if (req.user.college && req.user.college.toString() !== resourceCollegeId.toString()) {
      throw new AppError(
        'Access denied. You can only manage resources within your college.',
        StatusCodes.FORBIDDEN
      );
    }
    
    next();
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.FORBIDDEN).json(
      ErrorResponse(error.message, error)
    );
  }
}

/**
 * Rate limiting middleware (basic implementation)
 * You might want to use express-rate-limit package for production
 */
const requestCounts = new Map();

function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const key = req.user ? req.user.id : req.ip;
    const now = Date.now();
    
    if (!requestCounts.has(key)) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userData = requestCounts.get(key);
    
    if (now > userData.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userData.count >= maxRequests) {
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json(
        ErrorResponse('Too many requests. Please try again later.')
      );
    }
    
    userData.count++;
    next();
  };
}

module.exports = {
    authenticate,
    verifySameCollege,
    rateLimit,
    validateAuthRequest,
    isAdminOrLocalAdmin,
    validateLoginRequest,
    validateCreateCollegeRequest,
    validateCreateSectionRequest,
    validateCreateBatchRequest,
    isAdmin,
    checkAuth,
    validateAddRoleRequest,
    validateSignupInitRequest,
    validateSignupVerifyRequest
    
}
