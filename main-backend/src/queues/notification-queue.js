const Queue = require('bull');
const { redisConfig } = require('../config/redis-config');

const notificationQueue = new Queue('notification-queue', {
  redis: redisConfig
});

module.exports = notificationQueue;
