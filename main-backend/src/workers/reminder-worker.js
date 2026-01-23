const reminderQueue = require('../config/reminder-queue');
const WeeklySessionClass = require('../models/WeeklySessionClass');
const User = require('../models/User');
const { publishNotification } = require('../services/notification-publisher');

/**
 * Process delayed class reminders
 */
reminderQueue.process(async (job) => {
    const { classId, offsetMinutes, sectionId, batchId } = job.data;
    const logPrefix = `⏰ ReminderWorker [${offsetMinutes}m]:`;

    console.log(`${logPrefix} Processing job for class ${classId}`);

    try {
        // 1. Check if class exists and is ACTIVE
        const cls = await WeeklySessionClass.findById(classId).populate('subject', 'name');
        
        if (!cls) {
            console.log(`${logPrefix} Class not found (maybe deleted). Skipping.`);
            return;
        }

        if (cls.status === 'cancelled') {
            console.log(`${logPrefix} Class is cancelled. Skipping reminder.`);
            return;
        }

        // 2. Find Users who opted for this specific offset
        // We look for users in this Batch & Section who have 'offsetMinutes' in their settings
        const users = await User.find({
            batch: batchId,
            section: sectionId,
            isActive: true, // Only active users
            reminderSettings: { $in: [offsetMinutes] }
        }).select('_id fcmToken');

        if (users.length === 0) {
            console.log(`${logPrefix} No users found with ${offsetMinutes}m preference.`);
            return;
        }

        const fcmTokens = users.filter(u => !!u.fcmToken).map(u => u.fcmToken);
        const userIds = users.map(u => u._id.toString());

        if (fcmTokens.length === 0) {
            console.log(`${logPrefix} Users found but no FCM tokens.`);
            return;
        }

        console.log(`${logPrefix} Sending alert to ${users.length} users.`);

        // 3. Publish Notification
        // We use Multicast via Notification Service
        await publishNotification('CLASS_REMINDER', {
            type: 'CLASS_REMINDER',
            title: `Class Starting Soon!`,
            message: `${cls.subject.name} starts in ${offsetMinutes} mins in ${cls.room || 'class'}.`,
            classId: cls._id.toString(),
            offset: offsetMinutes,
            
            // Targeted delivery
            fcmTokens: fcmTokens,
            userIds: userIds, // For tracking
            
            // Metadata for deep linking
            data: {
                screen: 'ScheduleDetail',
                classId: cls._id.toString(),
                status: cls.status
            }
        });

    } catch (error) {
        console.error(`${logPrefix} Error processing reminder:`, error);
        throw error; // Let Bull retry if it's a transient error
    }
});

console.log('👷 Reminder Worker started...');
