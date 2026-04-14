# 🚲 Bike Rental — Backend API

Express.js + MongoDB REST API for the Bike Rental Booking system.

---

## Tech stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose ODM
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: Joi
- **Security**: Helmet, express-mongo-sanitize, express-rate-limit, CORS

---

## Getting started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 3. Seed the database (optional)
```bash
npm run seed
```
Creates 2 users, 6 bikes, and 2 promo codes.

**Default credentials after seeding:**
| Role  | Email                     | Password   |
|-------|---------------------------|------------|
| Admin | admin@bikerental.com      | admin123   |
| Staff | staff@bikerental.com      | staff123   |

### 4. Run the server
```bash
npm run dev     # development (nodemon)
npm start       # production
```

Server starts at: `http://localhost:5000`

---

## Project structure

```
src/
├── server.js               # Entry point
├── app.js                  # Express setup & middleware
├── config/
│   └── db.js               # MongoDB connection
├── models/
│   ├── user.model.js
│   ├── bike.model.js
│   ├── booking.model.js
│   ├── promo.model.js
│   └── review.model.js
├── controllers/
│   ├── auth.controller.js
│   ├── bike.controller.js
│   ├── booking.controller.js
│   ├── promo.controller.js
│   ├── review.controller.js
│   └── user.controller.js
├── routes/
│   ├── auth.routes.js
│   ├── bike.routes.js
│   ├── booking.routes.js
│   ├── promo.routes.js
│   ├── review.routes.js
│   └── user.routes.js
├── middleware/
│   ├── auth.middleware.js    # JWT protect + restrictTo
│   ├── validate.middleware.js # Joi validation schemas
│   └── error.middleware.js   # Global error handler
└── utils/
    └── seeder.js             # Dev data seeder
```

---

## Authentication

All protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

**Roles:**
- `admin` — full access to all endpoints
- `staff` — can create bookings, view own bookings, submit reviews

---

## API endpoints

### Auth — `/api/auth`
| Method | Endpoint      | Access        |
|--------|--------------|---------------|
| POST   | /register    | Public        |
| POST   | /login       | Public        |
| GET    | /me          | Staff, Admin  |
| PUT    | /me          | Staff, Admin  |
| POST   | /logout      | Staff, Admin  |

### Bikes — `/api/bikes`
| Method | Endpoint             | Access        |
|--------|---------------------|---------------|
| GET    | /                   | Public        |
| GET    | /:id                | Public        |
| GET    | /availability       | Public        |
| POST   | /                   | Admin         |
| PUT    | /:id                | Admin         |
| PATCH  | /:id/status         | Admin, Staff  |
| DELETE | /:id                | Admin         |

**Bike list query params:** `?type=mountain&status=available&location=kolkata&min_price=50&max_price=200&sort=price_asc&page=1&limit=10`

**Availability check:** `?bike_id=<id>&start=<ISO date>&end=<ISO date>`

### Bookings — `/api/bookings`
| Method | Endpoint        | Access        |
|--------|----------------|---------------|
| POST   | /              | Staff, Admin  |
| GET    | /              | Admin         |
| GET    | /my            | Staff         |
| GET    | /stats         | Admin         |
| GET    | /:id           | Staff, Admin  |
| PUT    | /:id           | Admin         |
| PATCH  | /:id/status    | Staff, Admin  |
| DELETE | /:id           | Admin         |

**Create booking body:**
```json
{
  "bike_id": "<ObjectId>",
  "start_time": "2025-02-01T09:00:00.000Z",
  "end_time": "2025-02-01T17:00:00.000Z",
  "promo_code": "WELCOME20",
  "notes": "Optional notes"
}
```

**Booking status flow:** `pending → confirmed → active → completed` (or `cancelled`)

### Promo codes — `/api/promos`
| Method | Endpoint        | Access        |
|--------|----------------|---------------|
| POST   | /validate      | Staff, Admin  |
| GET    | /              | Admin         |
| POST   | /              | Admin         |
| PUT    | /:id           | Admin         |
| PATCH  | /:id/toggle    | Admin         |
| DELETE | /:id           | Admin         |

### Reviews — `/api/reviews`
| Method | Endpoint            | Access  |
|--------|-------------------|---------|
| POST   | /                 | Staff   |
| GET    | /bike/:bike_id    | Public  |
| GET    | /my               | Staff   |
| PUT    | /:id              | Staff   |
| DELETE | /:id              | Admin   |

### Users — `/api/users`
| Method | Endpoint          | Access |
|--------|-----------------|--------|
| GET    | /               | Admin  |
| GET    | /:id            | Admin  |
| PATCH  | /:id/role       | Admin  |
| PATCH  | /:id/toggle     | Admin  |
| DELETE | /:id            | Admin  |

---

## Standard response format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Paginated:**
```json
{
  "success": true,
  "total": 25,
  "page": 1,
  "pages": 3,
  "data": [ ... ]
}
```

**Error:**
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

---

## Environment variables

| Variable               | Description                        | Default     |
|------------------------|------------------------------------|-------------|
| `NODE_ENV`             | Environment (development/production) | development |
| `PORT`                 | Server port                         | 5000        |
| `MONGO_URI`            | MongoDB connection string           | —           |
| `JWT_SECRET`           | JWT signing secret (keep private!)  | —           |
| `JWT_EXPIRES_IN`       | Token expiry duration               | 7d          |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms             | 900000      |
| `RATE_LIMIT_MAX`       | Max requests per window             | 100         |
| `CLIENT_URL`           | Frontend URL for CORS               | http://localhost:3000 |
