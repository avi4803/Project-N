const { StatusCodes } = require('http-status-codes');
const Notification = require('../models/Notification');
const NotificationRead = require('../models/NotificationRead');

const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user;
        const user = req.fullUser; // Attached by checkAuth middleware
        const limit = req.query.limit || 20;
        const personal = req.query.personal || 'false';
        const category = req.query.category;

        // 1. Build query based on whether user wants only personal or everything
        let query = { deletedAt: null };

        if (personal === 'true') {
            query.userIds = userId;
        } else {
            // Complex OR query for targeting
            query.$or = [
                { userIds: userId },
                { isGlobal: true }
            ];
            
            if (user?.section) query.$or.push({ sectionId: user.section._id || user.section });
            if (user?.batch) query.$or.push({ batchId: user.batch._id || user.batch });
            if (user?.college) query.$or.push({ collegeId: user.college._id || user.college });
        }

        // Add category filter if provided
        if (category) {
            query.category = category;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        // 2. Fetch read status for these notifications
        const notificationIds = notifications.map(n => n._id);
        const readEntries = await NotificationRead.find({
            userId: userId,
            notificationId: { $in: notificationIds }
        });

        const readSet = new Set(readEntries.map(r => r.notificationId.toString()));

        // 3. Map status to results
        const result = notifications.map(n => {
            // Check if user is in userIds list (for personal/group hybrid)
            const doc = n.toObject();
            doc.isRead = readSet.has(n._id.toString());
            return doc;
        });

        return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Notifications fetched successfully',
            data: result,
            error: {}
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
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
        const userId = req.user;
        
        // Upsert read status
        await NotificationRead.findOneAndUpdate(
            { userId, notificationId: id },
            { readAt: new Date() },
            { upsert: true, new: true }
        );

        return res.status(StatusCodes.OK).json({
            success: true,
            message: 'Notification marked as read',
            data: {},
            error: {}
        });
    } catch (error) {
        console.error('Error marking read:', error);
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
