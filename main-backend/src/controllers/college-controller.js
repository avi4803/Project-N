const { StatusCodes } = require('http-status-codes');
const { CollegeService } = require('../services');
const { ErrorResponse } = require('../utils/');
const { SuccessResponse } = require('../utils/');
const { publishNotification } = require('../services/notification-publisher');

// Create new college
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
        
        // Notify Admin (using a fixed admin email or fetching super admins)
        // For now, we'll send to the creator (adminId) if they have an email, 
        // or a configured system admin email.
        if (req.user.email) {
             publishNotification('NEW_REGISTRATION', {
                userId: req.user.id,
                to: req.user.email, // notifying the admin who created it
                name: req.user.name || 'Admin',
                collegeName: college.name,
                collegeId: college._id.toString()
             });
        }
        
        return res.status(StatusCodes.CREATED).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error creating college';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get all colleges
async function getAllColleges(req, res) {
    try {
        const colleges = await CollegeService.getAllColleges();
        
        SuccessResponse.data = colleges;
        SuccessResponse.message = 'Colleges fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching colleges';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get college by ID
async function getCollegeById(req, res) {
    try {
        const { collegeId } = req.params;
        
        const college = await CollegeService.getCollegeById(collegeId);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'College details fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching college details';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get registered emails for a college
async function getRegisteredEmails(req, res) {
    try {
        const { collegeId } = req.params;
        
        const data = await CollegeService.getRegisteredEmails(collegeId);
        
        SuccessResponse.data = data;
        SuccessResponse.message = 'Registered emails fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching registered emails';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Update college
async function updateCollege(req, res) {
    try {
        const { collegeId } = req.params;
        const updateData = req.body;
        
        const college = await CollegeService.updateCollege(collegeId, updateData);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'College updated successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error updating college';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Deactivate college
async function deactivateCollege(req, res) {
    try {
        const { collegeId } = req.params;
        
        const college = await CollegeService.deactivateCollege(collegeId);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'College deactivated successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error deactivating college';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Add these to college-controller.js

// Activate college
async function activateCollege(req, res) {
    try {
        const { collegeId } = req.params;
        
        const college = await CollegeService.activateCollege(collegeId);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'College activated successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error activating college';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Add email domain
async function addEmailDomain(req, res) {
    try {
        const { collegeId } = req.params;
        const { domain } = req.body;
        
        if (!domain) {
            ErrorResponse.message = 'Email domain is required';
            return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
        }
        
        const college = await CollegeService.addEmailDomain(collegeId, domain);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'Email domain added successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error adding email domain';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Remove email domain
async function removeEmailDomain(req, res) {
    try {
        const { collegeId, domain } = req.params;
        
        const college = await CollegeService.removeEmailDomain(collegeId, domain);
        
        SuccessResponse.data = college;
        SuccessResponse.message = 'Email domain removed successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error removing email domain';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get college statistics
async function getCollegeStats(req, res) {
    try {
        const { collegeId } = req.params;
        
        const stats = await CollegeService.getCollegeStats(collegeId);
        
        SuccessResponse.data = stats;
        SuccessResponse.message = 'College statistics fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching statistics';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Update exports
module.exports = {
    createCollege,
    getAllColleges,
    getCollegeById,
    getRegisteredEmails,
    updateCollege,
    deactivateCollege,
    activateCollege,
    addEmailDomain,
    removeEmailDomain,
    getCollegeStats
};

