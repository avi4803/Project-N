const mongoose = require('mongoose');

const connect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Notification Service DB Connected');
    } catch (error) {
        console.error('❌ Notification Service DB Connection Error:', error);
        process.exit(1);
    }
};

module.exports = { connect };
