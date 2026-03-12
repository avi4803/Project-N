const express = require('express');
const { declareHoliday, getHolidays, removeHoliday } = require('../../controllers/holiday-controller');
const { AuthRequestMiddlewares } = require('../../middlewares');

const router = express.Router({ mergeParams: true });

// Declare Holiday (Admin only)
router.post('/', 
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  declareHoliday
);

// Get Holidays
router.get('/', 
  AuthRequestMiddlewares.checkAuth, 
  getHolidays
);

// Remove Holiday (Admin only)
router.delete('/:date',
  AuthRequestMiddlewares.checkAuth,
  AuthRequestMiddlewares.isAdminOrLocalAdmin,
  removeHoliday
);

module.exports = router;
