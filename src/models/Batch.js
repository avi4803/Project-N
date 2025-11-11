const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  program: { 
    type: String, 
    required: true,
    trim: true
  },
  college: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'College',
    required: true
  },
  year: { 
    type: String, 
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

// ✅ Compound unique index to prevent duplicates at DB level
BatchSchema.index({ program: 1, year: 1, college: 1 }, { unique: true });

// Other indexes for performance
BatchSchema.index({ college: 1 });
BatchSchema.index({ year: 1 });

module.exports = mongoose.model('Batch', BatchSchema);