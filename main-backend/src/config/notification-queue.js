const Queue = require('bull');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./server-config');

// Create notification queue producer
// Create notification queue producer
const notificationQueue = new Queue('notification-queue', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
});

notificationQueue.on('error', (error) => {
    console.error('🔥 Queue Error:', error);
});

notificationQueue.client.on('connect', () => {
    console.log('✅ Connected to Redis at 127.0.0.1:6379');
});

module.exports = notificationQueue;
