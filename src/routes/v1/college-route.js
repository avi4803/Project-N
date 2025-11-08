const express = require('express');
const router = express.Router();
const {CollegeController} = require('../../controllers/');
const {AuthRequestMiddlewares} = require('../../middlewares/index')


// api/v1/admin/colleges/  --POST
router.post('/create',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    AuthRequestMiddlewares.validateCreateCollegeRequest,
    CollegeController.createCollege);

module.exports = router;


