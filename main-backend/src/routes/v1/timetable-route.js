const express = require('express');
const { TimetableController } = require('../../controllers');
const { AuthRequestMiddlewares } = require('../../middlewares/');

const router = express.Router();

// Create timetable - Admin/Local-Admin only
router.post(
    '/',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(5, 15 * 60 * 1000, 'timetable-create'),
    TimetableController.createTimetable
);

// Get timetable by batch and section - Authenticated users
router.get(
    '/batch/:batchId/section/:sectionId',
    AuthRequestMiddlewares.checkAuth,
    TimetableController.getTimetable
);

// Get all timetables - Authenticated users
router.get(
    '/',
    AuthRequestMiddlewares.checkAuth,
    TimetableController.getAllTimetables
);

// Get timetable by ID - Authenticated users
router.get(
    '/:id',
    AuthRequestMiddlewares.checkAuth,
    TimetableController.getTimetableById
);

// Get timetable by day - Authenticated users
router.get(
    '/:id/day/:day',
    AuthRequestMiddlewares.checkAuth,
    TimetableController.getTimetableByDay
);

// Get timetables by college - Admin/Local-Admin only
router.get(
    '/college/:collegeId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    TimetableController.getTimetablesByCollege
);

// Update timetable - Admin/Local-Admin only
router.patch(
    '/:id',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(10, 15 * 60 * 1000, 'timetable-update'),
    TimetableController.updateTimetable
);

// Add class to timetable - Admin/Local-Admin only
router.post(
    '/:id/classes',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(20, 15 * 60 * 1000, 'timetable-class-edit'),
    TimetableController.addClass
);

// Update a specific class in the timetable (Blueprint Edit)
router.patch(
    '/:id/classes/:classId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(20, 15 * 60 * 1000, 'timetable-class-edit'),
    TimetableController.updateClass
);

// Remove class from timetable - Admin/Local-Admin only
router.delete(
    '/:id/classes/:classId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.rateLimit(20, 15 * 60 * 1000, 'timetable-class-edit'),
    TimetableController.removeClass
);

// Blueprint Management APIs (Explicit)
router.patch(
    '/:id/blueprint',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    TimetableController.updateTimetable
);

router.post(
    '/:id/blueprint/classes',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    TimetableController.addClass
);

// Delete timetable - Admin only
router.delete(
    '/:id',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    TimetableController.deleteTimetable
);

module.exports = router;