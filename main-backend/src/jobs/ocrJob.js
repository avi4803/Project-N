// ✅ CORRECT - Import queue directly
const ocrQueue = require('../config/ocr-queue');
const { processOCRImage } = require('../services/ocr-service');
const { publishNotification } = require('../services/notification-publisher');

// Process OCR jobs from queue with concurrency of 3
ocrQueue.process('process-timetable', 3, async (job) => {
  try {
    console.log(`🔄 Processing OCR job ${job.id}...`);
    console.log(`   Data:`, job.data);
    
    const { ocrJobId, userId, imageUrl, batchId, sectionId } = job.data;
    
    // Call the OCR processing function
    const result = await processOCRImage(ocrJobId, userId, imageUrl, batchId, sectionId, job);
    
    console.log(`✅ OCR job ${job.id} completed`);
    
    // Send Success Notification
    if (job.data.email) {
        publishNotification('OCR_SUCCESS', {
            userId: job.data.userId || job.data.email, // Fallback
            to: job.data.email,
            name: job.data.name || 'Teacher',
            subject: 'OCR Processing Completed',
            message: 'Your attendance sheet has been processed successfully.'
        });
    }

    return result; // Return instead of done(null, result)
    
  } catch (error) {
    console.error(`❌ OCR job ${job.id} failed:`, error.message);
    
    // Send Failure Notification
    if (job.data.email) {
        publishNotification('OCR_FAILED', {
            userId: job.data.userId || job.data.email,
            to: job.data.email,
            name: job.data.name || 'Teacher',
            subject: 'OCR Processing Failed',
            reason: error.message
        });
    }

    throw error; // Throw instead of done(error)
  }
});

module.exports = ocrQueue;