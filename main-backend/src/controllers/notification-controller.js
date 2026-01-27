const axios = require('axios');
const { StatusCodes } = require('http-status-codes');

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3001/api/notifications';

const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user;
        const user = req.fullUser; // Attached by checkAuth middleware
        const limit = req.query.limit || 20;
        const personal = req.query.personal || 'false';
        const category = req.query.category;

        // Build context-aware query params
        const params = {
            limit,
            personal,
            category,
            sectionId: user?.section?._id || user?.section,
            batchId: user?.batch?._id || user?.batch,
            collegeId: user?.college?._id || user?.college
        };

        const response = await axios.get(`${NOTIFICATION_SERVICE_URL}/user/${userId}`, {
            params
        });

        return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Notifications fetched successfully',
            data: response.data.data,
            error: {}
        });
    } catch (error) {
        console.error('Error fetching notifications from service:', error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch notifications',
            data: [],
            error: error.message
        });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user; // Use the authenticated user's ID
        
        const response = await axios.patch(`${NOTIFICATION_SERVICE_URL}/${id}/read`, {
            userId
        });

        return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Notification marked as read',
            data: response.data,
            error: {}
        });
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update notification',
            data: {},
            error: error.message
        });
    }
};

module.exports = {
    getMyNotifications,
    markAsRead
};
