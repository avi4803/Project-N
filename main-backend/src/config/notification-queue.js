const Queue = require('bull');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./server-config');

// Create notification queue producer
// Create notification queue producer
const host = process.env.REDIS_HOST || '127.0.0.1';
const port = process.env.REDIS_PORT || 6379;

const notificationQueue = new Queue('notification-queue', {
  redis: {
    host: host,
    port: port,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
});

notificationQueue.on('error', (error) => {
    console.error('🔥 Queue Error:', error);
});

notificationQueue.client.on('connect', () => {
    console.log(`✅ Connected to Redis at: ${host}:${port}`);
});

module.exports = notificationQueue;
