const express = require('express');
const { ServerConfig } = require('./config');
const apiRoutes = require('./routes');
const connectDB = require('./models/index');

// require('./jobs/ocrJob');

const app = express();

// connectDB();

// enable parsing of JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.listen(ServerConfig.PORT, async() => {
    console.log(`Successfully started the server on PORT : ${ServerConfig.PORT}`);
    await connectDB();
    console.log('📦 MongoDB connected successfully');
    // console.log('🔄 OCR Queue worker is running');
    
});
