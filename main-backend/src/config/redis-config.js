const Redis = require('ioredis');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./server-config');

const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null
});

redis.on('connect', () => {
    console.log('✅ Rate Limiter Redis connected');
});

redis.on('error', (err) => {
    console.error('❌ Rate Limiter Redis error:', err);
});

module.exports = redis;
