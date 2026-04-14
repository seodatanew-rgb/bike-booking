const Joi = require('joi');

// Factory: returns middleware that validates req.body against a Joi schema
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((d) => d.message).join('. ');
    return res.status(400).json({ success: false, message });
  }
  next();
};

// ── Auth schemas ───────────────────────────────────────────────────────────
const registerSchema = Joi.object({
  name:     Joi.string().min(2).max(50).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role:     Joi.string().valid('admin', 'staff').default('staff'),
  phone:    Joi.string().pattern(/^[0-9+\-\s]{7,15}$/).optional(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

// ── Bike schemas ───────────────────────────────────────────────────────────
const bikeSchema = Joi.object({
  name:           Joi.string().required(),
  brand:          Joi.string().required(),
  type:           Joi.string().valid('petrol-scooter', 'e-scooter', 'petrol-bike', 'premium-bike').required(),
  description:    Joi.string().max(500).optional(),
  price_per_hour: Joi.number().min(0).optional().default(0),
  price_per_day:  Joi.number().min(0).required(),
  location:       Joi.string().required(),
  images:         Joi.array().items(Joi.string()).optional(),
});

const bikeStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'booked', 'maintenance', 'retired').required(),
});

// ── Booking schemas ────────────────────────────────────────────────────────
const bookingSchema = Joi.object({
  bike_id:    Joi.string().hex().length(24).required(),
  start_time: Joi.date().iso().greater('now').required(),
  end_time:   Joi.date().iso().greater(Joi.ref('start_time')).required(),
  promo_code: Joi.string().uppercase().optional(),
  notes:      Joi.string().max(300).optional(),
});

const bookingStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'active', 'completed', 'cancelled').required(),
});

// ── Promo schemas ──────────────────────────────────────────────────────────
const promoSchema = Joi.object({
  code:               Joi.string().uppercase().max(20).required(),
  discount_type:      Joi.string().valid('percent', 'flat').required(),
  discount_value:     Joi.number().min(0).required(),
  min_booking_amount: Joi.number().min(0).default(0),
  usage_limit:        Joi.number().min(1).optional().allow(null),
  expires_at:         Joi.date().iso().greater('now').optional().allow(null),
});

const validatePromoSchema = Joi.object({
  code:           Joi.string().required(),
  booking_amount: Joi.number().min(0).required(),
});

// ── Review schemas ─────────────────────────────────────────────────────────
const reviewSchema = Joi.object({
  booking_id: Joi.string().hex().length(24).required(),
  rating:     Joi.number().min(1).max(5).required(),
  comment:    Joi.string().max(500).optional(),
});

module.exports = {
  validate,
  schemas: {
    register:       registerSchema,
    login:          loginSchema,
    bike:           bikeSchema,
    bikeStatus:     bikeStatusSchema,
    booking:        bookingSchema,
    bookingStatus:  bookingStatusSchema,
    promo:          promoSchema,
    validatePromo:  validatePromoSchema,
    review:         reviewSchema,
  },
};
