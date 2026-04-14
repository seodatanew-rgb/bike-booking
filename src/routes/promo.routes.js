const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/promo.controller');
const { protect, restrictTo }  = require('../middleware/auth.middleware');
const { validate, schemas }    = require('../middleware/validate.middleware');

// Validate promo (staff + admin — called before creating a booking)
router.post('/validate', protect, validate(schemas.validatePromo), ctrl.validatePromo);

// Admin only
router.get ('/',           protect, restrictTo('admin'),                        ctrl.getPromos);
router.post('/',           protect, restrictTo('admin'), validate(schemas.promo), ctrl.createPromo);
router.put ('/:id',        protect, restrictTo('admin'), validate(schemas.promo), ctrl.updatePromo);
router.patch('/:id/toggle',protect, restrictTo('admin'),                        ctrl.togglePromo);
router.delete('/:id',      protect, restrictTo('admin'),                        ctrl.deletePromo);

module.exports = router;
