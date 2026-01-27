const express = require('express');
const { ServerConfig } = require('./config');
const apiRoutes = require('./routes');
const connectDB = require('./models/index');

// require('./jobs/ocrJob');

const app = express();
app.set('trust proxy', 1); // Enable proxy trust for ngrok/docker

// connectDB();

// enable parsing of JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

// Global Error Handler (Must be last)
const globalErrorHandler = require('./middlewares/global-error-handler');
app.use(globalErrorHandler);

app.listen(ServerConfig.PORT, async() => {
    console.log(`Successfully started the server on PORT : ${ServerConfig.PORT}`);
    await connectDB();
    console.log('📦 MongoDB connected successfully');
    require('./workers/reminder-worker');
    require('./jobs/daily-summary-job');
    console.log('🔄 Reminder Queue & cron jobs running');
    
});
