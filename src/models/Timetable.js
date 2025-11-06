const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
  day: String,
  startTime: String,
  endTime: String,
  subject: String,
  room: String,
});

const TimetableSchema = new mongoose.Schema({
  collegeId: String,
  batch: String,
  section: String,
  schedule: [ScheduleSchema],
  
},{timestamps:true});

module.exports = mongoose.model('Timetable', TimetableSchema);
