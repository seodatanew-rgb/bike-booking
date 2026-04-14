const request = require('supertest');
const app     = require('../src/app');
const { createAdmin, createStaff, authHeader, createBike } = require('./helpers');

describe('Bike routes', () => {

  // ── GET /api/bikes ─────────────────────────────────────────
  describe('GET /api/bikes', () => {
    beforeEach(async () => {
      await Promise.all([
        createBike({ name: 'Mountain King', type: 'mountain', location: 'Kolkata', price_per_hour: 80 }),
        createBike({ name: 'Road Racer',    type: 'road',     location: 'Mumbai',  price_per_hour: 120 }),
        createBike({ name: 'City Glider',   type: 'city',     location: 'Kolkata', price_per_hour: 50, status: 'maintenance' }),
      ]);
    });

    it('returns a paginated list of active bikes', async () => {
      const res = await request(app).get('/api/bikes');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });

    it('filters by type', async () => {
      const res = await request(app).get('/api/bikes?type=mountain');
      expect(res.status).toBe(200);
      res.body.data.forEach(b => expect(b.type).toBe('mountain'));
    });

    it('filters by status', async () => {
      const res = await request(app).get('/api/bikes?status=maintenance');
      expect(res.status).toBe(200);
      res.body.data.forEach(b => expect(b.status).toBe('maintenance'));
    });

    it('filters by location (case-insensitive)', async () => {
      const res = await request(app).get('/api/bikes?location=kolkata');
      expect(res.status).toBe(200);
      res.body.data.forEach(b => expect(b.location.toLowerCase()).toContain('kolkata'));
    });

    it('sorts by price ascending', async () => {
      const res = await request(app).get('/api/bikes?sort=price_asc');
      expect(res.status).toBe(200);
      const prices = res.body.data.map(b => b.price_per_hour);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('respects pagination (limit)', async () => {
      const res = await request(app).get('/api/bikes?limit=2&page=1');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pages).toBeGreaterThanOrEqual(1);
    });
  });

  // ── GET /api/bikes/:id ─────────────────────────────────────
  describe('GET /api/bikes/:id', () => {
    it('returns a single bike by id', async () => {
      const bike = await createBike({ name: 'Solo Rider' });
      const res  = await request(app).get(`/api/bikes/${bike._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Solo Rider');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get('/api/bikes/64f000000000000000000000');
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed id', async () => {
      const res = await request(app).get('/api/bikes/not-an-id');
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/bikes ────────────────────────────────────────
  describe('POST /api/bikes', () => {
    const bikeBody = {
      name: 'New Bike', brand: 'Giant', type: 'hybrid',
      price_per_hour: 90, price_per_day: 550, location: 'Delhi',
    };

    it('admin can create a bike', async () => {
      const admin = await createAdmin();
      const res   = await request(app).post('/api/bikes').set(authHeader(admin)).send(bikeBody);
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Bike');
    });

    it('staff cannot create a bike', async () => {
      const staff = await createStaff();
      const res   = await request(app).post('/api/bikes').set(authHeader(staff)).send(bikeBody);
      expect(res.status).toBe(403);
    });

    it('returns 400 for missing required fields', async () => {
      const admin = await createAdmin();
      const res   = await request(app).post('/api/bikes').set(authHeader(admin)).send({ name: 'Incomplete' });
      expect(res.status).toBe(400);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app).post('/api/bikes').send(bikeBody);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/bikes/:id ─────────────────────────────────────
  describe('PUT /api/bikes/:id', () => {
    it('admin can update a bike', async () => {
      const admin = await createAdmin();
      const bike  = await createBike();
      const res   = await request(app)
        .put(`/api/bikes/${bike._id}`)
        .set(authHeader(admin))
        .send({ ...bike.toObject(), price_per_hour: 999 });
      expect(res.status).toBe(200);
      expect(res.body.data.price_per_hour).toBe(999);
    });

    it('returns 404 for unknown id', async () => {
      const admin = await createAdmin();
      const res = await request(app)
        .put('/api/bikes/64f000000000000000000000')
        .set(authHeader(admin))
        .send({ name: 'X', brand: 'Y', type: 'road', price_per_hour: 50, price_per_day: 300, location: 'City' });
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/bikes/:id/status ────────────────────────────
  describe('PATCH /api/bikes/:id/status', () => {
    it('admin can update bike status', async () => {
      const admin = await createAdmin();
      const bike  = await createBike();
      const res   = await request(app)
        .patch(`/api/bikes/${bike._id}/status`)
        .set(authHeader(admin))
        .send({ status: 'maintenance' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('maintenance');
    });

    it('staff can update bike status', async () => {
      const staff = await createStaff();
      const bike  = await createBike();
      const res   = await request(app)
        .patch(`/api/bikes/${bike._id}/status`)
        .set(authHeader(staff))
        .send({ status: 'maintenance' });
      expect(res.status).toBe(200);
    });

    it('rejects invalid status values', async () => {
      const admin = await createAdmin();
      const bike  = await createBike();
      const res   = await request(app)
        .patch(`/api/bikes/${bike._id}/status`)
        .set(authHeader(admin))
        .send({ status: 'flying' });
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /api/bikes/:id ──────────────────────────────────
  describe('DELETE /api/bikes/:id', () => {
    it('soft-deletes bike (sets is_active=false)', async () => {
      const admin = await createAdmin();
      const bike  = await createBike();
      const res   = await request(app).delete(`/api/bikes/${bike._id}`).set(authHeader(admin));
      expect(res.status).toBe(200);

      // Should not appear in public listing
      const listRes = await request(app).get('/api/bikes');
      const ids = listRes.body.data.map(b => b._id);
      expect(ids).not.toContain(bike._id.toString());
    });

    it('staff cannot delete a bike', async () => {
      const staff = await createStaff();
      const bike  = await createBike();
      const res   = await request(app).delete(`/api/bikes/${bike._id}`).set(authHeader(staff));
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/bikes/availability ────────────────────────────
  describe('GET /api/bikes/availability', () => {
    it('returns available=true when no conflicting bookings', async () => {
      const bike  = await createBike();
      const start = new Date(Date.now() + 3600000).toISOString();
      const end   = new Date(Date.now() + 7200000).toISOString();
      const res   = await request(app)
        .get(`/api/bikes/availability?bike_id=${bike._id}&start=${start}&end=${end}`);
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
    });

    it('returns 400 when query params are missing', async () => {
      const res = await request(app).get('/api/bikes/availability');
      expect(res.status).toBe(400);
    });
  });
});
