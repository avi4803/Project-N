const cron = require('node-cron');

/**
 * Cron Jobs for Automated Attendance Management
 * Simplified: Only weekly session generation is needed as placeholders.
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

/**
 * Start all relevant cron jobs
 */
function startAttendanceJobs() {
  generateWeeklySessions.start();
  
  console.log('✅ Attendance cron jobs started:');
  console.log('   - Weekly session generation on Sundays at 12:01 AM');
}

/**
 * Stop all cron jobs
 */
function stopAttendanceJobs() {
  generateWeeklySessions.stop();
  console.log('⏹️  Attendance cron jobs stopped');
}

module.exports = {
  startAttendanceJobs,
  stopAttendanceJobs,
  generateWeeklySessions
};
