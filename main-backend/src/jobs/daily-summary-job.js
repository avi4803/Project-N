const cron = require('node-cron');
const Section = require('../models/Section');
const User = require('../models/User');
const WeeklySessionService = require('../services/weekly-session-service');
const { publishNotification } = require('../services/notification-publisher');

/**
 * Daily Briefing Job
 * Runs every evening at 9:05 PM to notify students about next day's schedule.
 */
// 21:05 = 9:05 PM
cron.schedule('5 21 * * *', async () => {
    console.log('🌙 Running Daily Briefing Job...');

    try {
        // 1. Calculate Tomorrow's Date
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(0,0,0,0);
        
        const dayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Skip Sunday briefings (for Monday) if you want? Or keep it.
        // Assuming college runs Mon-Sat usually.
        
        // 2. Iterate through all active sections
        // We do this batch-wise to avoid fetching all users at once
        const sections = await Section.find({}).populate('batch');
        
        console.log(`🔍 Checking schedule for ${sections.length} sections for ${dayName}, ${tomorrow.toDateString()}`);

        for (const section of sections) {
            if(!section.batch) continue;

            const batchId = section.batch._id;
            const sectionId = section._id;

            // 3. Get Tomorrow's Classes
            const result = await WeeklySessionService.getSessionForWeek(batchId, sectionId, tomorrow);
            
            if (!result || !result.classes) continue;

            // Filter for classes exactly on 'tomorrow' date
            const tomorrowsClasses = result.classes.filter(cls => {
                const cDate = new Date(cls.date);
                return cDate.getTime() === tomorrow.getTime() && cls.status !== 'cancelled';
            });

            if (tomorrowsClasses.length === 0) continue;

            // 4. Construct the summary
            const count = tomorrowsClasses.length;
            const firstClass = tomorrowsClasses[0];
            const startTimeWrapper = convertTo12Hour(firstClass.startTime);
            
            // Format: "📅 4 Classes Tomorrow (Starting 09:00 AM)"
            const title = `📅 Tomorrow: ${count} Class${count > 1 ? 'es' : ''} (Starts ${startTimeWrapper})`;
            
            // Body: List subjects
            // "1. Data Structures\n2. CN..."
            const subjectList = tomorrowsClasses
                .map((c, i) => `${i+1}. ${c.title || c.subject.name} (${c.startTime})`)
                .join('\n');
            
            const body = subjectList;

            // 5. Find Users in this section who have ENABLED daily summary
            const users = await User.find({
                batch: batchId,
                section: sectionId,
                isActive: true, // Active only
                dailySummaryEnabled: true // 👈 The preference check
            }).select('fcmToken');

            const fcmTokens = users.filter(u => !!u.fcmToken).map(u => u.fcmToken);

            if (fcmTokens.length > 0) {
                 await publishNotification('DAILY_BRIEFING', {
                    type: 'DAILY_BRIEFING',
                    category: 'Schedule',
                    title: title,
                    body: body,
                    // Targeted delivery
                    fcmTokens: fcmTokens,
                    data: {
                        date: tomorrow.toISOString(),
                        screen: 'Schedule' // Deep link
                    }
                });
                console.log(`✅ Sent briefing to ${fcmTokens.length} students in ${section.name}`);
            }
        }
    } catch (error) {
        console.error('❌ Daily Briefing Job Failed:', error);
    }
});

function convertTo12Hour(time) {
  // Check correct time format and split into components
  time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

  if (time.length > 1) { // If time format correct
    time = time.slice(1); // Remove full string match value
    time[5] = +time[0] < 12 ? ' AM' : ' PM'; // Set AM/PM
    time[0] = +time[0] % 12 || 12; // Adjust hours
  }
  return time.join(''); // return adjusted time or original string
}

console.log('⏰ Daily Briefing Cron Scheduled (21:05 Daily)');
