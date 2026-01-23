const express = require('express');
const BroadcastController = require('../../controllers/broadcast-controller');
const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router();

/**
 * @desc    Send a broadcast to users
 * @route   POST /api/v1/broadcast/send
 * @access  Admin, Local Admin
 */
router.post(
  '/send',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  BroadcastController.sendBroadcast
);

module.exports = router;
