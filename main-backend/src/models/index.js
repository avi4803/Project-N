const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  while (retries > 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('📦 MongoDB connected successfully');
      return;
    } catch (err) {
      console.error(`❌ MongoDB connection failed. Retries left: ${retries - 1}`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('❌ Could not connect to MongoDB. Exiting...');
        process.exit(1);
      }
      // Wait 5 seconds before retrying
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};
module.exports = connectDB;
