# Registration, Payments & Dashboard Service (Django + Python)

Owns three things:
1. **Full membership registration** — name, parish, DOB, gender, category
2. **Payment integrations** — M-Pesa (STK Push), PayPal, and Card (Flutterwave)
3. **Admin / reporting dashboard** — for the committee

Login and membership-number issuance live in the separate **Node/Express
service** (`backend/node-service`) — this service calls it internally, once,
right after a payment is confirmed.

## Stack
- Django 6 + Django REST Framework
- **PostgreSQL** (falls back to SQLite automatically if `POSTGRES_HOST` is left empty — handy for a 30-second first check, but use Postgres for anything real)
- `requests` for talking to Safaricom Daraja, PayPal, Flutterwave, and the Node service

## Setup
```bash
cd backend/django-service
python3 -m venv venv && source venv/bin/activate     # optional but recommended
pip install -r requirements.txt
cp .env.example .env
# edit .env: at minimum set SECRET_KEY, INTERNAL_API_KEY (must match node-service),
# POSTGRES_* (see below), and whichever payment provider credentials you're
# ready to test with

python3 manage.py migrate
python3 manage.py createsuperuser
python3 manage.py runserver 8001
```
Server runs at `http://localhost:8001`. (Using `8001` here so it doesn't clash
with the Node service on `5001` if you run both at once.)

Payment provider credentials are optional to get started — if they're
missing, the relevant endpoint returns a clear `502` error explaining what's
missing instead of crashing, so you can build/test the rest of the flow
before signing up for sandbox accounts.

## Setting up PostgreSQL

**Option A — install it locally:**
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER mkdy_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "CREATE DATABASE mkdy_django OWNER mkdy_user;"
```
Then in `.env`:
```
POSTGRES_HOST=localhost
POSTGRES_DB=mkdy_django
POSTGRES_USER=mkdy_user
POSTGRES_PASSWORD=yourpassword
POSTGRES_PORT=5432
```

**Option B — a free managed instance (no local install):** [Neon](https://neon.tech),
[Supabase](https://supabase.com), or [Render](https://render.com) all offer a
free Postgres tier. Create a database there, then copy its host/user/password/db
name into the same `POSTGRES_*` variables above.

Leave `POSTGRES_HOST` empty to fall back to SQLite (`db.sqlite3`) instead —
useful for a quick check, but switch to Postgres before you rely on this for
real data.

This has been tested end-to-end against a real local Postgres instance:
migrations apply cleanly, registrations and payments persist correctly, and
the dashboard queries render real aggregated data from it.

## Environment variables
See `.env.example`. The one to coordinate with the Node team:
**`INTERNAL_API_KEY`** must match `node-service/.env` exactly.

## API

### Registration
The `MemberRegistration` model mirrors the actual "Membership Registration
Form" at the back of the MKDY constitution, in three sections:
- **Section A — Personal Information**: `full_name`, `national_id`, `date_of_birth`, `gender`, `marital_status`, `phone`, `email`, `postal_address`, `residence`, `occupation`, `institution`
- **Section B — Church & Youth Details**: `parish`, `is_baptised`, `is_confirmed`, `other_church_roles`, `date_of_joining` (auto-set), `membership_category` (`member` or `leader`)
- **Section C — Next of Kin**: `next_of_kin_name`, `next_of_kin_relationship`, `next_of_kin_phone`, `next_of_kin_alt_phone`

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/registration/` | Full Section A/B/C fields (see above) | Returns the record including the server-computed `subscription_amount` — a flat KES 100/year per the constitution, **never trust an amount sent from the frontend.** |
| GET | `/api/registration/<id>/` | — | Fetch a registration (used to poll status after paying) |

### Payments — M-Pesa
| Method | Route | Body |
|---|---|---|
| POST | `/api/payments/mpesa/stkpush/` | `{ registration_id, phone }` — phone as `2547XXXXXXXX` |
| POST | `/api/payments/mpesa/callback/` | (Safaricom calls this — must be a public HTTPS URL, e.g. via `ngrok http 8001` in dev) |

### Payments — PayPal
| Method | Route | Body |
|---|---|---|
| POST | `/api/payments/paypal/create-order/` | `{ registration_id, currency? }` → returns `approve_url` to redirect the member to |
| POST | `/api/payments/paypal/capture/` | `{ order_id }` → call after the member approves on PayPal |

### Payments — Card (Flutterwave)
| Method | Route | Body |
|---|---|---|
| POST | `/api/payments/card/initiate/` | `{ registration_id, redirect_url }` → returns `payment_link` to redirect the member to |
| POST | `/api/payments/card/webhook/` | (Flutterwave calls this on completion) |

### Dashboard
| Method | Route | Notes |
|---|---|---|
| GET | `/dashboard/` | Modern, sidebar-based reporting page: stat cards, a bar chart of collections by provider, a doughnut chart of members by category, and recent-members/recent-payments tables. Log in at `/admin/` first (same session). |
| GET | `/api/dashboard/stats/` | JSON version of the same stats, for future custom front-ends. Requires staff login. |
| — | `/admin/` | Full Django admin (custom-branded "MKDY Admin") — browse/search/filter every registration and payment in detail |

The `/dashboard/` page is for at-a-glance reporting; `/admin/` is where the
committee actually edits records, since Django admin already gives full
CRUD, search and filtering for free.

## What happens on a successful payment
Every provider path (`mpesa/callback`, `paypal/capture`, `card/webhook`)
converges on the same helper, `_activate_membership()` in `payments/views.py`:
1. `registration.status` → `active`
2. Calls `POST {NODE_SERVICE_URL}/api/membership/assign` with the member's
   email and the shared `INTERNAL_API_KEY`
3. Saves the returned membership number onto the registration record so it
   shows up in the dashboard

This call is wrapped in a try/except — if the Node service is temporarily
unreachable, the payment is still recorded as successful and a warning is
logged. The membership-number assignment is idempotent on the Node side, so
it's safe to re-trigger later.

## Try it without any payment provider set up
```bash
# 1. Submit a registration
curl -X POST http://localhost:8001/api/registration/ \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Jane Achieng","national_id":"34567890","date_of_birth":"2000-05-10","gender":"female","marital_status":"single","phone":"0712345678","email":"jane@example.com","postal_address":"P.O. Box 45, Kisumu","residence":"Manyatta B","occupation":"Student","institution":"Kisumu Polytechnic","parish":"St. Stephens Manyatta","is_baptised":true,"is_confirmed":true,"other_church_roles":"Choir member","membership_category":"member","next_of_kin_name":"Grace Achieng","next_of_kin_relationship":"Mother","next_of_kin_phone":"0722334455"}'

# 2. Fetch it back (note the server-computed subscription_amount)
curl http://localhost:8001/api/registration/1/
```
Then log in at `http://localhost:8001/admin/` (or visit `/dashboard/` after
logging in) to see it appear.

## Getting real payment provider credentials
- **M-Pesa**: register at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) for sandbox Consumer Key/Secret and a test shortcode + passkey.
- **PayPal**: create a sandbox app at [developer.paypal.com](https://developer.paypal.com) for a Client ID/Secret.
- **Flutterwave**: sign up at [dashboard.flutterwave.com](https://dashboard.flutterwave.com) for a test Secret Key.

All three are free to set up in sandbox/test mode.
