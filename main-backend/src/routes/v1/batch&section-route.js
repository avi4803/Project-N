const express = require('express');
const router = express.Router();
const {BatchSectionController} = require('../../controllers/');
const {AuthRequestMiddlewares} = require('../../middlewares/index')


// api/v1/admin/colleges/  --POST
router.post('/section/create',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.validateCreateSectionRequest,
    BatchSectionController.createSection);

router.post('/create',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdminOrLocalAdmin,
    AuthRequestMiddlewares.validateCreateBatchRequest,
    BatchSectionController.createBatch);




module.exports = router;
