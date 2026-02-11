const dotenv = require('dotenv');

dotenv.config();

console.log(`[DEBUG] REDIS_HOST=${process.env.REDIS_HOST}`);

module.exports = {
    PORT: process.env.PORT,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY:'30d',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
    
    // Email Config
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: process.env.SMTP_PORT || 587,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
};

if (!process.env.SMTP_USER) {
    console.warn('⚠️ SMTP_USER is missing in environment variables!');
}