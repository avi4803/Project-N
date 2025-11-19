const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true,
    index: true
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
  // Attendance details
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true,
    default: 'absent'
  },
  // Streak tracking
  isStreakDay: {
    type: Boolean,
    default: false
  },
  // Marking details
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Can be student (self-marking) or faculty
  },
  markedByRole: {
    type: String,
    enum: ['student', 'admin', 'system'],
    default: 'student'
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  // Verification (if required)
  verification: {
    method: {
      type: String,
      enum: ['manual', 'geolocation', 'qr_code', 'biometric', 'face_recognition'],
      default: 'manual'
    },
    geolocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    },
    ipAddress: String,
    deviceInfo: String
  },
  // Additional info
  remarks: {
    type: String
  },
  proofDocument: {
    url: String,
    type: String // For excused absences
  },
  // Modification tracking
  isModified: {
    type: Boolean,
    default: false
  },
  modificationHistory: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    previousStatus: String,
    newStatus: String,
    reason: String,
    modifiedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Compound unique index - one attendance record per student per session
attendanceSchema.index(
  { student: 1, session: 1 },
  { unique: true }
);

// Indexes for common queries
attendanceSchema.index({ student: 1, subject: 1, date: -1 });
attendanceSchema.index({ subject: 1, date: -1, status: 1 });
attendanceSchema.index({ batch: 1, section: 1, date: -1 });

// Virtual for on-time marking
attendanceSchema.virtual('isOnTime').get(function() {
  return !this.isLateMarking;
});

// Static methods
attendanceSchema.statics.calculateAttendancePercentage = async function(studentId, subjectId) {
  const total = await this.countDocuments({
    student: studentId,
    subject: subjectId
  });

  const present = await this.countDocuments({
    student: studentId,
    subject: subjectId,
    status: 'present'
  });

  return total > 0 ? (present / total) * 100 : 100;
};

attendanceSchema.statics.getAttendanceStats = async function(studentId, subjectId) {
  const stats = await this.aggregate([
    {
      $match: {
        student: new mongoose.Types.ObjectId(studentId),
        subject: new mongoose.Types.ObjectId(subjectId)
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  result.percentage = result.total > 0 
    ? ((result.present / result.total) * 100).toFixed(2) 
    : 100;

  return result;
};

attendanceSchema.statics.getSubjectWiseAttendance = async function(studentId) {
  return await this.aggregate([
    {
      $match: {
        student: new mongoose.Types.ObjectId(studentId)
      }
    },
    {
      $group: {
        _id: '$subject',
        total: { $sum: 1 },
        present: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subjectInfo'
      }
    },
    {
      $unwind: '$subjectInfo'
    },
    {
      $project: {
        subjectId: '$_id',
        subjectName: '$subjectInfo.name',
        subjectCode: '$subjectInfo.code',
        total: 1,
        present: 1,
        absent: 1,
        percentage: {
          $multiply: [
            { $divide: ['$present', '$total'] },
            100
          ]
        }
      }
    },
    {
      $sort: { percentage: 1 }
    }
  ]);
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;