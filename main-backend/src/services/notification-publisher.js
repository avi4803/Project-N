const notificationQueue = require('../queues/notification-queue');

/**
 * Publish a notification event to the queue
 * @param {string} type - Notification type (EMAIL, SMS, PUSH)
 * @param {object} payload - Data required for the notification
 */
const User = require('../models/User');

/**
 * Helper to fetch FCM token for a user
 */
async function getFcmToken(userId, email) {
    if (!userId && !email) return null;
    
    const query = {};
    if (userId) query._id = userId;
    else if (email) query.email = email;
    
    const user = await User.findOne(query).select('fcmToken');
    return user ? user.fcmToken : null;
}

/**
 * Publish a notification event to the queue
 * @param {string} type - Notification type (EMAIL, SMS, PUSH)
 * @param {object} payload - Data required for the notification
 */
const publishNotification = async (type, payload) => {
  try {
    // 0. Auto-assign category if missing
    if (!payload.category) {
        if (type.startsWith('ATTENDANCE_') || type.startsWith('STREAK_')) {
            payload.category = 'AttendanceAlerts';
        } else if (type.startsWith('CLASS_')) {
            payload.category = 'ClassReminders';
        } else {
            payload.category = 'AdminAnnouncements';
        }
    }

    // 1. Check if this is a group notification (Section, Batch, College, or Role wide)
    if (payload.sectionId || payload.batchId || payload.collegeId || payload.roles) {
        const query = { isActive: true };
        if (payload.sectionId) query.section = payload.sectionId;
        if (payload.batchId) query.batch = payload.batchId;
        if (payload.collegeId) query.college = payload.collegeId;
        if (payload.roles) query.roles = { $in: Array.isArray(payload.roles) ? payload.roles : [payload.roles] };
        
        // Find all users in this group to get their FCM tokens
        const users = await User.find(query).select('_id fcmToken');
        const tokens = users.filter(u => !!u.fcmToken).map(u => u.fcmToken);
        const userIds = users.map(u => u._id.toString());

        console.log(`📢 Publishing group notification to ${users.length} users (${tokens.length} FCM tokens).`);

        // Send ONE targeted job for the whole group
        return await notificationQueue.add({
            type,
            payload: {
                ...payload,
                userIds,       // To track potential recipients in analytics
                fcmTokens: tokens // For multicast FCM
            }
        }, {
            attempts: 3,
            removeOnComplete: true
        });
    }


    // 2. Individual notification enrichment
    if (payload.userId || payload.email || payload.to) {
        const query = {};
        if (payload.userId) query._id = payload.userId;
        else if (payload.email) query.email = payload.email;
        else if (payload.to && payload.to.includes('@')) query.email = payload.to;

        const user = await User.findOne(query).select('_id fcmToken');
        if (user) {
            payload.userId = user._id.toString(); // Ensure userId is always ID string
            if (user.fcmToken) payload.fcmToken = user.fcmToken;
        }
    }

    await notificationQueue.add({
      type,
      payload
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true
    });
    console.log(`📢 Notification event published: ${type}`);
  } catch (error) {
    console.error('❌ Error publishing notification:', error);
  }
};


/**
 * Publish multiple notifications efficiently
 * @param {Array<{type: string, payload: object}>} notifications 
 */
const publishBulkNotifications = async (notifications) => {
  try {
    // 1. Collect User IDs and Emails to fetch tokens in parallel
    const userIds = [];
    const emails = [];
    
    notifications.forEach(n => {
        if (!n.payload.fcmToken) {
            if (n.payload.userId) userIds.push(n.payload.userId);
            else if (n.payload.email) emails.push(n.payload.email);
            else if (n.payload.to && n.payload.to.includes('@')) emails.push(n.payload.to);
        }
    });

    let userMap = {}; // Map identifier -> token

    if (userIds.length > 0 || emails.length > 0) {
        const users = await User.find({
            $or: [
                { _id: { $in: userIds } },
                { email: { $in: emails } }
            ]
        }).select('_id email fcmToken');

        users.forEach(u => {
            if (u.fcmToken) {
                userMap[u._id.toString()] = u.fcmToken;
                userMap[u.email] = u.fcmToken;
            }
        });
    }

    // 2. Enrich payloads
    const jobs = notifications.map(n => {
        let token = n.payload.fcmToken;
        if (!token) {
            if (n.payload.userId && userMap[n.payload.userId]) token = userMap[n.payload.userId];
            else if (n.payload.email && userMap[n.payload.email]) token = userMap[n.payload.email];
            else if (n.payload.to && userMap[n.payload.to]) token = userMap[n.payload.to];
        }
        
        // Clone payload and add token and category
        const enrichedPayload = { ...n.payload };
        if (token) enrichedPayload.fcmToken = token;
        
        if (!enrichedPayload.category) {
            if (n.type.startsWith('ATTENDANCE_') || n.type.startsWith('STREAK_')) {
                enrichedPayload.category = 'AttendanceAlerts';
            } else if (n.type.startsWith('CLASS_')) {
                enrichedPayload.category = 'ClassReminders';
            } else {
                enrichedPayload.category = 'AdminAnnouncements';
            }
        }

        return {
            name: 'notification-queue',
            data: {
                type: n.type,
                payload: enrichedPayload
            },
            opts: {
                attempts: 3,
                removeOnComplete: true
            }
        };
    });

    await notificationQueue.addBulk(jobs);
    console.log(`📢 Bulk notifications published: ${jobs.length} jobs`);
  } catch (error) {
    console.error('❌ Error publishing bulk notifications:', error);
  }
};

module.exports = { publishNotification, publishBulkNotifications };
