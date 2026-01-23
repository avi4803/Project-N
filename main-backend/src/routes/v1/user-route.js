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
    AuthRequestMiddlewares.validateSignupInitRequest, 
    UserController.signupInit);

router.post('/signup/verify', 
    AuthRequestMiddlewares.validateSignupVerifyRequest,
    UserController.verifyOtp);

router.post('/signup/complete', UserController.completeProfile);

router.post('/signin',
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

module.exports = router ;
