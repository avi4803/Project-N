const Queue = require('bull');
const redisConfig = require('./src/config/redis');

const notificationQueue = new Queue('notification-queue', {
  redis: redisConfig
});

async function checkQueue() {
  console.log('🔍 Checking Notification Queue Status...');
  
  const counts = await notificationQueue.getJobCounts();
  
  console.log('--------------------------------');
  console.log(`⏳ Waiting:   ${counts.waiting}`);
  console.log(`🏃 Active:    ${counts.active}`);
  console.log(`✅ Completed: ${counts.completed}`);
  console.log(`❌ Failed:    ${counts.failed}`);
  console.log(`⏱️ Delayed:   ${counts.delayed}`);
  console.log('--------------------------------');

  if (counts.failed > 0) {
    console.log('\n⚠️  Latest Failed Jobs:');
    const failedJobs = await notificationQueue.getFailed(0, 5);
    failedJobs.forEach(job => {
        console.log(`- ID: ${job.id} | Type: ${job.data.type} | Error: ${job.failedReason}`);
    });
  }

  process.exit(0);
}

checkQueue();
