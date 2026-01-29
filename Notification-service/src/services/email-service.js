const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});


const sendOtpEmail = async (to, otp) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Project-N" <no-reply@project-n.com>',
            to: to,
            subject: "Your OTP for Signup",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Welcome to Project-N!</h2>
                    <p>Your OTP for verification is:</p>
                    <h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
                    <p>This OTP is valid for 10 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                </div>
            `
        });
        console.log("Message sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email: ", error);
        throw error;
    }
};

const sendWelcomeEmail = async (to, name) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Project-N" <no-reply@project-n.com>',
            to: to,
            subject: "Welcome to Project-N!",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Hello ${name || 'Student'},</h2>
                    <p>Welcome to <strong>Project-N</strong>! We are excited to have you on board.</p>
                    <p>Your account has been successfully created. You can now log in and access your timetable, attendance, and more.</p>
                    <br>
                    <p>Best Regards,</p>
                    <p>The Project-N Team</p>
                </div>
            `
        });
        console.log("Welcome Message sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending welcome email: ", error);
        throw error;
    }
};

const sendPasswordResetOtpEmail = async (to, otp, name) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Project-N" <no-reply@project-n.com>',
            to: to,
            subject: "Reset Your Password - Project-N",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Password Reset Request</h2>
                    <p>Hello ${name || 'User'},</p>
                    <p>You requested to reset your password. Use the OTP below to proceed:</p>
                    <h1 style="color: #ff5722; letter-spacing: 5px;">${otp}</h1>
                    <p>This OTP is valid for 10 minutes.</p>
                    <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                    <br>
                    <p>Best Regards,</p>
                    <p>The Project-N Team</p>
                </div>
            `
        });
        console.log("Password Reset OTP sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending password reset email: ", error);
        throw error;
    }
};

module.exports = {
    sendOtpEmail,
    sendWelcomeEmail,
    sendPasswordResetOtpEmail
};

