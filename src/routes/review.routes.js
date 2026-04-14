const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/review.controller');
const { protect, restrictTo }  = require('../middleware/auth.middleware');
const { validate, schemas }    = require('../middleware/validate.middleware');

// Public
router.get('/bike/:bike_id', ctrl.getBikeReviews);

// Authenticated
router.use(protect);

router.post('/',    validate(schemas.review), ctrl.createReview);
router.get('/my',   ctrl.getMyReviews);
router.put('/:id',  ctrl.updateReview);

// Admin only
router.delete('/:id', restrictTo('admin'), ctrl.deleteReview);

module.exports = router;
