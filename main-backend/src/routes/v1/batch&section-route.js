const express = require('express');
const router = express.Router();
const {BatchSectionController} = require('../../controllers/');
const {AuthRequestMiddlewares} = require('../../middlewares/index')


// api/v1/admin/colleges/  --POST
router.post('/section/create',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin || AuthRequestMiddlewares.isLocalAdmin,
    AuthRequestMiddlewares.validateCreateSectionRequest,
    BatchSectionController.createSection);

router.post('/create',
    AuthRequestMiddlewares.checkAuth,
    AuthRequestMiddlewares.isAdmin || AuthRequestMiddlewares.isLocalAdmin,
    AuthRequestMiddlewares.validateCreateBatchRequest,
    BatchSectionController.createBatch);


module.exports = router;
