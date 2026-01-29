const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    otpExpires: {
        type: Date,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Auto-delete after 15 minutes (TTL index)
passwordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

module.exports = PasswordReset;
