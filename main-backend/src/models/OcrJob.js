const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  day: { 
    type: String, 
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true },
  teacher: { type: String, default: '' },
  room: { type: String, default: '' },
  type: { 
    type: String, 
    enum: ['Lecture', 'Lab', 'Tutorial', 'Practical'],
    default: 'Lecture'
  }
}, { _id: false }); // No _id for subdocuments

const ParsedTimetableSchema = new mongoose.Schema({
  schedule: [ClassSchema],
  validFrom: Date,
  validTo: Date
}, { _id: false });

const OcrJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued'
  },
  extractedText: {
    type: String,
    default: ''
  },
  parsedTimetable: {
    type: ParsedTimetableSchema,
    default: null
  },
  error: {
    type: String,
    default: ''
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  startedAt: Date,
  completedAt: Date
}, { 
  timestamps: true 
});

// Indexes
OcrJobSchema.index({ userId: 1 });
OcrJobSchema.index({ status: 1 });
OcrJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('OcrJob', OcrJobSchema);