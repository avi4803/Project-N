const { redisClient: redis } = require('../config/redis-config');

class CacheService {
    /**
     * Get data from cache
     */
    async get(key) {
        try {
            const data = await redis.get(key);
            if (data) {
                console.log(`🎯 Cache HIT: [${key}]`);
                return JSON.parse(data);
            }
            console.log(`🔌 Cache MISS: [${key}]`);
            return null;
        } catch (error) {
            console.error(`❌ Cache Get Error [${key}]:`, error);
            return null; // Fallback to DB
        }
    }

    /**
     * Set data in cache with TTL
     * @param {string} key 
     * @param {any} data 
     * @param {number} ttl - Time to live in seconds
     */
    async set(key, data, ttl = 900) {
        try {
            await redis.set(key, JSON.stringify(data), 'EX', ttl);
            console.log(`📥 Cache SET: [${key}] (TTL: ${ttl}s)`);
        } catch (error) {
            console.error(`❌ Cache Set Error [${key}]:`, error);
        }
    }

    /**
     * Delete a specific key
     */
    async del(key) {
        try {
            await redis.del(key);
        } catch (error) {
            console.error(`Cache Del Error [${key}]:`, error);
        }
    }

    /**
     * Delete multiple keys by pattern (e.g., user:*)
     * Warning: Use sparingly on large datasets
     */
    async delByPattern(pattern) {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } catch (error) {
            console.error(`Cache DelPattern Error [${pattern}]:`, error);
        }
    }
}

module.exports = new CacheService();
