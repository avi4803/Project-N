const mongoose = require('mongoose');

// Track attendance streaks for gamification
const attendanceStreakSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    index: true
  },
  // Current streak (consecutive classes attended)
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastAttendedSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession'
  },
  lastAttendanceDate: {
    type: Date
  },
  // Overall stats
  totalPresent: {
    type: Number,
    default: 0
  },
  totalAbsent: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 100
  },
  // Badges earned
  badges: [{
    name: String,
    earnedAt: Date,
    description: String,
    icon: String
  }],
  // Milestones
  milestones: [{
    type: {
      type: String,
      enum: ['perfect_week', 'perfect_month', 'streak_5', 'streak_10', 'streak_20', 'streak_50']
    },
    achievedAt: Date
  }]
}, {
  timestamps: true
});

// Compound index
attendanceStreakSchema.index({ student: 1, subject: 1 }, { unique: true });

// Methods
attendanceStreakSchema.methods.incrementStreak = async function(sessionId) {
  this.currentStreak += 1;
  this.totalPresent += 1;
  this.lastAttendedSession = sessionId;
  this.lastAttendanceDate = new Date();
  
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  
  this.percentage = ((this.totalPresent / (this.totalPresent + this.totalAbsent)) * 100).toFixed(2);
  
  // Check for milestone achievements
  this._checkMilestones();
  this._checkBadges();
  
  return this.save();
};

attendanceStreakSchema.methods.breakStreak = function() {
  this.currentStreak = 0;
  this.totalAbsent += 1;
  this.percentage = ((this.totalPresent / (this.totalPresent + this.totalAbsent)) * 100).toFixed(2);
  
  return this.save();
};

attendanceStreakSchema.methods._checkMilestones = function() {
  const milestones = [
    { type: 'streak_5', threshold: 5 },
    { type: 'streak_10', threshold: 10 },
    { type: 'streak_20', threshold: 20 },
    { type: 'streak_50', threshold: 50 }
  ];
  
  milestones.forEach(({ type, threshold }) => {
    if (this.currentStreak === threshold && 
        !this.milestones.some(m => m.type === type)) {
      this.milestones.push({
        type,
        achievedAt: new Date()
      });
    }
  });
};

attendanceStreakSchema.methods._checkBadges = function() {
  // Perfect attendance badge
  if (this.percentage === 100 && this.totalPresent >= 10 &&
      !this.badges.some(b => b.name === 'Perfect Attendance')) {
    this.badges.push({
      name: 'Perfect Attendance',
      earnedAt: new Date(),
      description: '100% attendance with 10+ classes',
      icon: '🏆'
    });
  }
  
  // Streak master badges
  if (this.currentStreak >= 20 && !this.badges.some(b => b.name === 'Streak Master')) {
    this.badges.push({
      name: 'Streak Master',
      earnedAt: new Date(),
      description: '20 consecutive classes attended',
      icon: '🔥'
    });
  }
  
  if (this.currentStreak >= 50 && !this.badges.some(b => b.name === 'Attendance Champion')) {
    this.badges.push({
      name: 'Attendance Champion',
      earnedAt: new Date(),
      description: '50 consecutive classes attended',
      icon: '👑'
    });
  }
};

const AttendanceStreak = mongoose.model('AttendanceStreak', attendanceStreakSchema);

module.exports = AttendanceStreak;
