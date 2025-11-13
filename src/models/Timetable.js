const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  day: { 
    type: String, 
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: { type: String, required: true },   // "09:00"
  endTime: { type: String, required: true },     // "10:00"
  subject: { type: String, required: true },     // "Mathematics"
  teacher: String,                               // "Dr. Sharma"
  room: String,                                  // "301"
  type: { 
    type: String, 
    enum: ['Lecture', 'Lab', 'Tutorial', 'Practical'],
    default: 'Lecture'
  }
}, { _id: true }); // Allow _id for each class

const TimetableSchema = new mongoose.Schema({
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
  schedule: [ClassSchema],
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTo: Date,
  isActive: { type: Boolean, default: true },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound unique index to prevent duplicate timetables
TimetableSchema.index({ batch: 1, section: 1 }, { unique: true });

// Indexes for performance
TimetableSchema.index({ batch: 1 });
TimetableSchema.index({ section: 1 });
TimetableSchema.index({ 'schedule.day': 1 });

module.exports = mongoose.model('Timetable', TimetableSchema);