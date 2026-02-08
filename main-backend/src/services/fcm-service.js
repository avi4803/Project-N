const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
// You must set GOOGLE_APPLICATION_CREDENTIALS in .env pointing to your service account key file
// Or provide the service account object directly via environment variables
const initializeFirebase = () => {
    try {
        if (!admin.apps.length) {
            // Check if we have credentials in env vars
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            } else {
                // Fallback to default google application credentials (checking env var)
                admin.initializeApp();
            }
            console.log('🔥 Firebase Admin Initialized');
        }
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error.message);
    }
};

initializeFirebase();

/**
 * Send a generic push notification to a device
 * @param {string} token - FCM Device Token
 * @param {string} title - Notification Title
 * @param {string} body - Notification Body
 * @param {object} data - Optional data payload
 */
const sendPushNotification = async (token, title, body, data = {}) => {
    if (!token) {
        console.warn('⚠️ No FCM token provided for notification');
        return;
    }

    const message = {
        notification: {
            title,
            body
        },
        data: data, // Data must be string values
        token: token
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('🚀 FCM Notification sent:', response);
        return response;
    } catch (error) {
        console.error('❌ Error sending FCM notification:', error);
        throw error;
    }
};

/**
 * Send a notification to multiple devices (Multicast)
 * @param {Array<string>} tokens - Array of FCM Device Tokens
 * @param {string} title 
 * @param {string} body 
 * @param {object} data 
 */
const sendMulticastNotification = async (tokens, title, body, data = {}) => {
    if (!tokens || tokens.length === 0) {
        console.warn('⚠️ No FCM tokens provided for multicast');
        return;
    }

    const message = {
        notification: {
            title,
            body
        },
        data: data,
        tokens: tokens
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`🚀 FCM Multicast sent: ${response.successCount} successful, ${response.failureCount} failed`);
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.warn('⚠️ Failed tokens:', failedTokens);
        }
        return response;
    } catch (error) {
        console.error('❌ Error sending FCM multicast:', error);
        throw error;
    }
};

module.exports = {
    sendPushNotification,
    sendMulticastNotification
};
