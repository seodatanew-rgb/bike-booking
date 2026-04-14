const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');

// POST /api/orders — place order, create bookings, send email
router.post('/', protect, ctrl.placeOrder);

module.exports = router;
