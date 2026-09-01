# Backend

Two independent services, each with its own dependencies, own database, and
own deployment — they only talk to each other over HTTP for one thing:
handing off "this member has paid" so a membership number can be issued.

```
backend/
├── node-service/     ← Node.js + Express — auth & membership numbers
└── django-service/   ← Django + Python — registration, payments, dashboard
```

## Who owns what

| | **node-service** | **django-service** |
|---|---|---|
| Login / signup credentials | done | |
| JWT sessions | done | |
| Membership number generation | done | |
| Full registration form (name, parish, DOB, gender, category) | | done |
| M-Pesa STK Push | | done |
| PayPal | | done |
| Card (Flutterwave) | | done |
| Admin / reporting dashboard | | done |
| Database | PostgreSQL (separate `mkdy_auth` database) | PostgreSQL (separate `mkdy_django` database, falls back to SQLite if unconfigured) |

## How they connect

```
Frontend (signup.html)
    │
    ├─► Node   POST /api/auth/register         create login account
    │
    ├─► Django POST /api/registration/         submit full membership form
    │                                           → returns subscription_amount
    │
    └─► Django POST /api/payments/{mpesa|paypal|card}/...
                    │
                    │  on confirmed payment (webhook/callback)
                    ▼
              Django calls Node internally:
              POST /api/membership/assign  { email }
              header: x-internal-key: <shared secret>
                    │
                    ▼
              Node generates "MKDY-2026-0001", saves it,
              returns it to Django, which stores it on the
              registration record for the dashboard.
```

Both services run on PostgreSQL, but never share a database or a table —
they're linked loosely by the member's **email address**, and the only
trusted line between them is the `INTERNAL_API_KEY` shared secret used for
that one server-to-server call. (Node uses Sequelize, Django uses its own
ORM — nothing about the tables is shared or coupled.)

## Running both locally
```bash
# Terminal 1
cd backend/node-service && npm install && cp .env.example .env && npm run dev
# -> http://localhost:5001

# Terminal 2
cd backend/django-service && pip install -r requirements.txt && cp .env.example .env
python3 manage.py migrate && python3 manage.py runserver 8001
# -> http://localhost:8001
```
Make sure `INTERNAL_API_KEY` is identical in both `.env` files, and that
each service's `POSTGRES_DB` points at its own separate database (see each
service's README for creating them).

Both services have been installed, migrated and smoke-tested end-to-end
while building this: **node-service now runs on PostgreSQL** (switched from
an earlier MongoDB version, since MongoDB isn't installable via apt on
modern Ubuntu and needs a separate Atlas signup, while Postgres just
works) — tested for real against a live local database: register, login,
session cookie set and read back on `/api/auth/me`, logout correctly
invalidating the session, and concurrent membership-number requests fired
in parallel to confirm the atomic counter never produces a duplicate under
real concurrent load. Django was tested the same way — register/pay/
dashboard against its own **real local PostgreSQL instance**, a simulated
M-Pesa callback correctly activating a membership even when Node was
offline (without crashing), and the redesigned `/dashboard/` page
screenshot-tested at both desktop and mobile widths.

See each service's own README for its full API reference:
- [`node-service/README.md`](./node-service/README.md)
- [`django-service/README.md`](./django-service/README.md)

## Not done yet
- Password reset ("forgot password") isn't implemented — would need email
  sending, which neither service currently does.
- PayPal and Card (Flutterwave) are built and working in `django-service`
  but not currently exposed in the frontend UI — M-Pesa is the only payment
  method surfaced right now, by request.
- Production deployment (HTTPS, a managed Postgres instance, real
  M-Pesa/PayPal/Flutterwave credentials, hosting both services, and a public
  callback URL for Safaricom — e.g. via ngrok in development).
- Basic automated tests for both services.
