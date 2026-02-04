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
    ref: 'WeeklySessionClass',
    required: true,
    index: true
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
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true,
    default: 'present'
  },
  markedAt: {
    type: Date,
    default: Date.now
  }
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