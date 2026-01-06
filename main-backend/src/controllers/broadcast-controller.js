const { StatusCodes } = require('http-status-codes');
const { SuccessResponse, ErrorResponse } = require('../utils/');
const { publishNotification } = require('../services/notification-publisher');

/**
 * Send a broadcast notification (Emergency or Event)
 * Only accessible by Admins
 */
async function sendBroadcast(req, res) {
    try {
        const { type, title, message, targetAudience } = req.body;
        
        // type: 'EMERGENCY' or 'EVENT'
        // targetAudience: 'ALL', 'STUDENTS', 'FACULTY' (logic to be handled by consumer or here)
        
        if (!title || !message) {
            throw new Error('Title and message are required');
        }
        
        const notificationType = type === 'EMERGENCY' ? 'BROADCAST_EMERGENCY' : 'BROADCAST_EVENT';
        
        // Publish to queue
        // The consumer will handle fetching all users and sending notifications via Novu's Topic or Subscriber lists
        await publishNotification(notificationType, {
            title,
            message,
            targetAudience: targetAudience || 'ALL',
            senderId: req.user.id,
            senderName: req.user.name
        });
        
        SuccessResponse.message = 'Broadcast queued successfully';
        SuccessResponse.data = { type, title, targetAudience };
        
        return res.status(StatusCodes.OK).json(SuccessResponse);
        
    } catch (error) {
        ErrorResponse.error = error;
        ErrorResponse.message = error.message || 'Error sending broadcast';
        return res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json(ErrorResponse);
    }
}

module.exports = {
    sendBroadcast
};
