const cron = require('node-cron');
const WeeklySessionClass = require('../models/WeeklySessionClass');
const User = require('../models/User');
const { publishNotification } = require('../services/notification-publisher');
const WeeklySessionService = require('../services/weekly-session-service');

/**
 * Check for upcoming classes starting in ~15 minutes
 * Runs every 5 minutes
 */
const scheduleClassReminders = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Checking for upcoming classes...');
    
    try {
      const now = new Date();
      const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);
      
      // Format time as HH:MM string in IST
      const targetTime = fifteenMinutesLater.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
      
      const istComp = WeeklySessionService.getISTComponents(fifteenMinutesLater);
      
      // Find sessions starting at targetTime
      const upcomingSessions = await WeeklySessionClass.find({
        dateString: istComp.dateString,
        status: 'scheduled',
        startTime: targetTime
      }).populate('subject batch section');
      
      for (const session of upcomingSessions) {
        // Find all students in this batch/section
        const students = await User.find({
          batch: session.batch._id,
          section: session.section._id,
          role: 'student',
          isActive: true
        }).select('email name phone');
        
        console.log(`📢 Sending reminders for ${session.subject.name} to ${students.length} students`);
        
        // Send notifications in parallel (with some batching in real prod)
        await Promise.all(students.map(student => {
          if (student.email) {
            return publishNotification('CLASS_REMINDER', {
              userId: student._id.toString(),
              to: student.email,
              name: student.name,
              subjectName: session.subject.name,
              startTime: session.startTime,
              room: session.room
            });
          }
        }));
      }
      
    } catch (error) {
      console.error('❌ Error in class reminder job:', error);
    }
  });
};

module.exports = scheduleClassReminders;
