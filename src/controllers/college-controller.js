const {StatusCodes} = require('http-status-codes');
const {CollegeService} = require('../services');
const { ErrorResponse} = require('../utils/');
const { SuccessResponse } = require('../utils/');




async function createCollege(req, res) {
    try {
        // Extract admin ID from authenticated user (set by checkAuth middleware)
        const adminId = req.user;
        
        // Prepare college data with admin ID
        const collegeData = {
            ...req.body,
            adminId: adminId
        };
        
        const college = await CollegeService.createCollege(collegeData);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'College created successfully';
        
        return res.status(StatusCodes.CREATED).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error creating college';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}




module.exports = {
    createCollege
}