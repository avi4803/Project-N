const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    notificationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Notification',
        required: true
    },
    readAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Ensure unique read entry per user per notification
notificationReadSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

// Auto-delete read receipts after 7 days to save space
notificationReadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);
