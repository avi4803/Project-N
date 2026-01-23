const mongoose = require('mongoose');

const weeklySessionSchema = new mongoose.Schema({
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
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  // Week identifier
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Meta
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure one session per batch/section per week
weeklySessionSchema.index({ batch: 1, section: 1, year: 1, weekNumber: 1 }, { unique: true });

module.exports = mongoose.model('WeeklySession', weeklySessionSchema);
