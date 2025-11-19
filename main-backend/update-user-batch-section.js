const mongoose = require('mongoose');
const User = require('./src/models/User');
const { MONGO_URI } = require('./src/config/server-config');

async function updateUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Replace with your email
    const userEmail = 'benil128135@iiitranchi.ac.in'; // UPDATE THIS
    
    const batchId = '6911a6857a956dd8eaa61aff';
    const sectionId = '6911a8da7a956dd8eaa61b11';

    const result = await User.updateOne(
      { email: userEmail },
      { 
        $set: { 
          batch: new mongoose.Types.ObjectId(batchId),
          section: new mongoose.Types.ObjectId(sectionId)
        } 
      }
    );

    console.log('Update result:', result);
    
    const updatedUser = await User.findOne({ email: userEmail });
    console.log('Updated user:', {
      email: updatedUser.email,
      batch: updatedUser.batch,
      section: updatedUser.section
    });

    await mongoose.connection.close();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateUser();
