const {StatusCodes} = require('http-status-codes');
const {UserService, OtpService} = require('../services');
const { ErrorResponse} = require('../utils/');
const { SuccessResponse } = require('../utils/');
const { publishNotification } = require('../services/notification-publisher');

async function signupInit(req, res) {
    try {
        const response = await OtpService.initSignup({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password
        });
        
        SuccessResponse.message = response.message;
        SuccessResponse.data = {}; // Don't return sensitive data
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        console.error("❌ signupInit Error:", error.message);
        ErrorResponse.message = error.message || 'Error initiating signup';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function verifyOtp(req, res) {
    try {
        const response = await OtpService.verifyOtp(
            req.body.email,
            req.body.otp
        );
        
        SuccessResponse.message = response.message;
        SuccessResponse.data = { signupToken: response.signupToken };
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        console.error("❌ verifyOtp Error:", error.message);
        ErrorResponse.message = error.message || 'Error verifying OTP';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function completeProfile(req, res) {
    try {
        // req.user will be populated by a middleware checking 'signupToken' (OR we check it here manually if no middleware used)
        // Since we don't have a middleware for signup-token specifically yet, let's verify it or expect it in body.
        // Plan said: "verifyOtp returns signed JWT. completeProfile verifies token."
        // We'll rely on the middleware or verify manually. Let's verify manually for now to avoid Auth middleware complexity for partial users.
        
        // Actually, assuming a middleware `validateSignupToken` or just passing it in body?
        // Let's expect it in the Authorization header or body. For simplicity/consistency with typical auth:
        // But since this is a specific flow, let's look for `signupToken` in body or headers.
        
        // Wait, the plan was simple. Let's check the token validity here or use OtpService.
        // But `UserService.createUser` expects data.
        
        // Let's decode the token here
        const token = req.headers['x-signup-token'] || req.body.signupToken;
        if (!token) {
             throw { statusCode: StatusCodes.UNAUTHORIZED, message: 'Missing signup token' };
        }
        
        // Verify token (in a real app, use a middleware, but inline for now is fine for this specific scope)
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        if (!decoded || decoded.role !== 'pending_student') {
             throw { statusCode: StatusCodes.UNAUTHORIZED, message: 'Invalid signup token' };
        }
        
        // Get verified data
        const pendingUser = await OtpService.getCompletedSignupData(decoded.email);
        console.log(req.body)
;
        const user = await UserService.createUser({
            collegeId: req.body.collegeId,
            email: pendingUser.email, // Use email from trusted PendingUser
            password: pendingUser.password, // Use hashed password from PendingUser
            name: pendingUser.name,
            batch: req.body.batch,
            section: req.body.section,
            collegeEmailId: pendingUser.email // Assuming 'collegeEmailId' maps to the email
        });

        // Cleanup
        await OtpService.clearPendingUser(pendingUser.email);
        
        SuccessResponse.message = 'Successfully completed profile and added user';
        SuccessResponse.data = user;

        // Send Welcome Notification
        if (user.email) {
            publishNotification('WELCOME_USER', {
                userId: user._id.toString(),
                to: user.email,
                name: user.name,
                role: 'student'
            });
        }

        return res.status(StatusCodes.CREATED).json(SuccessResponse);
    } catch (error) {
        console.error("❌ completeProfile Error:", error.message);
        ErrorResponse.message = error.message || 'Error completing profile';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function signup(req, res) {
    try {
        
       
        const user = await UserService.createUser({
            collegeId:req.body.collegeId,
            email:req.body.email,
            password:req.body.password,
            name:req.body.name,
            batch:req.body.batch,
            section:req.body.section,
            collegeEmailId:req.body.collegeEmailId 
        })
        
    SuccessResponse.message = 'Successfully added the user';
    SuccessResponse.data = user;

    // Send Welcome Notification
    if (user.email) {
        publishNotification('WELCOME_USER', {
            userId: user._id.toString(),
            to: user.email,
            name: user.name,
            role: 'student' // Default or dynamic
        });
    }

        return res
                  .status(StatusCodes.CREATED)
                  .json(SuccessResponse);
    } catch (error) {
        console.error("❌ signup Error:", error.message)
        ErrorResponse.message = error.message || 'Error during signup';
        ErrorResponse.error = error;
        return res
                 .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
                 .json(ErrorResponse)
    }
    
}

async function signin(req, res){

    try {
        const user = await UserService.userSignIn({
            email : req.body.email,
            password : req.body.password

        })

        SuccessResponse.message = 'Successfully logged in';
        SuccessResponse.data = user ;
        return res
                  .status(StatusCodes.OK)
                  .json(SuccessResponse)


        
    } catch (error) {
        console.error('❌ Signin Controller Error:', error.message);
        ErrorResponse.message = error.message || 'Something went wrong during sign in';
        ErrorResponse.error = error;
        return res
                  .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
                  .json(ErrorResponse)
    }
}

async function addRoleToUser(req, res){

    try {
        const user = await UserService.addRoleToUser({
            role : req.body.role,
            id : req.body.id,

        })
        SuccessResponse.message = 'Role added successfully';
        SuccessResponse.data = user ;
        
        // Send Profile Update Notification
        if (user.email) {
            publishNotification('PROFILE_UPDATE', {
                userId: user._id.toString(),
                to: user.email,
                name: user.name,
                updateType: 'Role Update',
                details: `Your role has been updated to ${req.body.role}`
            });
        }

        return res
                  .status(StatusCodes.OK)
                  .json(SuccessResponse)


        
    } catch (error) {
        console.error("❌ addRoleToUser Error:", error.message);
        ErrorResponse.message = error.message || 'Error adding role to user';
        ErrorResponse.error = error;
        return res
                  .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
                  .json(ErrorResponse);
    }
}

// Get Dashboard Data
async function getDashboardData(req, res) {
    try {
        const userId = req.user; // req.user is the ObjectId set by checkAuth
        const data = await UserService.getDashboardData(userId);
        
        SuccessResponse.data = data;
        SuccessResponse.message = 'Dashboard data fetched successfully';
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching dashboard data';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

const AppError = require('../utils/errors/app-error');

async function updateFcmToken(req, res) {
    try {
        const userId = req.user; 
        const { fcmToken, token } = req.body;
        const registrationToken = fcmToken || token;

        console.log(`📱 Updating FCM Token for user ${userId}. Received body:`, req.body);

        if (!registrationToken) {
            throw new AppError('FCM Token is required in the request body (as "fcmToken" or "token")', StatusCodes.BAD_REQUEST);
        }

        const result = await UserService.updateFcmToken(userId, registrationToken);

        
        // Always reset global singleton responses before use
        SuccessResponse.data = result;
        SuccessResponse.message = 'Device registration token (FCM) updated successfully';
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        console.error("Error in updateFcmToken controller:", error.message);
        
        // Reset and populate the global error singleton
        ErrorResponse.message = error.message || 'Failed to update FCM Token';
        ErrorResponse.error = error.explanation || error;
        ErrorResponse.data = {}; 

        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function updateReminderSettings(req, res) {
    try {
        const userId = req.user;
        const { settings, dailySummaryEnabled } = req.body; 

        if (settings !== undefined && !Array.isArray(settings)) {
            throw new AppError('Settings must be an array', StatusCodes.BAD_REQUEST);
        }
        
        if (dailySummaryEnabled !== undefined && typeof dailySummaryEnabled !== 'boolean') {
             throw new AppError('dailySummaryEnabled must be a boolean', StatusCodes.BAD_REQUEST);
        }

        const result = await UserService.updateReminderSettings(userId, settings, dailySummaryEnabled);

        SuccessResponse.data = result;
        SuccessResponse.message = 'Reminder preferences updated';
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        ErrorResponse.message = error.message || 'Failed to update reminder settings';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function forgotPassword(req, res) {
    try {
        const result = await OtpService.initiatePasswordReset(req.body.email);
        SuccessResponse.message = result.message;
        SuccessResponse.data = {};
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        console.error("❌ forgotPassword Error:", error.message);
        ErrorResponse.message = error.message || 'Error initiating password reset';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function verifyResetOtp(req, res) {
    try {
        const result = await OtpService.verifyResetOtp(req.body.email, req.body.otp);
        SuccessResponse.message = result.message;
        SuccessResponse.data = { resetToken: result.resetToken };
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        console.error("❌ verifyResetOtp Error:", error.message);
        ErrorResponse.message = error.message || 'Error verifying reset OTP';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

async function resetPassword(req, res) {
    try {
        // req.userId is set by validateResetToken middleware
        const result = await UserService.resetUserPassword(req.userId, req.body.password);
        SuccessResponse.message = result.message;
        SuccessResponse.data = {};
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        console.error("❌ resetPassword Error:", error.message);
        ErrorResponse.message = error.message || 'Error resetting password';
        ErrorResponse.error = error;
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

module.exports = {
    signup,
    signin,
    addRoleToUser,
    signupInit,
    verifyOtp,
    completeProfile,
    getDashboardData,
    updateFcmToken,
    updateReminderSettings,
    forgotPassword,
    verifyResetOtp,
    resetPassword
}