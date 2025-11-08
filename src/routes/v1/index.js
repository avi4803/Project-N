const express = require('express');
const userRouter = require('./user-route');
const collegeRouter = require('./college-route');
const { InfoController } = require('../../controllers');

const router = express.Router();

router.get('/info', InfoController.info);
router.use('/user', userRouter)

router.use('/user/admin/colleges', collegeRouter)

module.exports = router;