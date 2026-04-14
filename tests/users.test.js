const request = require('supertest');
const app     = require('../src/app');
const { createAdmin, createStaff, authHeader } = require('./helpers');

describe('User management routes', () => {

  // ── GET /api/users ─────────────────────────────────────────
  describe('GET /api/users', () => {
    it('admin gets a paginated list of all users', async () => {
      const admin = await createAdmin();
      await createStaff();
      await createStaff();

      const res = await request(app).get('/api/users').set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3); // admin + 2 staff
    });

    it('filters by role=staff', async () => {
      const admin = await createAdmin();
      await createStaff();

      const res = await request(app).get('/api/users?role=staff').set(authHeader(admin));
      expect(res.status).toBe(200);
      res.body.data.forEach(u => expect(u.role).toBe('staff'));
    });

    it('staff cannot list users', async () => {
      const staff = await createStaff();
      const res   = await request(app).get('/api/users').set(authHeader(staff));
      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/users/:id ─────────────────────────────────────
  describe('GET /api/users/:id', () => {
    it('admin can fetch a single user with recent bookings', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();

      const res = await request(app).get(`/api/users/${staff._id}`).set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(staff._id.toString());
      expect(Array.isArray(res.body.data.recent_bookings)).toBe(true);
    });

    it('returns 404 for unknown user', async () => {
      const admin = await createAdmin();
      const res   = await request(app).get('/api/users/64f000000000000000000000').set(authHeader(admin));
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/users/:id/role ──────────────────────────────
  describe('PATCH /api/users/:id/role', () => {
    it('admin can promote staff to admin', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();

      const res = await request(app)
        .patch(`/api/users/${staff._id}/role`)
        .set(authHeader(admin))
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('admin');
    });

    it('admin can demote admin to staff', async () => {
      const admin  = await createAdmin();
      const admin2 = await createAdmin();

      const res = await request(app)
        .patch(`/api/users/${admin2._id}/role`)
        .set(authHeader(admin))
        .send({ role: 'staff' });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('staff');
    });

    it('admin cannot change their own role', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/users/${admin._id}/role`)
        .set(authHeader(admin))
        .send({ role: 'staff' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/own role/i);
    });

    it('rejects invalid role value', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();

      const res = await request(app)
        .patch(`/api/users/${staff._id}/role`)
        .set(authHeader(admin))
        .send({ role: 'superuser' });

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /api/users/:id/toggle ────────────────────────────
  describe('PATCH /api/users/:id/toggle', () => {
    it('admin can deactivate an active user', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();

      const res = await request(app)
        .patch(`/api/users/${staff._id}/toggle`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);
    });

    it('admin can re-activate a deactivated user', async () => {
      const admin = await createAdmin();
      const staff = await createStaff({ is_active: false });

      const res = await request(app)
        .patch(`/api/users/${staff._id}/toggle`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(true);
    });

    it('admin cannot deactivate themselves', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/users/${admin._id}/toggle`)
        .set(authHeader(admin));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/own account/i);
    });

    it('deactivated user cannot log in', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();

      // Deactivate
      await request(app).patch(`/api/users/${staff._id}/toggle`).set(authHeader(admin));

      // Try to access a protected route
      const res = await request(app).get('/api/auth/me').set(authHeader(staff));
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/users/:id ──────────────────────────────────
  describe('DELETE /api/users/:id', () => {
    it('admin can delete another user', async () => {
      const admin = await createAdmin();
      const staff = await createStaff();

      const res = await request(app).delete(`/api/users/${staff._id}`).set(authHeader(admin));
      expect(res.status).toBe(200);

      const check = await request(app).get(`/api/users/${staff._id}`).set(authHeader(admin));
      expect(check.status).toBe(404);
    });

    it('admin cannot delete themselves', async () => {
      const admin = await createAdmin();

      const res = await request(app).delete(`/api/users/${admin._id}`).set(authHeader(admin));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/own account/i);
    });

    it('returns 404 for unknown user id', async () => {
      const admin = await createAdmin();
      const res = await request(app)
        .delete('/api/users/64f000000000000000000000')
        .set(authHeader(admin));
      expect(res.status).toBe(404);
    });
  });
});
