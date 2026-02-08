const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Direct targets (Optional)
    userIds: [{ type: String, index: true }], // Specific list of users
    
    // Group targets (Optional)
    sectionId: { type: String, index: true },
    batchId: { type: String, index: true },
    collegeId: { type: String, index: true },
    
    // Global target
    isGlobal: { type: Boolean, default: false },

    // Content
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['ClassReminders', 'AttendanceAlerts', 'AdminAnnouncements'],
        default: 'AdminAnnouncements',
        index: true 
    },
    data: { type: Object, default: {} },
    
    createdAt: { type: Date, default: Date.now },
    
    // Soft Delete (Admin removal or global dismissal)
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Index for context-aware fetching
notificationSchema.index({ collegeId: 1, batchId: 1, sectionId: 1, createdAt: -1 });

// Archive Strategy: TTL Index
// Automatically remove notifications older than 10 days to maintain performance and hygiene
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10 * 24 * 60 * 60 }); 

module.exports = mongoose.model('Notification', notificationSchema);
