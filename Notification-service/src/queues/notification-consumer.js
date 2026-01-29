const Queue = require('bull');
const redisConfig = require('../config/redis');
const { sendOtpEmail, sendWelcomeEmail, sendPasswordResetOtpEmail } = require('../services/email-service');
const { sendPushNotification } = require('../services/fcm-service');

const notificationQueue = new Queue('notification-queue', {
  redis: redisConfig
});

notificationQueue.process(async (job) => {
  const { type, payload } = job.data;
  console.log(`📩 Processing ${type} notification`);

  try {
    switch (type) {
      // ----------------------------
      // EMAIL NOTIFICATIONS
      // ----------------------------
      case 'SEND_OTP':
        await sendOtpEmail(payload.to, payload.otp);
        console.log(`✅ OTP sent to ${payload.to}`);
        break;

      case 'RESET_PASSWORD_OTP':
        await sendPasswordResetOtpEmail(payload.to, payload.otp, payload.name);
        console.log(`✅ Password Reset OTP sent to ${payload.to}`);
        break;

      case 'WELCOME_USER':
        // Payload expected: to (email), name
        await sendWelcomeEmail(payload.to || payload.email, payload.name);
        console.log(`✅ Welcome email sent to ${payload.to || payload.email}`);
        break;

      // ----------------------------
      // FCM PUSH NOTIFICATIONS
      // ----------------------------
      case 'ATTENDANCE_MARKED':
      case 'ATTENDANCE_ABSENT':
      case 'ATTENDANCE_LOW':
      case 'STREAK_MILESTONE':
      case 'STREAK_BROKEN':
      case 'CLASS_REMINDER':
      case 'PROFILE_UPDATE':
      case 'CORRECTION_UPDATE':
      case 'OCR_SUCCESS':
      case 'OCR_FAILED':
      case 'NEW_REGISTRATION':
      case 'CLASS_CANCELLED':
      case 'CLASS_RESCHEDULED':
      case 'CLASS_ADDED':
      case 'BROADCAST_EMERGENCY':
      case 'BROADCAST_EVENT':
      case 'DAILY_BRIEFING': // 👈 Added Missing Case
        
        // 1. 🚀 PREPARE CONTENT
        const title = payload.title || getTitleForType(type);
        const body = payload.body || payload.message || getBodyForType(type, payload);

        // 2. 💾 SAVE TARGETED NOTIFICATION TO DATABASE
        const Notification = require('../models/Notification');
        let savedNotification = null;
        try {
            // Store once for the whole group/target
            savedNotification = await Notification.create({
                userIds: payload.userId ? [payload.userId.toString()] : (payload.userIds || []),
                sectionId: payload.sectionId?.toString(),
                batchId: payload.batchId?.toString(),
                collegeId: payload.collegeId?.toString(),
                isGlobal: !!payload.isGlobal,
                title,
                body,
                type,
                category: payload.category || getCategoryForType(type),
                data: payload.data || {}
            });
            console.log(`💾 Targeted notification saved: ${type} for ${payload.sectionId || 'individuals'}`);
        } catch (dbError) {
            console.error('❌ Error saving notification:', dbError);
        }

        // 3. 🚀 SEND PUSH (MULTICAST SUPPORT)
        const { sendPushNotification, sendMulticastNotification } = require('../services/fcm-service');
        const fcmData = { 
            ...(payload.data || {}), 
            notificationId: savedNotification?._id.toString() || '',
            type 
        };

        if (payload.fcmTokens && payload.fcmTokens.length > 0) {
            // Multicast for groups
            await sendMulticastNotification(payload.fcmTokens, title, body, fcmData);
            console.log(`✅ Multicast (${type}) sent to ${payload.fcmTokens.length} devices`);
        } else if (payload.fcmToken) {
            // Single device
            await sendPushNotification(payload.fcmToken, title, body, fcmData);
            console.log(`✅ Push notification (${type}) sent to single device`);
        } else {
            console.warn(`⚠️ Skipped FCM: No tokens provided for ${type}.`);
        }
        break;

      default:
        console.warn(`Unknown notification type: ${type}`);
    }

    console.log(`✅ Notification processing complete`);
  } catch (error) {
    console.error(`❌ Failed to process notification:`, error);
    throw error; // Triggers Bull retry mechanism
  }
});

// Helper to get default titles if not in payload
function getTitleForType(type) {
    switch(type) {
        case 'ATTENDANCE_MARKED': return 'Attendance Marked';
        case 'ATTENDANCE_ABSENT': return 'Absent Alert';
        case 'ATTENDANCE_LOW': return 'Low Attendance Warning';
        case 'CLASS_REMINDER': return 'Class Reminder';
        case 'CLASS_CANCELLED': return 'Class Cancelled';
        case 'CLASS_RESCHEDULED': return 'Class Rescheduled';
        case 'CLASS_ADDED': return 'New Class Added';
        default: return 'New Notification';
    }
}

// Helper to get default bodies if not in payload
function getBodyForType(type, payload) {
    // These are fallbacks. Ideally payload should have the formatted message.
    return payload.message || 'You have a new notification.';
}

// Helper to get category based on type
function getCategoryForType(type) {
    if (type.startsWith('ATTENDANCE_') || type.startsWith('STREAK_')) {
        return 'AttendanceAlerts';
    }
    if (type.startsWith('CLASS_')) {
        return 'ClassReminders';
    }
    return 'AdminAnnouncements';
}

module.exports = notificationQueue;

