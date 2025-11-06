const mongoose = require('mongoose');
const ENUM = require('../utils/enums')


const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    roles: {
        type: [{ type: String, enum: ['admin', 'student', 'local-admin'] }],
        default: ['student']
    },
    collegeId: String,
    batch: String,
    section: String,
    },{timestamps:true});

module.exports = mongoose.model('User', UserSchema);