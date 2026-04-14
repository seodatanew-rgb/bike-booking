const request = require('supertest');
const app     = require('../src/app');
const Bike    = require('../src/models/bike.model');
const Booking = require('../src/models/booking.model');
const { createAdmin, createStaff, authHeader, createBike, dateRange } = require('./helpers');

// Helper: create a completed booking so a review can be submitted
const createCompletedBooking = async (staff, bike) => {
  const booking = await Booking.create({
    user_id:      staff._id,
    bike_id:      bike._id,
    start_time:   new Date(Date.now() - 7200000), // 2 hrs ago
    end_time:     new Date(Date.now() - 3600000), // 1 hr ago
    total_amount: 200,
    final_amount: 200,
    status:       'completed',
  });
  return booking;
};

describe('Review routes', () => {

  // ── POST /api/reviews ──────────────────────────────────────
  describe('POST /api/reviews', () => {
    it('staff can submit a review for a completed booking', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      const res = await request(app)
        .post('/api/reviews')
        .set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 5, comment: 'Great ride!' });

      expect(res.status).toBe(201);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('Great ride!');
    });

    it('updates bike avg_rating after review submission', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      await request(app)
        .post('/api/reviews')
        .set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 4 });

      // Wait briefly for post-save hook
      await new Promise(r => setTimeout(r, 100));

      const updatedBike = await Bike.findById(bike._id);
      expect(updatedBike.avg_rating).toBe(4);
      expect(updatedBike.review_count).toBe(1);
    });

    it('averages ratings from multiple reviews on the same bike', async () => {
      const staffA  = await createStaff();
      const staffB  = await createStaff();
      const bike    = await createBike();

      const bookingA = await createCompletedBooking(staffA, bike);
      const bookingB = await createCompletedBooking(staffB, bike);

      await request(app).post('/api/reviews').set(authHeader(staffA))
        .send({ booking_id: bookingA._id, rating: 5 });
      await request(app).post('/api/reviews').set(authHeader(staffB))
        .send({ booking_id: bookingB._id, rating: 3 });

      await new Promise(r => setTimeout(r, 150));

      const updatedBike = await Bike.findById(bike._id);
      expect(updatedBike.avg_rating).toBe(4);   // (5+3)/2
      expect(updatedBike.review_count).toBe(2);
    });

    it('prevents submitting a second review for the same booking', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 5 });

      const res = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 4, comment: 'Changed my mind' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already reviewed/i);
    });

    it('rejects review for a booking that is not completed', async () => {
      const staff = await createStaff();
      const bike  = await createBike();

      const createRes = await request(app).post('/api/bookings').set(authHeader(staff))
        .send({ bike_id: bike._id, ...dateRange(2, 2) });

      const res = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: createRes.body.data._id, rating: 5 });

      expect(res.status).toBe(400);
    });

    it("rejects review for another user's booking", async () => {
      const staffA  = await createStaff();
      const staffB  = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staffA, bike);

      const res = await request(app).post('/api/reviews').set(authHeader(staffB))
        .send({ booking_id: booking._id, rating: 3 });

      expect(res.status).toBe(400);
    });

    it('validates rating range (1–5)', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      const tooHigh = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 6 });
      expect(tooHigh.status).toBe(400);

      const tooLow = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 0 });
      expect(tooLow.status).toBe(400);
    });
  });

  // ── GET /api/reviews/bike/:bike_id ─────────────────────────
  describe('GET /api/reviews/bike/:bike_id', () => {
    it('returns paginated reviews for a bike (public)', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 4, comment: 'Nice!' });

      const res = await request(app).get(`/api/reviews/bike/${bike._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].comment).toBe('Nice!');
    });

    it('returns empty array for bike with no reviews', async () => {
      const bike = await createBike();
      const res  = await request(app).get(`/api/reviews/bike/${bike._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ── PUT /api/reviews/:id ───────────────────────────────────
  describe('PUT /api/reviews/:id', () => {
    it('user can edit their own recent review', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      const create = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 3, comment: 'Average' });

      const res = await request(app)
        .put(`/api/reviews/${create.body.data._id}`)
        .set(authHeader(staff))
        .send({ rating: 5, comment: 'Changed my mind — excellent!' });

      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('Changed my mind — excellent!');
    });

    it('returns 404 when user tries to edit another user's review', async () => {
      const staffA  = await createStaff();
      const staffB  = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staffA, bike);

      const create = await request(app).post('/api/reviews').set(authHeader(staffA))
        .send({ booking_id: booking._id, rating: 3 });

      const res = await request(app)
        .put(`/api/reviews/${create.body.data._id}`)
        .set(authHeader(staffB))
        .send({ rating: 1 });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/reviews/:id ────────────────────────────────
  describe('DELETE /api/reviews/:id', () => {
    it('admin can delete any review', async () => {
      const admin   = await createAdmin();
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      const create = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 2, comment: 'Spam review' });

      const res = await request(app)
        .delete(`/api/reviews/${create.body.data._id}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
    });

    it('staff cannot delete a review', async () => {
      const staff   = await createStaff();
      const bike    = await createBike();
      const booking = await createCompletedBooking(staff, bike);

      const create = await request(app).post('/api/reviews').set(authHeader(staff))
        .send({ booking_id: booking._id, rating: 4 });

      const res = await request(app)
        .delete(`/api/reviews/${create.body.data._id}`)
        .set(authHeader(staff));

      expect(res.status).toBe(403);
    });
  });
});
