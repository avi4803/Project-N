const { StatusCodes } = require('http-status-codes');
const { SuccessResponse, ErrorResponse } = require('../utils/');
const { publishNotification } = require('../services/notification-publisher');

/**
 * Send a broadcast notification (Emergency or Event)
 * Supports targeting specific Sections, Batches, or the whole College.
 */
async function sendBroadcast(req, res) {
    try {
        const { type, title, message, targetAudience, filterId } = req.body;
        
        if (!title || !message) {
            throw new Error('Title and message are required');
        }

        // Prepare group filter payload
        const notifyPayload = {
            title,
            message,
            senderName: req.fullUser.name,
            timestamp: new Date().toISOString()
        };

        // Determine target based on audience and filterId
        switch (targetAudience) {
            case 'COLLEGE':
                notifyPayload.collegeId = req.fullUser.college?._id || req.fullUser.college;
                break;

            case 'BATCH':
                notifyPayload.batchId = filterId || req.fullUser.batch?._id || req.fullUser.batch;
                if (!notifyPayload.batchId) throw new Error('Batch ID is required');
                break;

            case 'SECTION':
                notifyPayload.sectionId = filterId || req.fullUser.section?._id || req.fullUser.section;
                if (!notifyPayload.sectionId) throw new Error('Section ID is required');
                break;

            case 'FACULTY':
                notifyPayload.collegeId = req.fullUser.college?._id || req.fullUser.college;
                notifyPayload.roles = ['admin', 'local-admin'];
                break;
            
            default:
                throw new Error('Invalid targetAudience. Use COLLEGE, BATCH, SECTION, or FACULTY');
        }

        const notificationType = type === 'EMERGENCY' ? 'BROADCAST_EMERGENCY' : 'BROADCAST_EVENT';

        // Fire and Forget (Group-aware Publisher handles the lookup)
        await publishNotification(notificationType, notifyPayload);
        
        SuccessResponse.message = `Broadcast queued for ${targetAudience} targeting`;
        SuccessResponse.data = { type, audience: targetAudience };
        
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
