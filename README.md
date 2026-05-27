# Cinema Seating Optimisation System
**Advanced Topics in Software Engineering — Assessment 3**  
MERN Stack · JWT Auth · Seating Optimisation · Full-Stack Prototype

---

## 🎬 Overview

A full-stack MERN web application implementing an intelligent cinema seat allocation algorithm. The core priority is **preventing isolated single-seat gaps**, keeping groups together, and maximising occupancy efficiency.

### What makes this distinction-level

- Custom **scoring algorithm** evaluates every candidate block before allocation
- **Orphan gap detection** — orphan creation penalises score (−10 per gap) but never hard-rejects
- **Visual "Why These Seats?" panel** — live score breakdown with reasoning on every booking preview
- **Fragmentation delta display** — shows before/after effect on layout quality
- **Cancellation reallocation visual** — shows fragmentation improvement after cancellation
- **Stress test simulation** with history comparison table
- **JWT auth** with admin/customer/guest roles; admin requires `@cinema.com` email
- **Full offline mode** — works without MongoDB, everything persists in localStorage

---

## 📁 Project Structure

```
cinema-seating/
├── backend/
│   ├── models/         Seat, Booking, User (Mongoose schemas)
│   ├── routes/         auth, seats, bookings, admin, simulation
│   ├── middleware/     JWT protect/restrictTo/optionalAuth
│   ├── utils/          seatAlgorithm.js ⭐, layoutBuilder.js
│   ├── __tests__/      21 backend unit tests (Jest)
│   └── server.js
│
└── frontend/
    └── src/
        ├── context/    AuthContext (JWT+offline), CinemaContext (seats+bookings)
        ├── components/ Navbar, StatsBar, AlgorithmPanel, SeatGrid (tooltips), RejectionModal
        ├── pages/      Home, Book, Confirmation, MyBookings, Simulation, Admin, Login, Register
        └── utils/      algorithmClient.js (client-side mirror), layoutBuilder.js
```

---

## 🚀 Quick Start

```bash
# Backend
cd backend && npm install && npm run dev   # → localhost:5000

# Frontend
cd frontend && npm install && npm run dev  # → localhost:3000

# Tests
cd backend  && npm test   # 21 tests
cd frontend && npm test   # 32 tests
```

> **No MongoDB?** The app runs fully offline — algorithm runs client-side, bookings persist in localStorage.

---

## 🔐 Authentication & Roles

| Role | Access | Email Rule |
|------|--------|------------|
| **Admin** | All pages + dashboard | Must use `@cinema.com` email |
| **Customer** | Book, history, confirmation | Any email |
| **Guest** | Book, history (no signup) | None required |

**Demo accounts (work offline):**
- Admin: `admin@cinema.com` / `admin123`
- Customer: `customer@cinema.com` / `customer123`
- Guest: click "Continue as Guest"

---

## 🧠 Algorithm

### Scoring System
```
score = group_together   (+10 if all seats in one block)
      + centre_bonus     (up to +8 for cols 10–18)
      + row_quality      (+8 tier-1 rows G–J, down to +2 tier-4)
      + solo_edge        (+5 if solo user gets edge/aisle seat)
      - orphan_penalty   (−10 per isolated gap that would be created)
      - poor_row         (−3 for rows A, B, O)
```

### Key Principle
The algorithm **never hard-rejects** due to orphan score — it picks the best available option. It only rejects when **no consecutive block of the requested size exists at all**.

### Visual Explanation Panel
Every booking preview shows:
- Why each row/position was chosen
- Score breakdown with ✓/⚠ for each factor
- Fragmentation delta (before vs after)
- Centre alignment percentage

---

## 🎭 Cinema Layout (per Assessment Brief)

- **Rows A–O** (15 rows), **Cols 1–28**
- **VIP**: Rows E–H, Columns 12–15
- **Disability**: 6 adjacent seats, Row A, cols 5–10
- **Broken**: 6–10/session, non-adjacent, never rows A/B

---

## 📊 Features

### Booking Page
- Live seat preview (green highlights) before confirming
- "Why These Seats?" expandable panel with full score breakdown
- Fragmentation impact display
- Group Size 1–7 slider
- VIP ★ and ♿ Accessible toggles
- "Clear Cache" button for recovery from stale data

### Simulation Page
- 4 scenarios: 50%, 75%, 90%, Random Stress
- Run history comparison table
- Fragmentation and occupancy progress bars
- Isolated from booking page (never pollutes real seat state)

### Admin Dashboard (4 tabs)
- **Overview**: Seat override (break/restore/force-book), analytics, seat breakdown
- **Bookings**: All bookings (API + localStorage merged), admin cancel any booking
- **Users**: Registered users with booking counts, activate/deactivate
- **Seat Map**: Live cinema layout

### Booking History
- Cancellation reallocation visual — shows fragmentation before/after
- Guest bookings via guestId tracking
- Cancel button with loading state

---

## 🌐 REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (admin needs `@cinema.com`) |
| POST | `/api/auth/login` | Login → JWT |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/auth/users` | All users with booking counts (admin) |
| GET  | `/api/seats` | Get layout (auto-resets if stale) |
| POST | `/api/bookings/book` | Book seats (runs algorithm) |
| POST | `/api/bookings/cancel` | Cancel booking |
| GET  | `/api/bookings/all` | All bookings (admin) |
| POST | `/api/simulate` | Stress test |
| POST | `/api/admin/override` | Force-allocate seats |
| POST | `/api/admin/mark-broken` | Break a seat |
| POST | `/api/admin/restore-seat` | Restore seat |
| POST | `/api/admin/generate-broken` | Regenerate all broken seats |
| POST | `/api/admin/cancel-booking` | Admin cancel |
| POST | `/api/admin/reset` | Full reset |
| GET  | `/api/admin/stats` | Full analytics |

---

## 🧪 Tests (53 total)

### Backend (21)
- Group seating, orphan prevention, broken seat rules
- VIP/disability allocation, fragmentation scoring
- Rejection analysis, bcrypt auth

### Frontend (32)
- Layout builder, allocation algorithm, fragmentation
- Simulation density, component rendering
- AlgorithmPanel, StatsBar, SeatGrid legend

---

## ⚙️ Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cinema_seating
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
ADMIN_SECRET=cinema_admin_2024
NODE_ENV=development
```
