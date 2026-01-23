const express = require('express');
const router = express.Router();
const { NotificationController } = require('../../controllers');
const { AuthRequestMiddlewares } = require('../../middlewares');

// GET /api/v1/notifications/me
router.get('/me', 
    AuthRequestMiddlewares.checkAuth, 
    NotificationController.getMyNotifications
);

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read',
    AuthRequestMiddlewares.checkAuth,
    NotificationController.markAsRead
);

module.exports = router;
