const mongoose = require('mongoose');

// Auto-created sessions from timetable (no faculty involvement)
const attendanceSessionSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
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
  // Session details
  date: {
    type: Date,
    required: true,
    default: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  classType: {
    type: String,
    enum: ['lecture', 'practical', 'lab', 'tutorial', 'extra'],
    default: 'lecture'
  },
  room: {
    type: String
  },
  topic: {
    type: String,
    trim: true
  },
  // Session status
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled', 'holiday'],
    default: 'scheduled'
  },
  // Auto-managed session (no faculty required)
  autoCreated: {
    type: Boolean,
    default: true
  },
  timetableClassId: {
    type: mongoose.Schema.Types.ObjectId // Reference to specific class in timetable
  },
  // Session timing
  sessionStartedAt: {
    type: Date
  },
  sessionEndedAt: {
    type: Date
  },
  // Attendance marking window
  markingOpenedAt: {
    type: Date
  },
  markingClosedAt: {
    type: Date
  },
  isMarkingOpen: {
    type: Boolean,
    default: false
  },
  // Statistics
  totalStudents: {
    type: Number,
    default: 0
  },
  presentCount: {
    type: Number,
    default: 0
  },
  absentCount: {
    type: Number,
    default: 0
  },
  lateCount: {
    type: Number,
    default: 0
  },
  // Late marking configuration
  allowLateMarking: {
    type: Boolean,
    default: true
  },
  lateMarkingDeadline: {
    type: Date
  },
  // Geolocation for verification (optional)
  location: {
    latitude: Number,
    longitude: Number,
    radius: {
      type: Number,
      default: 100 // meters
    }
  },
  // Notes
  remarks: {
    type: String
  },
  cancellationReason: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate sessions
attendanceSessionSchema.index(
  { subject: 1, date: 1, startTime: 1 },
  { unique: true }
);

// Indexes for queries
attendanceSessionSchema.index({ subject: 1, status: 1, date: -1 });
attendanceSessionSchema.index({ batch: 1, section: 1, date: -1 });
attendanceSessionSchema.index({ date: 1, startTime: 1, status: 1 });
attendanceSessionSchema.index({ isMarkingOpen: 1, status: 1 });
attendanceSessionSchema.index({ batch: 1, section: 1, date: 1, isMarkingOpen: 1 });

// Methods
attendanceSessionSchema.methods.openMarking = async function() {
  this.isMarkingOpen = true;
  this.markingOpenedAt = new Date();
  this.status = 'active';
  
  // Fetch subject to get late marking config
  const Subject = require('./Subject');
  const subject = await Subject.findById(this.subject);
  
  // Set auto-close deadline
  const deadline = new Date(this.markingOpenedAt);
  const [hours, minutes] = this.endTime.split(':').map(Number);
  const lateWindow = subject?.attendanceConfig?.lateMarkingWindowMinutes || 30;
  deadline.setHours(hours, minutes + lateWindow, 0, 0);
  
  this.lateMarkingDeadline = deadline;
  
  return this.save();
};

attendanceSessionSchema.methods.closeMarking = function() {
  this.isMarkingOpen = false;
  this.markingClosedAt = new Date();
  this.status = 'completed';
  return this.save();
};

attendanceSessionSchema.methods.isWithinMarkingWindow = function() {
  if (!this.isMarkingOpen) return false;
  if (!this.lateMarkingDeadline) return true;
  return new Date() <= this.lateMarkingDeadline;
};

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);

module.exports = AttendanceSession;