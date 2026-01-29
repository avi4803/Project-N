const Queue = require('bull');
const redisConfig = require('./src/config/redis');

console.log('🔌 Connecting to Redis...');
const notificationQueue = new Queue('notification-queue', {
  redis: redisConfig
});

const executeTest = async () => {
  try {
    console.log('🚀 Triggering Test Notifications...');

    // 1. Test Welcome Email (Email Service)
    console.log('1️⃣  Adding WELCOME_USER job...');
    await notificationQueue.add({
      type: 'WELCOME_USER',
      payload: {
        to: 'test@example.com', // Check server console for "Welcome email sent to..."
        name: 'Test User'
      }
    });

    // 2. Test Attendance Notification (FCM Service)
    console.log('2️⃣  Adding ATTENDANCE_MARKED job (FCM)...');
    await notificationQueue.add({
      type: 'ATTENDANCE_MARKED',
      payload: {
        fcmToken: 'fake_device_token_for_testing', // Expect FCM error in logs
        title: 'Test Notification',
        body: 'This is a test notification from the queue.',
        userId: 'test-user-id'
      }
    });

    console.log('✅ Jobs added to queue.');
    console.log('👉 Check your "Notification-service" terminal to see if they are processed!');
    
    // Allow time for processing before exiting (optional, but good for script cleanup)
    setTimeout(() => {
        console.log('👋 Exiting test script.');
        process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Error adding test jobs:', error);
    process.exit(1);
  }
};

executeTest();
