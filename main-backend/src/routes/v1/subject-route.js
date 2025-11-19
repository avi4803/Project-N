const express = require('express');
const SubjectController = require('../../controllers/subject-controller');
const { authenticate } = require('../../middlewares/auth-request-middleware');

const router = express.Router();

/**
 * @route   GET /api/v1/subjects
 * @desc    Get all subjects for batch/section
 * @access  Private
 * @query   ?batchId=<id>&sectionId=<id>
 */
router.get(
  '/',
  authenticate(),
  SubjectController.getSubjects
);

/**
 * @route   GET /api/v1/subjects/:id
 * @desc    Get subject by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate(),
  SubjectController.getSubject
);

/**
 * @route   POST /api/v1/subjects/from-timetable
 * @desc    Create subjects from timetable (Manual trigger)
 * @access  Private (Admin/Faculty)
 * @body    { timetableId }
 */
router.post(
  '/from-timetable',
  authenticate(['admin', 'faculty', 'local-admin']),
  SubjectController.createSubjectsFromTimetable
);

/**
 * @route   PUT /api/v1/subjects/:id
 * @desc    Update subject
 * @access  Private (Admin/Faculty)
 */
router.put(
  '/:id',
  authenticate(['admin', 'faculty', 'local-admin']),
  SubjectController.updateSubject
);

/**
 * @route   DELETE /api/v1/subjects/:id
 * @desc    Delete subject
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authenticate(['admin', 'local-admin', 'super-admin']),
  SubjectController.deleteSubject
);

module.exports = router;