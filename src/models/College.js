const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
  name: String,
  location: String,
  collegeId: { type: String, unique: true },

},{timestamps:true});


module.exports = mongoose.model('College', CollegeSchema);