const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, trim: true },
  collegeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
  
  website: { type: String },
  
  allowedEmailDomains: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  totalStudents: { type: Number, default: 0 },
  totalAdmins: { type: Number, default: 0 },
  
  registeredEmails: [{
    email: { type: String, lowercase: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registeredAt: { type: Date, default: Date.now }
  }],
  
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, { timestamps: true });

// Primary unique index
CollegeSchema.index({ collegeId: 1 }, { unique: true });

// Other indexes for performance
CollegeSchema.index({ 'allowedEmailDomains': 1 });
CollegeSchema.index({ 'registeredEmails.email': 1 });
CollegeSchema.index({ name: 1 }); // Non-unique index for searching

// Method to check if email domain is allowed for this college
CollegeSchema.methods.isEmailDomainAllowed = function(email) {
  const emailDomain = email.split('@')[1];
  return this.allowedEmailDomains.includes(emailDomain.toLowerCase());
};

// Method to get registered emails count
CollegeSchema.methods.getRegisteredEmailsCount = function() {
  return this.registeredEmails.length;
};

module.exports = mongoose.model('College', CollegeSchema);