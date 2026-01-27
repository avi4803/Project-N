const express = require('express');
const userRouter = require('./user-route');
const collegeRouter = require('./college-route');
const BatchSectionRouter = require('./batch&section-route');
const TimetableRouter = require('./timetable-route')
const { InfoController } = require('../../controllers');
const attendanceRoutes = require('./attendance-route'); 
const ocrRouter = require('./ocr-route');
const weeklySessionRouter = require('./weekly-session-route');
const broadcastRouter = require('./broadcast-route');
const subjectRouter = require('./subject-route');
const notificationRouter = require('./notification-route');

const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router();

// Apply Global Rate Limit: 300 requests per 15 minutes per IP/User
router.use(AuthRequestMiddlewares.rateLimit(300, 15 * 60 * 1000, 'global-api'));

router.get('/info', InfoController.info);
router.use('/user', userRouter)

router.use('/college', collegeRouter);
router.use('/user/admin/batch',BatchSectionRouter );
router.use('/user/admin/timetable', TimetableRouter );
router.use('/attendance', attendanceRoutes);
router.use('/ocr', ocrRouter);
router.use('/weekly-session', weeklySessionRouter);
router.use('/broadcast', broadcastRouter);
router.use('/subjects', subjectRouter);
router.use('/notifications', notificationRouter);

module.exports = router;