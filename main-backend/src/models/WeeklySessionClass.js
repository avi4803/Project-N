const mongoose = require('mongoose');

const weeklySessionClassSchema = new mongoose.Schema({
  weeklySession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklySession',
    required: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId, // Ref to original timetable class ID
    default: null
  },
  // Core Info
  title: String, // E.g. "Maths Lecture"
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College' },

  // Timing
  date: {
    type: Date,
    required: true
  },
  day: String, // Mon, Tue...
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  
  // Location & Type
  room: { type: String, default: '' },
  type: {
    type: String,
    enum: ['Lecture', 'Lab', 'Practical', 'Tutorial', 'Extra'],
    default: 'Extra'
  },

  // Status Management
  status: {
    type: String,
    enum: ['scheduled', 'cancelled', 'rescheduled', 'completed'],
    default: 'scheduled'
  },
  isExtraClass: {
    type: Boolean,
    default: false
  },
  cancellationReason: String,
  
  // Attendance Tracking (Merged from AttendanceSession)
  isMarkingOpen: { type: Boolean, default: false },
  markingOpenedAt: Date,
  markingClosedAt: Date,
  lateMarkingDeadline: Date,
  allowLateMarking: { type: Boolean, default: true },
  
  // Stats
  presentCount: { type: Number, default: 0 },
  absentCount: { type: Number, default: 0 },

  // Soft Delete
  deletedAt: { type: Date, default: null },

}, { timestamps: true });

// Composite unique index to prevent duplicate class generation for blueprint classes
weeklySessionClassSchema.index(
  { weeklySession: 1, templateId: 1, date: 1, startTime: 1 }, 
  { unique: true, partialFilterExpression: { templateId: { $type: 'objectId' } } }
);

// General index for querying
weeklySessionClassSchema.index({ weeklySession: 1, date: 1 });
weeklySessionClassSchema.index({ batch: 1, section: 1, date: 1 });

// Strict Overlap Protection (Idempotency)
weeklySessionClassSchema.index(
  { batch: 1, section: 1, date: 1, startTime: 1 }, 
  { unique: true, name: 'unique_class_slot' }
);

// --- State Machine Safeguards ---

// Store original status on load to validate transitions
weeklySessionClassSchema.post('init', function() {
  this._originalStatus = this.status;
});

weeklySessionClassSchema.pre('save', function(next) {
  if (this.isModified('status') && this._originalStatus) {
    const from = this._originalStatus;
    const to = this.status;
    
    if (from === to) return next();

    const invalidTransitions = {
      // From : [Blocked To]
      'cancelled': ['completed'], 
      'rescheduled': ['scheduled', 'cancelled', 'completed'], // Rescheduled is usually terminal for that specific slot
      'completed': ['scheduled', 'cancelled', 'rescheduled']
    };

    if (invalidTransitions[from] && invalidTransitions[from].includes(to)) {
      const err = new Error(`Invalid status transition from '${from}' to '${to}'`);
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('WeeklySessionClass', weeklySessionClassSchema);
