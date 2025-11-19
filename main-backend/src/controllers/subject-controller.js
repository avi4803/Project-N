const SubjectService = require('../services/subject-service');
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

    return res.status(StatusCodes.OK).json(
      SuccessResponse(subjects, 'Subjects fetched successfully')
    );
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(
      ErrorResponse(error.message, error)
    );
  }
}

/**
 * Get subject by ID
 */
async function getSubject(req, res) {
  try {
    const { id } = req.params;
    const subject = await SubjectService.getSubjectById(id);

    return res.status(StatusCodes.OK).json(
      SuccessResponse(subject, 'Subject fetched successfully')
    );
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(
      ErrorResponse(error.message, error)
    );
  }
}

/**
 * Create subjects from timetable (Manual trigger)
 */
async function createSubjectsFromTimetable(req, res) {
  try {
    const { timetableId } = req.body;

    if (!timetableId) {
      return res.status(StatusCodes.BAD_REQUEST).json(
        ErrorResponse('Timetable ID is required')
      );
    }

    const result = await SubjectService.createSubjectsFromTimetable(timetableId);

    return res.status(StatusCodes.CREATED).json(
      SuccessResponse(result, 'Subjects created/updated successfully')
    );
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(
      ErrorResponse(error.message, error)
    );
  }
}

/**
 * Update subject
 */
async function updateSubject(req, res) {
  try {
    const { id } = req.params;
    const subject = await SubjectService.updateSubject(id, req.body);

    return res.status(StatusCodes.OK).json(
      SuccessResponse(subject, 'Subject updated successfully')
    );
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(
      ErrorResponse(error.message, error)
    );
  }
}

/**
 * Delete subject
 */
async function deleteSubject(req, res) {
  try {
    const { id } = req.params;
    await SubjectService.deleteSubject(id);

    return res.status(StatusCodes.OK).json(
      SuccessResponse(null, 'Subject deleted successfully')
    );
  } catch (error) {
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(
      ErrorResponse(error.message, error)
    );
  }
}

module.exports = {
  getSubjects,
  getSubject,
  createSubjectsFromTimetable,
  updateSubject,
  deleteSubject
};