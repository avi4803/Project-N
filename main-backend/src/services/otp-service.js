const PendingUser = require('../models/PendingUser');
const User = require('../models/User');
const { publishNotification } = require('../services/notification-publisher');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');

// Utility to generate 6 digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

async function initSignup(data) {
    const { name, email, password } = data;

    // 1. Check if user already exists in main User collection
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('User already exists', StatusCodes.BAD_REQUEST);
    }

    // 2. Generate OTP and expiry (10 mins)
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // 3. Update or create PendingUser
    // We use findOneAndUpdate to handle upsert properly
    // NOTE: We store plain password here so that the User model's pre-save hook can hash it correctly later.
    // If we hashed it here, the User model would hash it again (double hash), causing login failures.
    await PendingUser.findOneAndUpdate(
        { email },
        {
            name,
            email,
            password: password, // Store plain password
            otp,
            otpExpires,
            isVerified: false
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Send Notification
    await publishNotification('SEND_OTP', {
        to: email,
        otp: otp,
        name: name
    });

    return { message: 'OTP sent successfully to ' + email };
}

async function verifyOtp(email, otp) {
    const pendingUser = await PendingUser.findOne({ email });

    if (!pendingUser) {
        throw new AppError('Signup session not found. Please sign up again.', StatusCodes.BAD_REQUEST);
    }

    if (pendingUser.otp !== otp) {
        throw new AppError('Invalid OTP', StatusCodes.BAD_REQUEST);
    }

    if (pendingUser.otpExpires < Date.now()) {
        throw new AppError('OTP expired. Please signup again.', StatusCodes.BAD_REQUEST);
    }

    // Mark as verified
    pendingUser.isVerified = true;
    await pendingUser.save();

    // Generate a temporary signup token
    const signupToken = jwt.sign(
        { email: pendingUser.email, id: pendingUser._id, role: 'pending_student' },
        process.env.JWT_SECRET || 'fallback-secret', // Should use env var
        { expiresIn: '1h' }
    );

    return { 
        message: 'OTP verified successfully',
        signupToken 
    };
}

async function getCompletedSignupData(email) {
    const pendingUser = await PendingUser.findOne({ email, isVerified: true });
    if (!pendingUser) {
        throw new AppError('User not verified or session expired', StatusCodes.BAD_REQUEST);
    }
    return pendingUser;
}

async function clearPendingUser(email) {
    await PendingUser.deleteOne({ email });
}

module.exports = {
    initSignup,
    verifyOtp,
    getCompletedSignupData,
    clearPendingUser
};
