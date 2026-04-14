const request  = require('supertest');
const app      = require('../src/app');
const User     = require('../src/models/user.model');
const { createAdmin, createStaff, authHeader } = require('./helpers');

describe('Auth routes', () => {

  // ── POST /api/auth/register ────────────────────────────────
  describe('POST /api/auth/register', () => {
    const validBody = {
      name: 'Jane Doe', email: 'jane@test.com',
      password: 'secret123', role: 'staff',
    };

    it('registers a new user and returns a token', async () => {
      const res = await request(app).post('/api/auth/register').send(validBody);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.email).toBe(validBody.email);
      expect(res.body.data.password).toBeUndefined(); // never expose hash
    });

    it('returns 409 when email is already taken', async () => {
      await request(app).post('/api/auth/register').send(validBody);
      const res = await request(app).post('/api/auth/register').send(validBody);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'x@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when password is too short', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...validBody, email: 'new@test.com', password: '123' });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/login ───────────────────────────────────
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Login User', email: 'login@test.com', password: 'pass1234', role: 'staff',
      });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'pass1234' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.email).toBe('login@test.com');
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'pass1234' });
      expect(res.status).toBe(401);
    });

    it('returns 403 for deactivated account', async () => {
      await User.findOneAndUpdate({ email: 'login@test.com' }, { is_active: false });
      const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'pass1234' });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/auth/me ───────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const staff = await createStaff();
      const res = await request(app).get('/api/auth/me').set(authHeader(staff));
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(staff._id.toString());
      expect(res.body.data.password).toBeUndefined();
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a malformed token', async () => {
      const res = await request(app).get('/api/auth/me').set({ Authorization: 'Bearer bad.token.here' });
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/auth/me ───────────────────────────────────────
  describe('PUT /api/auth/me', () => {
    it('updates name and phone', async () => {
      const staff = await createStaff();
      const res = await request(app)
        .put('/api/auth/me')
        .set(authHeader(staff))
        .send({ name: 'Updated Name', phone: '+91-9999999999' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('changes password when current_password is correct', async () => {
      // Register via API so we know plaintext password
      await request(app).post('/api/auth/register').send({
        name: 'PwUser', email: 'pw@test.com', password: 'oldpass1', role: 'staff',
      });
      const loginRes = await request(app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'oldpass1' });
      const token = loginRes.body.token;

      const res = await request(app)
        .put('/api/auth/me')
        .set({ Authorization: `Bearer ${token}` })
        .send({ current_password: 'oldpass1', new_password: 'newpass1' });
      expect(res.status).toBe(200);

      // Old password should no longer work
      const loginOld = await request(app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'oldpass1' });
      expect(loginOld.status).toBe(401);

      // New password should work
      const loginNew = await request(app).post('/api/auth/login').send({ email: 'pw@test.com', password: 'newpass1' });
      expect(loginNew.status).toBe(200);
    });

    it('rejects password change when current_password is wrong', async () => {
      const staff = await createStaff();
      const res = await request(app)
        .put('/api/auth/me')
        .set(authHeader(staff))
        .send({ current_password: 'wrongcurrent', new_password: 'newpass99' });
      expect(res.status).toBe(401);
    });
  });

  // ── Role guard ─────────────────────────────────────────────
  describe('Role guard', () => {
    it('allows admin to access admin-only routes', async () => {
      const admin = await createAdmin();
      const res = await request(app).get('/api/users').set(authHeader(admin));
      expect(res.status).toBe(200);
    });

    it('blocks staff from admin-only routes', async () => {
      const staff = await createStaff();
      const res = await request(app).get('/api/users').set(authHeader(staff));
      expect(res.status).toBe(403);
    });
  });
});
