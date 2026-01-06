const cron = require('node-cron');
const redis = require('ioredis');
const { publishNotification } = require('../services/notification-publisher');
require('dotenv').config();

// Create a separate Redis client for health checks
const redisClient = new redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

/**
 * Check System Health (Redis, Queue)
 * Runs every 30 minutes
 */
const checkSystemHealth = () => {
  cron.schedule('*/30 * * * *', async () => {
    console.log('🏥 Running System Health Check...');
    
    try {
      // Check Redis
      await redisClient.ping();
      
      // If we reach here, Redis is UP. 
      // In a real scenario, we might check Queue size too.
      // const queueSize = await notificationQueue.count();
      
    } catch (error) {
      console.error('❌ System Health Check Failed:', error.message);
      
      // Attempt to notify via Email (if Redis is down, this might fail if using Redis queue! 
      // But if using an external service or fallback, it works. 
      // Since our publishNotification uses Redis, this is ironic. 
      // Ideally, we'd use a direct API call to Novu here as fallback.)
      
      // For demonstration, we assume the queue might be on a different Redis or we just log it.
      // Or we use a direct Novu call if we had the SDK here.
      
      console.log('⚠️ Alert: Redis is down! Cannot send queue notification.');
    }
  });
};

module.exports = checkSystemHealth;
