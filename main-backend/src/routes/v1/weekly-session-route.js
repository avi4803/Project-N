const express = require('express');
const WeeklySessionController = require('../../controllers/weekly-session-controller');
const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router();

// Get schedule for specific batch/section (defaults to current week)
router.get(
  '/batch/:batchId/section/:sectionId',
  AuthRequestMiddlewares.checkAuth,
  WeeklySessionController.getCurrentWeekSchedule
);

// Get schedule for logged-in user
router.get(
  '/my-schedule',
  AuthRequestMiddlewares.checkAuth,
  WeeklySessionController.getMySchedule
);

// Admin/Local Admin operations
router.post(
  '/generate',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  WeeklySessionController.triggerGeneration
);

router.post(
  '/classes/:id/cancel',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin, // Or Faculty?
  WeeklySessionController.cancelClass
);

router.post(
  '/classes/:id/reschedule',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  WeeklySessionController.rescheduleClass
);

router.post(
  '/extra',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  WeeklySessionController.addExtraClass
);

module.exports = router;
