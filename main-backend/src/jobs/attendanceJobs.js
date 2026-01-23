const cron = require('node-cron');
const AttendanceService = require('../services/attendance-service');

/**
 * Cron Jobs for Automated Attendance Management
 * - Sessions created daily at 12:01 AM with marking open for entire day
 * - Previous day's sessions closed at 12:05 AM
 */

// Generate Weekly Sessions every Sunday at 00:01 AM for the upcoming week
const generateWeeklySessions = cron.schedule('1 0 * * 0', async () => {
  try {
    console.log('🕒 Running Weekly Session Generation job...');
    const WeeklySessionService = require('../services/weekly-session-service');
    
    // Generate for the week starting tomorrow (Monday)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Monday

    const result = await WeeklySessionService.generateForWeek(tomorrow);
    console.log(`✅ Generated weekly sessions for Week ${result.weekNumber}, ${result.year}. Count: ${result.generatedSessions}`);
  } catch (error) {
    console.error('❌ Error in weekly session generation:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Asia/Kolkata' 
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
  generateWeeklySessions.start();
  closeSessionsJob.start();
  activateSessionsJob.start();
  
  console.log('✅ Attendance cron jobs started:');
  console.log('   - Weekly session generation on Sundays at 12:01 AM');
  console.log('   - Previous day sessions close at 12:05 AM');
  console.log('   - Daily check at 9:00 AM');
}

/**
 * Stop all cron jobs
 */
function stopAttendanceJobs() {
  generateWeeklySessions.stop();
  closeSessionsJob.stop();
  activateSessionsJob.stop();
  
  console.log('⏹️  Attendance cron jobs stopped');
}

module.exports = {
  startAttendanceJobs,
  stopAttendanceJobs,
  generateWeeklySessions,
  activateSessionsJob,
  closeSessionsJob
};
