const Queue = require('bull');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./server-config');

const reminderQueue = new Queue('reminder-queue', {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: true, // Keep Redis clean
    removeOnFail: false
  }
});

reminderQueue.on('error', (error) => {
    console.error('🔥 Reminder Queue Error:', error);
});

module.exports = reminderQueue;
