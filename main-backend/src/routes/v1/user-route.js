const express = require('express');
const router = express.Router();
const {UserController} = require('../../controllers/');
const {AuthRequestMiddlewares} = require('../../middlewares/index')

// api/v1/user/signup/  --POST
router.post('/signup',
    AuthRequestMiddlewares.validateAuthRequest,
    UserController.signup);

// New Signup Flow
router.post('/signup/init', 
    AuthRequestMiddlewares.rateLimit(5, 15 * 60 * 1000, 'auth-signup-init'),
    AuthRequestMiddlewares.validateSignupInitRequest, 
    UserController.signupInit);

router.post('/signup/verify', 
    AuthRequestMiddlewares.rateLimit(10, 15 * 60 * 1000, 'auth-signup-verify'),
    AuthRequestMiddlewares.validateSignupVerifyRequest,
    UserController.verifyOtp);

router.post('/signup/complete', UserController.completeProfile);

router.post('/signin',
    AuthRequestMiddlewares.rateLimit(10, 15 * 60 * 1000, 'auth-signin'),
    AuthRequestMiddlewares.validateLoginRequest,
    UserController.signin);

router.post('/role',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    AuthRequestMiddlewares.validateAddRoleRequest,
    AuthRequestMiddlewares.validateAddRoleRequest,
    UserController.addRoleToUser);


// Dashboard Route
router.get('/dashboard',
    AuthRequestMiddlewares.checkAuth,
    UserController.getDashboardData);


// Update FCM Token
router.patch('/fcm-token',
    AuthRequestMiddlewares.checkAuth,
    UserController.updateFcmToken);

// Update Reminder Settings
router.patch('/reminder-settings',
    AuthRequestMiddlewares.checkAuth,
    UserController.updateReminderSettings);

// Password Reset flow
router.post('/forgot-password',
    AuthRequestMiddlewares.rateLimit(3, 15 * 60 * 1000, 'password-reset-request'),
    AuthRequestMiddlewares.validateForgotPasswordRequest,
    UserController.forgotPassword);

router.post('/resend-reset-otp',
    AuthRequestMiddlewares.rateLimit(3, 15 * 60 * 1000, 'password-reset-resend'),
    AuthRequestMiddlewares.validateForgotPasswordRequest, // Reuses email validation
    UserController.forgotPassword); // Reuses the same logic to send new OTP

router.post('/verify-reset-otp',
    AuthRequestMiddlewares.rateLimit(10, 15 * 60 * 1000, 'password-reset-verify'),
    AuthRequestMiddlewares.validateVerifyResetOtpRequest,
    UserController.verifyResetOtp);

router.post('/reset-password',
    AuthRequestMiddlewares.validateResetToken,
    AuthRequestMiddlewares.validateResetPasswordRequest,
    UserController.resetPassword);

module.exports = router ;
