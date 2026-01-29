const Notification = require('../models/Notification');
const NotificationRead = require('../models/NotificationRead');

const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { sectionId, batchId, collegeId, limit = 10, personal = 'false', category } = req.query;

        // 1. Build query based on whether user wants only personal or everything
        let query;
        if (personal === 'true') {
            query = { userIds: userId, deletedAt: null };
        } else {
            query = {
                $or: [
                    { userIds: userId },
                    { sectionId: sectionId },
                    { batchId: batchId },
                    { collegeId: collegeId },
                    { isGlobal: true }
                ],
                deletedAt: null
            };
        }

        // Add category filter if provided
        if (category) {
            query.category = category;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        // 2. Fetch read status for these notifications
        const readEntries = await NotificationRead.find({
            userId,
            notificationId: { $in: notifications.map(n => n._id) }
        });

        const readSet = new Set(readEntries.map(r => r.notificationId.toString()));

        // 3. Map status to results
        const result = notifications.map(n => {
            const doc = n.toObject();
            doc.isRead = readSet.has(n._id.toString());
            return doc;
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications'
        });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params; // notificationId
        const { userId } = req.body; // userId must be provided in body

        if (!userId) {
             return res.status(400).json({ success: false, message: 'userId required' });
        }

        // Upsert read status
        await NotificationRead.findOneAndUpdate(
            { userId, notificationId: id },
            { readAt: new Date() },
            { upsert: true, new: true }
        );
        
        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating notification status'
        });
    }
};

module.exports = {
    getUserNotifications,
    markAsRead
};
