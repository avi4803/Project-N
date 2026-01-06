const notificationQueue = require('../config/notification-queue');

/**
 * Publish a notification event to the queue
 * @param {string} type - Notification type (EMAIL, SMS, PUSH)
 * @param {object} payload - Data required for the notification
 */
const publishNotification = async (type, payload) => {
  try {
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

module.exports = { publishNotification };
