// const mongoose = require('mongoose');

// const UserSchema = new mongoose.Schema({
//     name: String,
//     email: { type: String, required: true },
//     password: String,
//     roles: {
//         type: [{ type: String, enum: ['admin', 'student', 'local-admin'] }],
//         default: ['student']
//     },
//     college: { type: mongoose.Schema.Types.ObjectId, ref: 'College' },
//     collegeId: { type: String, required: true },
//     batch: String,
//     section: String
// }, { timestamps: true });

// UserSchema.index({ email: 1, collegeId: 1 }, { unique: true });

// module.exports = mongoose.model('User', UserSchema);


const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    
    email: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true
    },
    
    password: { 
      type: String, 
      required: true,
      minlength: 6
    },
    
    roles: {
        type: [{ type: String, enum: ['admin', 'student', 'local-admin'] }],
        default: ['student']
    },
    
    // College reference
    college: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'College',
      required: true
    },
    
    // Academic information
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true  },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true  },
    
    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    
    // Account status
    isActive: { type: Boolean, default: true },
    
    // Additional profile info (optional)
    profilePicture: String,
    phoneNumber: String,
    dateOfBirth: Date,
    
}, { timestamps: true });

// Compound unique index: same email can exist for different colleges
UserSchema.index({ email: 1, collegeId: 1 }, { unique: true });

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);