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




// Get batches
async function getBatches(req, res) {
    try {
        const batches = await BatchSectionService.getBatches(req.query);
        SuccessResponse.data = batches;
        SuccessResponse.message = 'Batches fetched successfully';
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching batches';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get sections
async function getSections(req, res) {
    try {
        const sections = await BatchSectionService.getSections(req.query);
        SuccessResponse.data = sections;
        SuccessResponse.message = 'Sections fetched successfully';
        return res.status(StatusCodes.OK).json(SuccessResponse);
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching sections';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

module.exports = {
    createBatch,
    createSection,
    getBatches,
    getSections
}