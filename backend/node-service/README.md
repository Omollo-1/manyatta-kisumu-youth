# Auth & Membership Service (Node.js + Express)

Owns two things only:
1. **Authentication** — register/login for member accounts (JWT-based)
2. **Membership numbers** — atomically generating and assigning a member's
   official membership number once Django confirms their payment

Registration form details, payments, and the admin dashboard all live in
the **Django service** (`backend/django-service`) — this service doesn't
know about parishes, subscriptions, or M-Pesa at all.

## Stack
- Express 4
- **PostgreSQL + Sequelize** — same `POSTGRES_*` variable naming as `django-service`, but a separate database (`mkdy_auth` by default), so the two services never share a table
- JWT auth (`jsonwebtoken`) + `bcryptjs` for password hashing, delivered via an **HttpOnly cookie**

## How sessions work
Login and register set a `mkdy_token` cookie with `httpOnly: true` — the
browser sends it automatically on every request, and JavaScript on the page
can never read it (so an XSS bug elsewhere on the site can't steal a
session). This is why `login.html` doesn't need `localStorage` at all: the
frontend just calls `fetch(..., { credentials: 'include' })` and the
session persists across page loads on its own.

Requirements for this to work: `CLIENT_ORIGIN` in `.env` must be an exact
origin (never `*`), and the frontend must be served from that exact origin
(e.g. `python3 -m http.server 8000`, not opening the HTML file directly via
`file://`).

## Setup
```bash
cd backend/node-service
npm install
cp .env.example .env
# then edit .env: set POSTGRES_PASSWORD, JWT_SECRET, INTERNAL_API_KEY
npm run dev
```
Server runs at `http://localhost:5001` by default.

If Postgres isn't reachable, the server still boots (useful for quickly
checking it's alive) but any route touching the database will fail until
it's fixed — the log tells you exactly what's wrong (wrong password,
Postgres not running, database/user not created yet).

On a successful boot you'll see:
```
[db] PostgreSQL connected: mkdy_auth on localhost
[db] Tables synced
[mkdy-auth-service] listening on http://localhost:5001
```
`Tables synced` means Sequelize just created (or updated) the `users` and
`counters` tables to match the models — no separate migration step needed
for a project this size.

## Environment variables
See `.env.example`. The important one to coordinate with the Django team:
**`INTERNAL_API_KEY`** must be identical in both `node-service/.env` and
`django-service/.env` — it's how Django proves to Node that a payment
request is legitimate.

## Setting up PostgreSQL

**Option A — install it locally:**
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER mkdy_node_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE mkdy_auth OWNER mkdy_node_user;"
```
Then in `.env`:
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mkdy_auth
POSTGRES_USER=mkdy_node_user
POSTGRES_PASSWORD=yourpassword
```

**Option B — a free managed instance (no local install):** [Neon](https://neon.tech),
[Supabase](https://supabase.com), or [Render](https://render.com) all offer a
free Postgres tier. Create a database there, then copy its host/user/password
into the same `POSTGRES_*` variables above.

**Important:** if you're running `django-service` too, give this service its
**own** database (different `POSTGRES_DB`, e.g. `mkdy_auth` vs Django's
`mkdy_django`) even if they share the same Postgres server/instance. The two
services are intentionally decoupled — see "Where this fits" below.

This has been tested end-to-end against a real local Postgres instance,
including firing concurrent membership-number requests to confirm the
atomic counter never produces a duplicate under real concurrent load.

## API

### Public / member-facing
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ fullName, email, password }` | Creates an account. Sets an HttpOnly `mkdy_token` session cookie **and** returns `{ token, user }` in the body |
| POST | `/api/auth/login` | `{ email, password }` | Same as above — sets the cookie and returns `{ token, user }` |
| POST | `/api/auth/logout` | — | Clears the session cookie |
| GET  | `/api/auth/me` | — | Returns the current user. Reads the session from the `mkdy_token` cookie automatically, or accepts `Authorization: Bearer <token>` for non-browser clients |
| GET  | `/api/membership/verify/:membershipNumber` | — | Public lookup, e.g. to verify a member at an event |
| GET  | `/api/health` | — | Health check |

### Internal (server-to-server, called by the Django service only)
Require header `x-internal-key: <INTERNAL_API_KEY>`.

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/membership/assign` | `{ email }` | Generates & saves the next membership number (idempotent — safe to retry) |
| GET  | `/api/membership/status/:email` | — | Returns current membership number/status |

## Example: full flow with curl
```bash
# 1. Register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Achieng","email":"jane@example.com","password":"secret123"}'

# 2. Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"secret123"}'

# 3. (Internal — this is what Django calls after a successful payment)
curl -X POST http://localhost:5001/api/membership/assign \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY>" \
  -d '{"email":"jane@example.com"}'

# 4. Anyone can verify a membership number
curl http://localhost:5001/api/membership/verify/MKDY-2026-0001
```

## Membership number format
`MKDY-<year>-<zero-padded sequence>`, e.g. `MKDY-2026-0001`. Numbers are
issued from an atomic per-year counter (`src/models/Counter.js` +
`src/utils/generateMembershipNumber.js`) via a single Postgres
`INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement — the increment
happens in one round-trip to the database, so two people paying at the same
moment can never be handed the same number. Verified under real concurrent
load while building this.

## Where this fits
```
frontend (signup.html)
   │  1. create account
   ▼
Node /api/auth/register  ──────────────►  Django /api/registration/  (full form details)
                                                 │
                                                 ▼
                                          Django /api/payments/... (M-Pesa/PayPal/card)
                                                 │  on payment success
                                                 ▼
                                    Node /api/membership/assign (internal call)
                                                 │
                                                 ▼
                                     membership number stored back on
                                     the Django registration record too
```
