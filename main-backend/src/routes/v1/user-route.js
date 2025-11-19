const express = require('express');
const router = express.Router();
const {UserController} = require('../../controllers/');
const {AuthRequestMiddlewares} = require('../../middlewares/index')

// api/v1/user/signup/  --POST
router.post('/signup',
    AuthRequestMiddlewares.validateAuthRequest,
    UserController.signup);

router.post('/signin',
    AuthRequestMiddlewares.validateLoginRequest,
    UserController.signin);

router.post('/role',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    AuthRequestMiddlewares.validateAddRoleRequest,
    UserController.addRoleToUser);





module.exports = router ;
