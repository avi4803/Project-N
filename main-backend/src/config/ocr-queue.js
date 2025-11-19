// const Queue = require('bull');
// const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./server-config');

// // Create OCR processing queue with Redis
// const ocrQueue = new Queue('ocr-processing', {
//   redis: {
//     host: REDIS_HOST,
//     port: REDIS_PORT,
//     password: REDIS_PASSWORD || undefined,
//     maxRetriesPerRequest: null,
//     enableReadyCheck: false
//   },
//   settings: {
//     maxStalledCount: 3,
//     stalledInterval: 30000, // 30 seconds
//     lockDuration: 300000, // 5 minutes
//     lockRenewTime: 30000 // Renew lock every 30 seconds
//   },
//   defaultJobOptions: {
//     removeOnComplete: 100, // Keep last 100 completed jobs
//     removeOnFail: 50, // Keep last 50 failed jobs
//     attempts: 3, // Retry failed jobs 3 times
//     backoff: {
//       type: 'exponential',
//       delay: 5000 // Start with 5 second delay
//     }
//   }
// });

// // Queue event handlers
// ocrQueue.on('completed', (job, result) => {
//   console.log(`✅ OCR Job ${job.id} completed successfully`);
//   console.log(`   Job ID: ${result.jobId}`);
//   console.log(`   Total Classes: ${result.totalClasses}`);
//   console.log(`   Model Used: ${result.modelUsed}`);
// });

// ocrQueue.on('failed', (job, err) => {
//   console.error(`❌ OCR Job ${job.id} failed:`, err.message);
//   console.error(`   Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
// });

// ocrQueue.on('stalled', (job) => {
//   console.warn(`⚠️ OCR Job ${job.id} stalled - will be retried`);
// });

// ocrQueue.on('progress', (job, progress) => {
//   console.log(`📊 OCR Job ${job.id} progress: ${progress}%`);
// });

// ocrQueue.on('error', (error) => {
//   console.error('❌ Queue error:', error);
// });

// ocrQueue.on('waiting', (jobId) => {
//   console.log(`⏳ Job ${jobId} is waiting to be processed`);
// });

// ocrQueue.on('active', (job) => {
//   console.log(`🔄 Job ${job.id} is now active`);
// });

// // Clean up old jobs periodically
// ocrQueue.clean(24 * 3600 * 1000, 'completed'); // Remove completed jobs older than 24 hours
// ocrQueue.clean(48 * 3600 * 1000, 'failed'); // Remove failed jobs older than 48 hours

// module.exports = ocrQueue;