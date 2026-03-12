const HolidayService = require('../services/holiday-service');
const { StatusCodes } = require('http-status-codes');
const { SuccessResponse, ErrorResponse } = require('../utils');
const AppError = require('../utils/errors/app-error');

async function declareHoliday(req, res) {
  try {
    const { startDate, endDate, reason } = req.body;
    let collegeId = req.fullUser?.college?._id || req.body.collegeId; 

    // Extract from token if possible
    if (!collegeId) throw new AppError('College ID not found. Ensure you are logged in or provide it explicitly if authorized.', StatusCodes.BAD_REQUEST);

    const result = await HolidayService.addHoliday(collegeId, startDate, endDate, reason);
    
    SuccessResponse.data = result;
    SuccessResponse.message = 'Holiday created and cache invalidated completely.';
    return res.status(StatusCodes.CREATED).json(SuccessResponse);
  } catch (error) {
    console.error("declareHoliday Error:", error.message);
    ErrorResponse.message = error.message || 'Error declaring holiday';
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function getHolidays(req, res) {
  try {
    let collegeId = req.fullUser?.college?._id || req.params.collegeId; 
    
    if (!collegeId) throw new AppError('College ID missing.', StatusCodes.BAD_REQUEST);

    const result = await HolidayService.getHolidaysForCollege(collegeId);
    
    SuccessResponse.data = result;
    SuccessResponse.message = 'Holidays fetched successfully.';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message || 'Error fetching holidays';
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

async function removeHoliday(req, res) {
  try {
    const { date } = req.params;
    let collegeId = req.fullUser?.college?._id || req.query.collegeId; 
    
    if (!collegeId) throw new AppError('College ID missing.', StatusCodes.BAD_REQUEST);

    const result = await HolidayService.removeHoliday(collegeId, date);
    
    SuccessResponse.data = result;
    SuccessResponse.message = 'Holiday removed and cache invalidated.';
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.message = error.message || 'Error removing holiday';
    ErrorResponse.error = error;
    return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
  }
}

module.exports = {
  declareHoliday,
  getHolidays,
  removeHoliday
};
