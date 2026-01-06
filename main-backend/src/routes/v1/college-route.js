const express = require('express');
const { CollegeController } = require('../../controllers');
const { AuthRequestMiddlewares } = require('../../middlewares');
const BatchSectionController = require('../../controllers/batch&section-controller');       

const router = express.Router();

// Create college - Admin only
router.post(
    '/',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    AuthRequestMiddlewares.validateCreateCollegeRequest,
    CollegeController.createCollege
);

// Get all colleges - Public or authenticated
router.get('/', CollegeController.getAllColleges);

// Public routes (used in Signup)
router.get('/batch', BatchSectionController.getBatches); // Accepts ?collegeId in query
router.get('/section', BatchSectionController.getSections); // Accepts ?batchId in query

// Get college by ID - Public or authenticated
router.get('/:collegeId', CollegeController.getCollegeById);

// Get college statistics - Admin only
router.get(
    '/:collegeId/stats',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.getCollegeStats
);

// Get registered emails - Admin only
router.get(
    '/:collegeId/registered-emails',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.getRegisteredEmails
);

// Update college - Admin only
router.patch(
    '/:collegeId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.updateCollege
);

// Deactivate college - Admin only
router.delete(
    '/:collegeId',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.deactivateCollege
);

// Activate college - Admin only
router.patch(
    '/:collegeId/activate',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.activateCollege
);

// Add email domain - Admin only
router.post(
    '/:collegeId/domains',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.addEmailDomain
);

// Remove email domain - Admin only
router.delete(
    '/:collegeId/domains/:domain',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin,
    CollegeController.removeEmailDomain
);

module.exports = router;