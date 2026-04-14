const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/booking.controller');
const { protect, restrictTo }  = require('../middleware/auth.middleware');
const { validate, schemas }    = require('../middleware/validate.middleware');

// All booking routes require authentication
router.use(protect);

// Stats — must come before /:id to avoid route collision
router.get('/stats', restrictTo('admin'), ctrl.getStats);

// Staff: own bookings
router.get('/my',  ctrl.getMyBookings);

// Create booking (staff + admin)
router.post('/', validate(schemas.booking), ctrl.createBooking);

// Admin: all bookings
router.get('/', restrictTo('admin'), ctrl.getAllBookings);

// Single booking — access controlled inside controller
router.get('/:id',    ctrl.getBooking);
router.put('/:id',    restrictTo('admin'), ctrl.updateBooking);
router.delete('/:id', restrictTo('admin'), ctrl.deleteBooking);

router.patch('/:id/status', validate(schemas.bookingStatus), ctrl.updateBookingStatus);

module.exports = router;
