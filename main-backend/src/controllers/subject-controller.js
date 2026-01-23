const SubjectService = require('../services/subject-service');
const User = require('../models/User');
const SuccessResponse = require('../utils/success-response');
const ErrorResponse = require('../utils/error-response');
const { StatusCodes } = require('http-status-codes');

/**
 * Get all subjects for batch/section
 */
async function getSubjects(req, res) {
  try {
    const { batchId, sectionId } = req.query;

    if (!batchId || !sectionId) {
      return res.status(StatusCodes.BAD_REQUEST).json(
        ErrorResponse('Batch ID and Section ID are required')
      );
    }

    const subjects = await SubjectService.getSubjectsByBatchSection(batchId, sectionId);
    
    SuccessResponse.data = subjects;
    SuccessResponse.message = 'Subjects fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Get logged-in user's subjects
 */
async function getMySubjects(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.batch || !user.section) {
      ErrorResponse.message = 'User does not have a valid batch or section assigned.';
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    const subjects = await SubjectService.getSubjectsByBatchSection(user.batch, user.section);

    SuccessResponse.data = subjects;
    SuccessResponse.message = 'My subjects fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Get subject by ID
 */
async function getSubject(req, res) {
  try {
    const { id } = req.params;
    const subject = await SubjectService.getSubjectById(id);

    SuccessResponse.data = subject;
    SuccessResponse.message = 'Subject fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Create subjects from timetable (Manual trigger)
 */
async function createSubjectsFromTimetable(req, res) {
  try {
    const { timetableId } = req.body;

    if (!timetableId) {
      ErrorResponse.message = 'Timetable ID is required';
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    const result = await SubjectService.createSubjectsFromTimetable(timetableId);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Subjects created/updated successfully';
    return res.status(StatusCodes.CREATED).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Update subject
 */
async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    const subject = await SubjectService.updateSubject(id, req.body);

    SuccessResponse.data = subject;
    SuccessResponse.message = 'Subject updated successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

/**
 * Delete subject
 */
async function deleteSubject(req, res) {
  try {
    const { id } = req.params;
    await SubjectService.deleteSubject(id);

    SuccessResponse.data = null;
    SuccessResponse.message = 'Subject deleted successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

module.exports = {
  getSubjects,
  getMySubjects,
  getSubject,
  createSubjectsFromTimetable,
  updateSubject,
  deleteSubject
};