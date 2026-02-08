const Queue = require('bull');
const { redisConfig } = require('./redis-config');

const reminderQueue = new Queue('reminder-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: true, // Keep Redis clean
    removeOnFail: false
  }
});

reminderQueue.on('error', (error) => {
    console.error('🔥 Reminder Queue Error:', error);
});

module.exports = reminderQueue;
