const { StatusCodes } = require('http-status-codes');
const WeeklySessionService = require('../services/weekly-session-service');
const User = require('../models/User');
const { ErrorResponse, SuccessResponse } = require('../utils');

async function getCurrentWeekSchedule(req, res) {
  try {
    const { batchId, sectionId } = req.params;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    const data = await WeeklySessionService.getSessionForWeek(batchId, sectionId, date);

    if (!data) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'No schedule generated for this week.'
      });
    }

    SuccessResponse.data = data;
    SuccessResponse.message = 'Weekly schedule fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function getMySchedule(req, res) {
  try {
    const user = req.fullUser;

    if (!user || !user.batch || !user.section) {
       return res.status(StatusCodes.BAD_REQUEST).json({
         success: false, 
         message: 'User does not have a valid batch or section assigned.'
       });
    }

    const date = req.query.date ? new Date(req.query.date) : new Date();
    const data = await WeeklySessionService.getSessionForWeek(user.batch, user.section, date);

    if (!data) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'No schedule generated for this week.'
      });
    }

    SuccessResponse.data = data;
    SuccessResponse.message = 'My weekly schedule fetched successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function triggerGeneration(req, res) {
  try {
    const { startDate } = req.body;
    const result = await WeeklySessionService.generateForWeek(startDate || new Date());
    
    SuccessResponse.data = result;
    SuccessResponse.message = 'Weekly sessions generated successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function cancelClass(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await WeeklySessionService.cancelClass(id, reason, req.fullUser);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Class cancelled successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function rescheduleClass(req, res) {
  try {
    const { id } = req.params;
    const { newDate, newStartTime, newEndTime, room } = req.body;
    const result = await WeeklySessionService.rescheduleClass(id, newDate, newStartTime, newEndTime, room, req.fullUser);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Class rescheduled successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function addExtraClass(req, res) {
  try {
    const result = await WeeklySessionService.addExtraClass(req.body, req.fullUser);

    SuccessResponse.data = result;
    SuccessResponse.message = 'Extra class added successfully';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

module.exports = {
  getCurrentWeekSchedule,
  getMySchedule,
  triggerGeneration,
  cancelClass,
  rescheduleClass,
  addExtraClass
};
