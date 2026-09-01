# Manyatta Kisumu Diocese Youths — Website Project

```
manyatta-kisumu-youth/
├── frontend/                 HTML, CSS, JS — the public website
└── backend/
    ├── node-service/         Node.js + Express — auth & membership numbers
    └── django-service/       Django + Python — registration, payments, dashboard
```

## Current status
- **Frontend**: built. Home, About Us, Our Team, Gallery, Testimonials,
  Login, Join Us, a custom 404, and a downloadable constitution PDF —
  content and registration form aligned with the real MKDY constitution.
  Both `signup.html` and `login.html` are wired to the real backend:
  registration, account creation, session login/logout, and M-Pesa payment
  all call the actual APIs below (see `frontend/README.md`).
- **Backend**: built and smoke-tested — **both services now run on
  PostgreSQL** (Node was originally on MongoDB, but switched since MongoDB
  needs either a local install unavailable via apt on modern Ubuntu, or a
  separate Atlas account, while Postgres just works locally).
  - `node-service` handles account registration/login (via a secure
    HttpOnly session cookie) and issues official membership numbers
    (`MKDY-2026-0001` style) via an atomic Postgres upsert — tested under
    real concurrent load with zero collisions.
  - `django-service` handles the full registration form (matching the
    constitution's actual Sections A/B/C), M-Pesa STK Push (currently the
    only payment method exposed in the UI — PayPal and Card are built but
    not surfaced), and a redesigned committee dashboard (`/dashboard/` +
    Django admin at `/admin/`).
  - The two talk to each other exactly once per member: after Django
    confirms a payment, it calls Node to assign that member a number.

## Why two backend services instead of one
This was a deliberate choice to practice both stacks side by side, with a
clean boundary: **Node owns identity, Django owns money + registration
data + reporting.** They're linked only by the member's email address and a
shared internal API key — both happen to run on PostgreSQL, but in
separate databases, so either one could be redeployed, rewritten, or
swapped out independently later.

## Getting the whole thing running locally
```bash
# 1. Frontend
cd frontend && python3 -m http.server 8000        # http://localhost:8000

# 2. Node auth/membership service
cd backend/node-service && npm install && cp .env.example .env && npm run dev
                                                     # http://localhost:5001

# 3. Django registration/payments/dashboard service
cd backend/django-service && pip install -r requirements.txt && cp .env.example .env
python3 manage.py migrate && python3 manage.py runserver 8001
                                                     # http://localhost:8001
```
Set `INTERNAL_API_KEY` to the same value in both backend `.env` files.

Full details, including the complete API reference for each service, live in:
- [`frontend/README.md`](./frontend/README.md)
- [`backend/README.md`](./backend/README.md) — architecture + how the two services connect
- [`backend/node-service/README.md`](./backend/node-service/README.md)
- [`backend/django-service/README.md`](./backend/django-service/README.md)

## Next step
Get real Safaricom Daraja sandbox credentials into `django-service/.env` so
the STK Push actually reaches a phone (Safaricom's sandbox only delivers to
their test number, `254708374149` — see `django-service/README.md`).
