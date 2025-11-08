const { StatusCodes } = require('http-status-codes');
const { ErrorResponse } = require('../utils/');
const AppError = require('../utils/errors/app-error');
const {UserService} = require('../services/');
const { response } = require('express');
const { message } = require('../utils/error-response');

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
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['College Name not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
    }
   

    if(!req.body.location) {
        ErrorResponse.message = 'Something went wrong while authenticating user';
        ErrorResponse.error = new AppError(['location not found in the incoming request in the correct form'], StatusCodes.BAD_REQUEST);
        return res
                .status(StatusCodes.BAD_REQUEST)
                .json(ErrorResponse);
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


module.exports = {
    validateAuthRequest,
    checkAuth,
    validateAddRoleRequest,
    isAdmin,
    validateLoginRequest,
    validateCreateCollegeRequest
}
