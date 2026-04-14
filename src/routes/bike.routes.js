const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bike.controller');
const { protect, restrictTo }   = require('../middleware/auth.middleware');
const { validate, schemas }     = require('../middleware/validate.middleware');
const { handleUpload }          = require('../middleware/upload.middleware');

// Public
router.get('/availability', ctrl.checkAvailability);
router.get('/',             ctrl.getBikes);
router.get('/:id',          ctrl.getBike);

// Admin only
router.post('/',    protect, restrictTo('admin'), validate(schemas.bike),       ctrl.createBike);
router.put('/:id',  protect, restrictTo('admin'), validate(schemas.bike),       ctrl.updateBike);
router.delete('/:id', protect, restrictTo('admin'),                             ctrl.deleteBike);

// Image upload / delete — admin only
router.post  ('/:id/images', protect, restrictTo('admin'), handleUpload, ctrl.uploadImages);
router.delete('/:id/images', protect, restrictTo('admin'),               ctrl.deleteImage);

// Admin + staff
router.patch('/:id/status', protect, restrictTo('admin', 'staff'), validate(schemas.bikeStatus), ctrl.updateBikeStatus);

module.exports = router;
