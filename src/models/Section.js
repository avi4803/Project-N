const mongoose = require('mongoose');


const SectionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    uppercase: true  // Store as uppercase (A, B, C)
  },
  batch: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Batch',
    required: true
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

// ✅ Compound unique index: same section name can't exist twice in same batch
SectionSchema.index({ name: 1, batch: 1 }, { unique: true });

// Other indexes
SectionSchema.index({ batch: 1 });

module.exports = mongoose.model('Section', SectionSchema);