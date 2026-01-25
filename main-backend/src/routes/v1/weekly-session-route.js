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

const TimeBoundMiddleware = require('../../middlewares/time-bound-middleware');

router.post(
  '/classes/:id/cancel',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  AuthRequestMiddlewares.rateLimit(10, 60000), // Max 10 cancels/min
  WeeklySessionController.cancelClass
);

router.post(
  '/classes/:id/reschedule',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  AuthRequestMiddlewares.rateLimit(5, 60000), // Max 5 reschedules/min
  TimeBoundMiddleware.validateFutureDateLimit('newDate', 7),
  WeeklySessionController.rescheduleClass
);

router.post(
  '/extra',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  AuthRequestMiddlewares.rateLimit(5, 60000), // Max 5 extra classes/min
  TimeBoundMiddleware.validateFutureDateLimit('date', 7),
  WeeklySessionController.addExtraClass
);

router.delete(
  '/classes/:id',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  AuthRequestMiddlewares.rateLimit(10, 60000), // Max 10 deletes/min
  WeeklySessionController.deleteClass
);

module.exports = router;
