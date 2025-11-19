const cron = require('node-cron');
const AttendanceService = require('../services/attendance-service');

/**
 * Cron Jobs for Automated Attendance Management
 * - Sessions created daily at 12:01 AM with marking open for entire day
 * - Previous day's sessions closed at 12:05 AM
 */

// Create today's sessions daily at 12:01 AM (auto-activated for whole day)
const createDailySessions = cron.schedule('1 0 * * *', async () => {
  try {
    console.log('🕒 Running daily session creation job...');
    const sessions = await AttendanceService.createTodaySessions();
    console.log(`✅ Created ${sessions.length} sessions for today (marking open all day)`);
  } catch (error) {
    console.error('❌ Error in daily session creation:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Asia/Kolkata' // Adjust to your timezone
});

// Close previous day's sessions at 12:05 AM
const closeSessionsJob = cron.schedule('5 0 * * *', async () => {
  try {
    console.log('🕒 Closing previous day sessions...');
    const sessions = await AttendanceService.closeSessions();
    if (sessions.length > 0) {
      console.log(`✅ Closed ${sessions.length} sessions from yesterday`);
    }
  } catch (error) {
    console.error('❌ Error closing sessions:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Asia/Kolkata'
});

// Check active sessions (informational, runs once at 9 AM)
const activateSessionsJob = cron.schedule('0 9 * * *', async () => {
  try {
    const sessions = await AttendanceService.activateSessions();
    console.log(`ℹ️  ${sessions.length} sessions active today (students can mark attendance anytime today)`);
  } catch (error) {
    console.error('❌ Error checking sessions:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Asia/Kolkata'
});

/**
 * Start all cron jobs
 */
function startAttendanceJobs() {
  createDailySessions.start();
  closeSessionsJob.start();
  activateSessionsJob.start();
  
  console.log('✅ Attendance cron jobs started:');
  console.log('   - Daily session creation at 12:01 AM (marking open all day)');
  console.log('   - Previous day sessions close at 12:05 AM');
  console.log('   - Daily check at 9:00 AM');
}

/**
 * Stop all cron jobs
 */
function stopAttendanceJobs() {
  createDailySessions.stop();
  closeSessionsJob.stop();
  activateSessionsJob.stop();
  
  console.log('⏹️  Attendance cron jobs stopped');
}

module.exports = {
  startAttendanceJobs,
  stopAttendanceJobs,
  createDailySessions,
  activateSessionsJob,
  closeSessionsJob
};
