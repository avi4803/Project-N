const express = require('express');
const router = express.Router();
const { getUserNotifications, markAsRead } = require('../controllers/notification-controller');

// Get last N notifications for a user
router.get('/user/:userId', getUserNotifications);

// Mark a notification as read
router.patch('/:id/read', markAsRead);

module.exports = router;
