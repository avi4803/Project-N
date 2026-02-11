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
  isMarkingOpen: {
    type: Boolean,
    default: false
  },
  isMarkingDone: {
    type: Boolean,
    default: false
  },
  cancellationReason: String,
  
  // Numeric Date Components (Timezone Agnostic)
  dayNum: Number,   // 1-31
  monthNum: Number, // 1-12
  yearNum: Number,  // 2026...
  dateString: String, // "YYYY-MM-DD" - THE Gold Standard for this app

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

module.exports = mongoose.model('WeeklySessionClass', weeklySessionClassSchema);
