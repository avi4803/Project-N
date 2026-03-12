const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  dateString: {
    type: String, // "YYYY-MM-DD" in IST
    required: true,
  },
  reason: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Ensure one holiday per college per date
HolidaySchema.index({ college: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', HolidaySchema);
