const request = require('supertest');
const app     = require('../src/app');
const Booking = require('../src/models/booking.model');
const { createAdmin, createStaff, authHeader, createBike, createPromo, dateRange, futureDate } = require('./helpers');

describe('Booking routes', () => {

  // ── POST /api/bookings ─────────────────────────────────────
  describe('POST /api/bookings', () => {
    it('staff can create a booking', async () => {
      const staff = await createStaff();
      const bike  = await createBike();
      const { start_time, end_time } = dateRange(2, 3);

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time, end_time });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bike_id._id).toBe(bike._id.toString());
      expect(res.body.data.total_amount).toBeGreaterThan(0);
    });

    it('admin can create a booking', async () => {
      const admin = await createAdmin();
      const bike  = await createBike();
      const { start_time, end_time } = dateRange(2, 2);

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(admin))
        .send({ bike_id: bike._id, start_time, end_time });

      expect(res.status).toBe(201);
    });

    it('returns 401 for unauthenticated request', async () => {
      const bike = await createBike();
      const { start_time, end_time } = dateRange(2, 2);
      const res  = await request(app).post('/api/bookings').send({ bike_id: bike._id, start_time, end_time });
      expect(res.status).toBe(401);
    });

    it('calculates total amount correctly for hourly booking', async () => {
      const staff = await createStaff();
      const bike  = await createBike({ price_per_hour: 100 });
      const start = futureDate(2);
      const end   = futureDate(4); // 2 hours

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: start, end_time: end });

      expect(res.status).toBe(201);
      expect(res.body.data.total_amount).toBe(200); // 2hrs × ₹100
      expect(res.body.data.final_amount).toBe(200);
    });

    it('calculates total amount correctly for daily booking (≥24hrs)', async () => {
      const staff = await createStaff();
      const bike  = await createBike({ price_per_day: 500 });
      const start = futureDate(2);
      const end   = futureDate(2 + 25); // 25 hours = 2 days ceiling

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: start, end_time: end });

      expect(res.status).toBe(201);
      expect(res.body.data.total_amount).toBe(1000); // 2 days × ₹500
    });

    it('rejects booking when bike is not available status', async () => {
      const staff = await createStaff();
      const bike  = await createBike({ status: 'maintenance' });
      const { start_time, end_time } = dateRange(2, 2);

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time, end_time });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/maintenance/i);
    });

    it('detects time slot conflict with existing booking', async () => {
      const staff = await createStaff();
      const bike  = await createBike();
      const { start_time, end_time } = dateRange(2, 4);

      // First booking
      await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time, end_time });

      // Overlapping booking (starts during first booking)
      const overlapStart = futureDate(4);
      const overlapEnd   = futureDate(7);
      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: overlapStart, end_time: overlapEnd });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already booked/i);
    });

    it('allows non-overlapping bookings for the same bike', async () => {
      const staff = await createStaff();
      const bike  = await createBike();

      // First booking: hours 2-4
      await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: futureDate(2), end_time: futureDate(4) });

      // Second booking: hours 5-7 (no overlap)
      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: futureDate(5), end_time: futureDate(7) });

      expect(res.status).toBe(201);
    });

    it('applies a valid percent promo code', async () => {
      const staff = await createStaff();
      const bike  = await createBike({ price_per_hour: 200 });
      const promo = await createPromo({ code: 'SAVE10', discount_type: 'percent', discount_value: 10 });
      const start = futureDate(2);
      const end   = futureDate(4); // 2hrs × ₹200 = ₹400

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: start, end_time: end, promo_code: promo.code });

      expect(res.status).toBe(201);
      expect(res.body.data.discount_amount).toBe(40);  // 10% of 400
      expect(res.body.data.final_amount).toBe(360);
    });

    it('applies a valid flat promo code', async () => {
      const staff = await createStaff();
      const bike  = await createBike({ price_per_hour: 100 });
      const promo = await createPromo({ code: 'FLAT50', discount_type: 'flat', discount_value: 50 });
      const start = futureDate(2);
      const end   = futureDate(4); // 2hrs × ₹100 = ₹200

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: start, end_time: end, promo_code: promo.code });

      expect(res.status).toBe(201);
      expect(res.body.data.discount_amount).toBe(50);
      expect(res.body.data.final_amount).toBe(150);
    });

    it('rejects an invalid promo code', async () => {
      const staff = await createStaff();
      const bike  = await createBike();
      const { start_time, end_time } = dateRange(2, 2);

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time, end_time, promo_code: 'FAKECODE' });

      expect(res.status).toBe(400);
    });

    it('rejects expired promo code', async () => {
      const staff = await createStaff();
      const bike  = await createBike();
      const promo = await createPromo({
        code:       'EXPIRED',
        expires_at: new Date(Date.now() - 86400000), // 1 day ago
      });
      const { start_time, end_time } = dateRange(2, 2);

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time, end_time, promo_code: promo.code });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('rejects promo when booking amount is below minimum', async () => {
      const staff = await createStaff();
      const bike  = await createBike({ price_per_hour: 50 }); // 2hrs = ₹100
      const promo = await createPromo({
        code:               'MINAMT',
        min_booking_amount: 500, // requires ₹500
      });
      const { start_time, end_time } = dateRange(2, 2);

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time, end_time, promo_code: promo.code });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/minimum/i);
    });

    it('rejects booking with end_time before start_time', async () => {
      const staff = await createStaff();
      const bike  = await createBike();

      const res = await request(app)
        .post('/api/bookings')
        .set(authHeader(staff))
        .send({ bike_id: bike._id, start_time: futureDate(4), end_time: futureDate(2) });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/bookings ──────────────────────────────────────
  describe('GET /api/bookings', () => {
    it('admin can get all bookings', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();
      const bike  = await createBike();

      await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });

      const res = await request(app).get('/api/bookings').set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('staff cannot access all bookings list', async () => {
      const staff = await createStaff();
      const res   = await request(app).get('/api/bookings').set(authHeader(staff));
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/bookings/my ───────────────────────────────────
  describe('GET /api/bookings/my', () => {
    it('returns only the current user's bookings', async () => {
      const staffA = await createStaff();
      const staffB = await createStaff();
      const bikeA  = await createBike();
      const bikeB  = await createBike({ name: 'Bike B' });

      await request(app).post('/api/bookings').set(authHeader(staffA))
        .send({ bike_id: bikeA._id, ...dateRange(2, 2) });
      await request(app).post('/api/bookings').set(authHeader(staffB))
        .send({ bike_id: bikeB._id, ...dateRange(3, 2) });

      const res = await request(app).get('/api/bookings/my').set(authHeader(staffA));
      expect(res.status).toBe(200);
      res.body.data.forEach(b => expect(b.user_id).toBe(staffA._id.toString()));
      expect(res.body.data.length).toBe(1);
    });
  });

  // ── PATCH /api/bookings/:id/status ────────────────────────
  describe('PATCH /api/bookings/:id/status', () => {
    it('advances booking status: pending → confirmed', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();
      const bike  = await createBike();

      const create = await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });
      const bookingId = create.body.data._id;

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/status`)
        .set(authHeader(admin))
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('staff can cancel their own booking', async () => {
      const staff = await createStaff();
      const bike  = await createBike();

      const create = await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });
      const bookingId = create.body.data._id;

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/status`)
        .set(authHeader(staff))
        .send({ status: 'cancelled' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('staff cannot update another user's booking', async () => {
      const staffA = await createStaff();
      const staffB = await createStaff();
      const bike   = await createBike();

      const create = await request(app).post('/api/bookings').set(authHeader(staffA))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });
      const bookingId = create.body.data._id;

      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/status`)
        .set(authHeader(staffB))
        .send({ status: 'cancelled' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid status value', async () => {
      const staff = await createStaff();
      const bike  = await createBike();

      const create = await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });

      const res = await request(app)
        .patch(`/api/bookings/${create.body.data._id}/status`)
        .set(authHeader(staff))
        .send({ status: 'teleported' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/bookings/stats ────────────────────────────────
  describe('GET /api/bookings/stats', () => {
    it('admin can get booking statistics', async () => {
      const admin = await createAdmin();
      const res   = await request(app).get('/api/bookings/stats').set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('by_status');
      expect(res.body.data).toHaveProperty('revenue');
      expect(res.body.data).toHaveProperty('popular_bikes');
    });

    it('staff cannot access stats', async () => {
      const staff = await createStaff();
      const res   = await request(app).get('/api/bookings/stats').set(authHeader(staff));
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/bookings/:id ───────────────────────────────
  describe('DELETE /api/bookings/:id', () => {
    it('admin can hard-delete a booking', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();
      const bike  = await createBike();

      const create = await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });
      const bookingId = create.body.data._id;

      const res = await request(app).delete(`/api/bookings/${bookingId}`).set(authHeader(admin));
      expect(res.status).toBe(200);

      const deleted = await Booking.findById(bookingId);
      expect(deleted).toBeNull();
    });

    it('staff cannot delete bookings', async () => {
      const staff = await createStaff();
      const bike  = await createBike();

      const create = await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });

      const res = await request(app)
        .delete(`/api/bookings/${create.body.data._id}`)
        .set(authHeader(staff));

      expect(res.status).toBe(403);
    });
  });
});
