require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connect } = require('./config/database-config');
const notificationQueue = require('./queues/notification-consumer');
const notificationRoutes = require('./routes/notification-routes');

const app = express();
app.set('trust proxy', 1); // Enable proxy trust for ngrok/docker
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'Notification Service' });
});

// Start Server & Connect DB
const startServer = async () => {
    await connect();
    app.listen(PORT, () => {
        console.log(`🚀 Notification Service API running on port ${PORT}`);
        console.log('Listening for jobs in "notification-queue"...');
    }); // Forced restart
};

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing queues');
    await notificationQueue.close();
    process.exit(0);
});
