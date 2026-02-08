const Redis = require('ioredis');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./server-config');

const redisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null
};

const redis = new Redis(redisOptions);

redis.on('connect', () => {
    console.log(`✅ Cache Redis connected to ${REDIS_HOST}:${REDIS_PORT}`);
});

redis.on('error', (err) => {
    console.error('❌ Rate Limiter Redis error:', err);
});

module.exports = {
    redisClient: redis,
    redisConfig: redisOptions
};
