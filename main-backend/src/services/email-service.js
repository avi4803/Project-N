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

/**
 * 🔐 Verification OTP Template - Restored to High-End Bold Style
 */
const sendOtpEmail = async (to, otp) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Classmode" <no-reply@classmode.app>',
            to: to,
            subject: "Verify your Classmode account",
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                    .wrapper { width: 100%; max-width: 500px; margin: 60px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(79, 70, 229, 0.08); }
                    .content { padding: 40px; text-align: center; color: #1e293b; }
                    .logo { font-size: 24px; font-weight: 800; color: #4f46e5; margin-bottom: 30px; }
                    .otp-box { background: #f1f5f9; padding: 24px; border-radius: 16px; font-size: 36px; font-weight: 800; color: #4f46e5; letter-spacing: 12px; margin: 30px 0; border: 1px dashed #cbd5e1; }
                    .hint { color: #64748b; font-size: 14px; margin-top: 20px; padding: 0 20px; }
                    .expiry { font-size: 12px; color: #94a3b8; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="content">
                        <div class="logo">Classmode</div>
                        <h2 style="margin: 0;">Verify your account</h2>
                        <p style="color: #64748b;">Use the code below to complete your setup.</p>
                        
                        <div class="otp-box">${otp}</div>
                        
                        <p class="hint">If you didn't request this code, you can safely ignore this email.</p>
                        <p class="expiry">This code will expire in 10 minutes.</p>
                    </div>
                </div>
            </body>
            </html>
            `
        });
        console.log("Verification OTP sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending verification email: ", error);
        throw error;
    }
};

/**
 * 🚀 Welcome Email Template - High-End Minimalist (No Button)
 */
const sendWelcomeEmail = async (to, name) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Classmode" <no-reply@classmode.app>',
            to: to,
            subject: "Welcome to Classmode",
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                    .wrapper { width: 100%; max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
                    .header { background: #4338ca; padding: 48px 40px; text-align: left; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
                    .content { padding: 48px 40px; color: #334155; line-height: 1.6; }
                    .content h2 { font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px; font-weight: 600; }
                    .content p { margin-bottom: 20px; font-size: 16px; }
                    .footer { padding: 24px 40px; text-align: left; color: #94a3b8; font-size: 13px; border-top: 1px solid #f1f5f9; background: #fdfdfd; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="header">
                        <h1>CLASSMODE</h1>
                    </div>
                    <div class="content">
                        <h2>Hello, ${name || 'Student'}.</h2>
                        <p>Your account has been successfully registered. We are committed to providing you with a seamless academic management experience.</p>
                        <p>With Classmode, you can now manage your class schedules, track real-time attendance, and receive automated reminders for your lectures and labs.</p>
                        <p>To get started, simply open the mobile application and confirm your section details.</p>
                        <p style="margin-top: 32px; font-size: 15px; color: #64748b;">Best regards,<br>The Classmode Support Team</p>
                    </div>
                    <div class="footer">
                        &copy; 2026 Classmode Platform. Dedicated to academic excellence.
                    </div>
                </div>
            </body>
            </html>
            `
        });
        console.log("Welcome Message sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending welcome email: ", error);
        throw error;
    }
};

/**
 * 🔑 Password Reset Template - Restored to High-End Bold Style
 */
const sendPasswordResetOtpEmail = async (to, otp, name) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Classmode" <no-reply@classmode.app>',
            to: to,
            subject: "Reset Your Classmode Password",
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                    .wrapper { width: 100%; max-width: 500px; margin: 60px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.08); }
                    .content { padding: 40px; text-align: center; color: #1e293b; }
                    .logo { font-size: 24px; font-weight: 800; color: #4f46e5; margin-bottom: 30px; }
                    .otp-box { background: #fee2e2; padding: 24px; border-radius: 16px; font-size: 36px; font-weight: 800; color: #ef4444; letter-spacing: 12px; margin: 30px 0; border: 1px dashed #fecaca; }
                    .hint { color: #64748b; font-size: 14px; margin-top: 20px; padding: 0 20px; }
                    .expiry { font-size: 12px; color: #94a3b8; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div class="wrapper">
                    <div class="content">
                        <div class="logo">Classmode</div>
                        <h2 style="margin: 0;">Password Reset</h2>
                        <p style="color: #64748b;">Hello ${name || 'User'}, use the code below to reset your password.</p>
                        
                        <div class="otp-box">${otp}</div>
                        
                        <p class="hint">If you didn't request a password reset, please ignore this email or secure your account.</p>
                        <p class="expiry">This code will expire in 10 minutes.</p>
                    </div>
                </div>
            </body>
            </html>
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
