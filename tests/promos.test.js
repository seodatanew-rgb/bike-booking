const request = require('supertest');
const app     = require('../src/app');
const { createAdmin, createStaff, authHeader, createPromo } = require('./helpers');

describe('Promo code routes', () => {

  // ── POST /api/promos/validate ──────────────────────────────
  describe('POST /api/promos/validate', () => {
    it('validates a valid percent promo and returns discount info', async () => {
      const staff = await createStaff();
      const promo = await createPromo({ code: 'PCT20', discount_type: 'percent', discount_value: 20 });

      const res = await request(app)
        .post('/api/promos/validate')
        .set(authHeader(staff))
        .send({ code: promo.code, booking_amount: 500 });

      expect(res.status).toBe(200);
      expect(res.body.data.discount_amount).toBe(100);   // 20% of 500
      expect(res.body.data.final_amount).toBe(400);
    });

    it('validates a valid flat promo', async () => {
      const staff = await createStaff();
      const promo = await createPromo({ code: 'FLAT75', discount_type: 'flat', discount_value: 75 });

      const res = await request(app)
        .post('/api/promos/validate')
        .set(authHeader(staff))
        .send({ code: promo.code, booking_amount: 300 });

      expect(res.status).toBe(200);
      expect(res.body.data.discount_amount).toBe(75);
      expect(res.body.data.final_amount).toBe(225);
    });

    it('caps flat discount at booking amount (never negative)', async () => {
      const staff = await createStaff();
      const promo = await createPromo({ code: 'BIG', discount_type: 'flat', discount_value: 1000 });

      const res = await request(app)
        .post('/api/promos/validate')
        .set(authHeader(staff))
        .send({ code: promo.code, booking_amount: 200 });

      expect(res.status).toBe(200);
      expect(res.body.data.discount_amount).toBe(200);  // capped
      expect(res.body.data.final_amount).toBe(0);
    });

    it('returns 400 for inactive promo', async () => {
      const staff = await createStaff();
      const promo = await createPromo({ code: 'OFF', is_active: false });

      const res = await request(app)
        .post('/api/promos/validate')
        .set(authHeader(staff))
        .send({ code: promo.code, booking_amount: 200 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when usage limit is exhausted', async () => {
      const staff = await createStaff();
      const promo = await createPromo({ code: 'USED', usage_limit: 5, used_count: 5 });

      const res = await request(app)
        .post('/api/promos/validate')
        .set(authHeader(staff))
        .send({ code: promo.code, booking_amount: 200 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/limit/i);
    });

    it('returns 400 when booking_amount is below minimum', async () => {
      const staff = await createStaff();
      const promo = await createPromo({ code: 'MINBIG', min_booking_amount: 1000 });

      const res = await request(app)
        .post('/api/promos/validate')
        .set(authHeader(staff))
        .send({ code: promo.code, booking_amount: 200 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/minimum/i);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/promos/validate')
        .send({ code: 'ANY', booking_amount: 200 });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/promos ────────────────────────────────────────
  describe('GET /api/promos', () => {
    it('admin can list all promos', async () => {
      const admin = await createAdmin();
      await createPromo({ code: 'P1' });
      await createPromo({ code: 'P2' });

      const res = await request(app).get('/api/promos').set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('staff cannot list promos', async () => {
      const staff = await createStaff();
      const res   = await request(app).get('/api/promos').set(authHeader(staff));
      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/promos ───────────────────────────────────────
  describe('POST /api/promos', () => {
    const validPromo = {
      code: 'NEWCODE', discount_type: 'percent',
      discount_value: 15, min_booking_amount: 100,
    };

    it('admin can create a promo code', async () => {
      const admin = await createAdmin();
      const res = await request(app).post('/api/promos').set(authHeader(admin)).send(validPromo);
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('NEWCODE');
    });

    it('upcases the code automatically', async () => {
      const admin = await createAdmin();
      const res = await request(app).post('/api/promos').set(authHeader(admin))
        .send({ ...validPromo, code: 'lowercase' });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('LOWERCASE');
    });

    it('returns 409 for duplicate code', async () => {
      const admin = await createAdmin();
      await request(app).post('/api/promos').set(authHeader(admin)).send(validPromo);
      const res = await request(app).post('/api/promos').set(authHeader(admin)).send(validPromo);
      expect(res.status).toBe(409);
    });

    it('rejects percent discount > 100', async () => {
      const admin = await createAdmin();
      const res = await request(app).post('/api/promos').set(authHeader(admin))
        .send({ ...validPromo, code: 'OVER100', discount_value: 150 });
      expect(res.status).toBe(400);
    });

    it('staff cannot create a promo', async () => {
      const staff = await createStaff();
      const res = await request(app).post('/api/promos').set(authHeader(staff)).send(validPromo);
      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /api/promos/:id/toggle ───────────────────────────
  describe('PATCH /api/promos/:id/toggle', () => {
    it('toggles promo from active to inactive', async () => {
      const admin = await createAdmin();
      const promo = await createPromo({ code: 'TOGGLE1', is_active: true });

      const res = await request(app)
        .patch(`/api/promos/${promo._id}/toggle`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);
    });

    it('toggles promo from inactive to active', async () => {
      const admin = await createAdmin();
      const promo = await createPromo({ code: 'TOGGLE2', is_active: false });

      const res = await request(app)
        .patch(`/api/promos/${promo._id}/toggle`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(true);
    });
  });

  // ── DELETE /api/promos/:id ─────────────────────────────────
  describe('DELETE /api/promos/:id', () => {
    it('admin can delete a promo', async () => {
      const admin = await createAdmin();
      const promo = await createPromo({ code: 'TODEL' });

      const res = await request(app).delete(`/api/promos/${promo._id}`).set(authHeader(admin));
      expect(res.status).toBe(200);
    });

    it('returns 404 for unknown id', async () => {
      const admin = await createAdmin();
      const res = await request(app)
        .delete('/api/promos/64f000000000000000000000')
        .set(authHeader(admin));
      expect(res.status).toBe(404);
    });
  });
});
