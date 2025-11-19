// ✅ CORRECT - Import queue directly
const ocrQueue = require('../config/ocr-queue');
const { processOCRImage } = require('../services/ocr-service');

// Process OCR jobs from queue with concurrency of 3
ocrQueue.process('process-timetable', 3, async (job) => {
  try {
    console.log(`🔄 Processing OCR job ${job.id}...`);
    console.log(`   Data:`, job.data);
    
    const { ocrJobId, userId, imageUrl, batchId, sectionId } = job.data;
    
    // Call the OCR processing function
    const result = await processOCRImage(ocrJobId, userId, imageUrl, batchId, sectionId, job);
    
    console.log(`✅ OCR job ${job.id} completed`);
    
    return result; // Return instead of done(null, result)
    
  } catch (error) {
    console.error(`❌ OCR job ${job.id} failed:`, error.message);
    throw error; // Throw instead of done(error)
  }
});

console.log('🚀 OCR Queue Processor started - Processing up to 3 jobs concurrently');

module.exports = ocrQueue;