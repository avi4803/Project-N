const express = require('express');
const userRouter = require('./user-route');
const collegeRouter = require('./college-route');
const BatchSectionRouter = require('./batch&section-route');
const TimetableRouter = require('./timetable-route')
const { InfoController } = require('../../controllers');
const ocrRouter = require('./ocr-route');

const router = express.Router();

router.get('/info', InfoController.info);
router.use('/user', userRouter)

router.use('/user/admin/colleges', collegeRouter);
router.use('/user/admin/batch',BatchSectionRouter );
router.use('/user/admin/timetable', TimetableRouter );
router.use('/ocr', ocrRouter);

module.exports = router;