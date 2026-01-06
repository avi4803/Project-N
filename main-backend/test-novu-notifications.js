const { publishNotification } = require('./src/services/notification-publisher');
require('dotenv').config();

async function testNovuNotifications() {
  console.log('🚀 Starting Novu Notification Test...');

  // 1. Student: Attendance Marked
  console.log('\n1️⃣ Testing ATTENDANCE_MARKED...');
  await publishNotification('ATTENDANCE_MARKED', {
    userId: 'test-student-1',
    to: 'test-student@ethereal.email',
    name: 'Test Student',
    sessionId: 'session-123',
    subject: 'Mathematics',
    date: new Date().toDateString(),
    time: '10:00 AM'
  });

  // 2. Student: Absent Alert
  console.log('\n2️⃣ Testing ATTENDANCE_ABSENT...');
  await publishNotification('ATTENDANCE_ABSENT', {
    userId: 'test-student-1',
    to: 'test-student@ethereal.email',
    name: 'Test Student',
    subjectName: 'Physics',
    date: new Date().toDateString()
  });

  // 3. Faculty: OCR Success
  console.log('\n3️⃣ Testing OCR_SUCCESS...');
  await publishNotification('OCR_SUCCESS', {
    userId: 'test-faculty-1',
    to: 'test-faculty@ethereal.email',
    name: 'Test Faculty',
    subject: 'OCR Processing Completed',
    message: 'Your attendance sheet has been processed.'
  });

  // 4. Admin: New Registration
  console.log('\n4️⃣ Testing NEW_REGISTRATION...');
  await publishNotification('NEW_REGISTRATION', {
    userId: 'test-admin-1',
    to: 'test-admin@ethereal.email',
    name: 'Admin User',
    collegeName: 'Test College',
    collegeId: 'college-123'
  });

  // 5. Broadcast: Emergency
  console.log('\n5️⃣ Testing BROADCAST_EMERGENCY...');
  await publishNotification('BROADCAST_EMERGENCY', {
    title: 'Emergency Alert',
    message: 'College is closed due to heavy rain.',
    targetAudience: 'ALL',
    senderId: 'admin-1',
    senderName: 'System Admin'
  });

  console.log('\n✅ All test events published to queue.');
  setTimeout(() => process.exit(0), 2000);
}

testNovuNotifications();
