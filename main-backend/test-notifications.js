const { publishNotification } = require('./src/services/notification-publisher');
require('dotenv').config();

async function testNotifications() {
  console.log('🚀 Starting Notification Test...');

  // Test 1: Attendance Marked
  console.log('\n1️⃣ Testing Attendance Notification...');
  await publishNotification('EMAIL', {
    to: 'test-student@ethereal.email',
    subject: 'Test: Attendance Marked',
    html: '<p>This is a test notification for attendance marking.</p>'
  });

  // Test 2: OCR Success
  console.log('\n2️⃣ Testing OCR Success Notification...');
  await publishNotification('EMAIL', {
    to: 'test-teacher@ethereal.email',
    subject: 'Test: OCR Success',
    html: '<p>This is a test notification for OCR completion.</p>'
  });

  // Test 3: Streak Milestone
  console.log('\n3️⃣ Testing Streak Notification...');
  await publishNotification('EMAIL', {
    to: 'test-student@ethereal.email',
    subject: 'Test: 5 Day Streak!',
    html: '<p>This is a test notification for a gamification streak.</p>'
  });

  console.log('\n✅ All test events published to queue.');
  console.log('👉 Check Notification-service console for delivery logs.');
  
  // Allow time for logs to appear if running in same terminal (optional)
  setTimeout(() => process.exit(0), 2000);
}

testNotifications();
