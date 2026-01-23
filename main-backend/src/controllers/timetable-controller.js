const { StatusCodes } = require('http-status-codes');
const { TimetableService } = require('../services');
const { ErrorResponse } = require('../utils/');
const { SuccessResponse } = require('../utils/');
const { publishNotification } = require('../services/notification-publisher');

// Create new timetable
async function createTimetable(req, res) {
    try {
        const adminId = req.user;
        
        const timetableData = {
            ...req.body,
            adminId: adminId
        };
        
        const timetable = await TimetableService.createTimetable(timetableData);
        
        SuccessResponse.data = timetable;
        SuccessResponse.message = 'Timetable created successfully';
        
        return res.status(StatusCodes.CREATED).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error creating timetable';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get timetable by batch and section
async function getTimetable(req, res) {
    try {
        const { batchId, sectionId } = req.params;
        
        const timetable = await TimetableService.getTimetable(batchId, sectionId);
        
        SuccessResponse.data = timetable;
        SuccessResponse.message = 'Timetable fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching timetable';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get all timetables
async function getAllTimetables(req, res) {
    try {
        // Optional filters from query parameters
        const filters = {};
        if (req.query.batch) filters.batch = req.query.batch;
        if (req.query.section) filters.section = req.query.section;
        if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
        
        const timetables = await TimetableService.getAllTimetables(filters);
        
        SuccessResponse.data = timetables;
        SuccessResponse.message = 'Timetables fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching timetables';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get timetable by ID
async function getTimetableById(req, res) {
    try {
        const { id } = req.params;
        
        const timetable = await TimetableService.getTimetableById(id);
        
        SuccessResponse.data = timetable;
        SuccessResponse.message = 'Timetable fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching timetable';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Update timetable
async function updateTimetable(req, res) {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const timetable = await TimetableService.updateTimetable(id, updateData);
        
        SuccessResponse.data = timetable;
        SuccessResponse.message = 'Timetable updated successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error updating timetable';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Add a single class to timetable
async function addClass(req, res) {
    try {
        const { id } = req.params;
        const classData = req.body;
        
        const timetable = await TimetableService.addClass(id, classData);
        
        SuccessResponse.data = timetable;
        SuccessResponse.message = 'Class added successfully';
        
        // 📣 Notify Students of the new permanent class
        await publishNotification('CLASS_ADDED', {
            batchId: (timetable.batch._id || timetable.batch).toString(),
            sectionId: (timetable.section._id || timetable.section).toString(),
            title: 'Timetable Updated',
            message: `New class: ${classData.subject} on ${classData.day}s at ${classData.startTime} - ${classData.endTime}`,
            subjectName: classData.subject,
            day: classData.day,
            time: `${classData.startTime} - ${classData.endTime}`
        });

        return res.status(StatusCodes.OK).json(SuccessResponse);

        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error adding class';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Remove a class from timetable
async function removeClass(req, res) {
    try {
        const { id, classId } = req.params;
        
        const timetable = await TimetableService.removeClass(id, classId);
        
        SuccessResponse.data = timetable;
        SuccessResponse.message = 'Class removed successfully';
        
        // Notify students of the gap/cancellation
        await publishNotification('CLASS_CANCELLED', {
            batchId: (timetable.batch._id || timetable.batch).toString(),
            sectionId: (timetable.section._id || timetable.section).toString(),
            title: 'Class Removed',
            message: 'A class has been removed from your timetable by the administrator.',
            subjectName: 'Class',
            reason: 'Class removed by admin'
        });

        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error removing class';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get timetable by day
async function getTimetableByDay(req, res) {
    try {
        const { id, day } = req.params;
        
        const daySchedule = await TimetableService.getTimetableByDay(id, day);
        
        SuccessResponse.data = daySchedule;
        SuccessResponse.message = `${day} schedule fetched successfully`;
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching day schedule';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Delete timetable
async function deleteTimetable(req, res) {
    try {
        const { id } = req.params;
        
        const result = await TimetableService.deleteTimetable(id);
        
        SuccessResponse.data = result;
        SuccessResponse.message = 'Timetable deleted successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error deleting timetable';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

// Get timetables by college
async function getTimetablesByCollege(req, res) {
    try {
        const { collegeId } = req.params;
        
        const timetables = await TimetableService.getTimetablesByCollege(collegeId);
        
        SuccessResponse.data = timetables;
        SuccessResponse.message = 'College timetables fetched successfully';
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error fetching college timetables';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

module.exports = {
    createTimetable,
    getTimetable,
    getAllTimetables,
    getTimetableById,
    updateTimetable,
    addClass,
    removeClass,
    getTimetableByDay,
    deleteTimetable,
    getTimetablesByCollege
};