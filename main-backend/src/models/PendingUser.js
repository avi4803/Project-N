const mongoose = require('mongoose');

const PendingUserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true, 
        trim: true 
    },
    password: { 
        type: String, 
        required: true 
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

// Auto-delete pending users after 1 hour if not completed
PendingUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('PendingUser', PendingUserSchema);
