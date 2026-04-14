const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const User    = require('../src/models/user.model');
const Bike    = require('../src/models/bike.model');
const PromoCode = require('../src/models/promo.model');

// ── User factories ────────────────────────────────────────────
const createUser = async (overrides = {}) => {
  const defaults = {
    name:     'Test User',
    email:    `user_${Date.now()}@test.com`,
    password: 'password123',
    role:     'staff',
    phone:    '+91-9000000001',
    is_active: true,
  };
  const data = { ...defaults, ...overrides };
  data.password = await bcrypt.hash(data.password, 10);
  return User.create(data);
};

const createAdmin = (overrides = {}) =>
  createUser({ name: 'Admin', email: `admin_${Date.now()}@test.com`, role: 'admin', ...overrides });

const createStaff = (overrides = {}) =>
  createUser({ name: 'Staff', email: `staff_${Date.now()}@test.com`, role: 'staff', ...overrides });

// Generate a signed token for a user
const tokenFor = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

// ── Bike factory ──────────────────────────────────────────────
const createBike = (overrides = {}) =>
  Bike.create({
    name:           'Test Bike',
    brand:          'TestBrand',
    type:           'mountain',
    description:    'A test bike',
    price_per_hour: 80,
    price_per_day:  500,
    location:       'Kolkata',
    status:         'available',
    is_active:      true,
    ...overrides,
  });

// ── Promo factory ─────────────────────────────────────────────
const createPromo = (overrides = {}) =>
  PromoCode.create({
    code:               `PROMO${Date.now()}`,
    discount_type:      'percent',
    discount_value:     10,
    min_booking_amount: 0,
    usage_limit:        100,
    used_count:         0,
    is_active:          true,
    ...overrides,
  });

// ── Date helpers ──────────────────────────────────────────────
const futureDate = (hoursFromNow = 1) => {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
};

const dateRange = (startHoursFromNow = 1, durationHours = 2) => ({
  start_time: futureDate(startHoursFromNow),
  end_time:   futureDate(startHoursFromNow + durationHours),
});

module.exports = {
  createUser, createAdmin, createStaff,
  tokenFor, authHeader,
  createBike, createPromo,
  futureDate, dateRange,
};
