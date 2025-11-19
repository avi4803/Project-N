const {StatusCodes} = require('http-status-codes');
const {BatchSectionService} = require('../services');
const { ErrorResponse} = require('../utils/');
const { SuccessResponse } = require('../utils/');




async function createBatch(req, res) {
    try {
        // Extract admin ID from authenticated user (set by checkAuth middleware)
        const adminId = req.user;
        
        // Prepare batch data with admin ID
        const batchData = {
            ...req.body,
            adminId: adminId
        };
        
        const batch = await BatchSectionService.createBatch(batchData);
        
        SuccessResponse.data = batch;
        SuccessResponse.message = 'Batch created successfully';
        
        return res.status(StatusCodes.CREATED).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error creating batch';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}



async function createSection(req, res) {
    try {
        // Extract admin ID from authenticated user (set by checkAuth middleware)
        const adminId = req.user;
        
        // Prepare section data with admin ID
        const sectionData = {
            ...req.body,
            adminId: adminId
        };
        
        const section = await BatchSectionService.createSection(sectionData);
        
        SuccessResponse.data = section;
        SuccessResponse.message = 'Section created successfully';
        
        return res.status(StatusCodes.CREATED).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error creating section';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}




module.exports = {
    createBatch,
    createSection
}