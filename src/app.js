const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes     = require('./routes/auth.routes');
const bikeRoutes     = require('./routes/bike.routes');
const bookingRoutes  = require('./routes/booking.routes');
const promoRoutes    = require('./routes/promo.routes');
const reviewRoutes   = require('./routes/review.routes');
const userRoutes     = require('./routes/user.routes');
const orderRoutes    = require('./routes/order.routes');
const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());

// ── Rate limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message:  { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging (dev only) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Static uploads ─────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Bike Rental API is running 🚲' });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/bikes',    bikeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/promos',   promoRoutes);
app.use('/api/reviews',  reviewRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/orders',   orderRoutes);

// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
