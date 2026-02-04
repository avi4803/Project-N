const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true,
    sparse: true  // Allows multiple null values, unique when present
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
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  facultyName: {
    type: String,  // Store teacher name from timetable
    trim: true
  },
  type: {
    type: String,
    enum: ['Lecture', 'Lab', 'Tutorial', 'Practical'],
    default: 'Lecture'
  },
  credits: {
    type: Number,
    default: 3
  },
  totalClasses: {
    type: Number,
    default: 0  // Auto-calculated from timetable
  },
  classesPerWeek: {
    type: Number,
    default: 0  // Auto-calculated from timetable
  },
  rooms: [{
    type: String  // List of rooms where this subject is taught
  }],
  schedule: [{
    day: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    room: { type: String },
    type: { type: String }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['manual', 'ocr', 'imported'],
    default: 'manual'
  },
  timetableRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Timetable'
  },
  // Attendance configuration
  attendanceConfig: {
    minimumPercentage: {
      type: Number,
      default: 75 // Minimum required attendance percentage
    },
    warningThreshold: {
      type: Number,
      default: 80 // Warn students below this threshold
    }
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate subjects per batch/section
SubjectSchema.index({ name: 1, batch: 1, section: 1 }, { unique: true });
SubjectSchema.index({ batch: 1, section: 1 });
// SubjectSchema.index({ code: 1 }, { unique: true, sparse: true }); // Disabled: causing duplicate key errors with null values

module.exports = mongoose.model('Subject', SubjectSchema);