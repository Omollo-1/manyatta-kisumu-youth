# Manyatta Kisumu Diocese Youths Project Documentation

## 1. Project Overview

This project is a membership and communications platform for the Manyatta Kisumu Diocese Youths (MKDY). It includes:

- a public website for information and registration
- a signup flow for new members
- a login and authentication service
- a membership registration workflow
- M-Pesa payment integration
- a dashboard for admin/review of registrations
- a separate internal membership-number assignment system

The project is divided into two separate backend services to keep responsibilities clean:

- Node service: authentication and membership number issuance
- Django service: registration data, payment processing, dashboard, and admin reporting

---

## 2. Architecture Summary

### Frontend
Location: `frontend/`

Purpose:
- public marketing pages
- member registration form
- login page
- static content for the church community

Main files:
- `frontend/index.html`
- `frontend/about.html`
- `frontend/team.html`
- `frontend/gallery.html`
- `frontend/testimonials.html`
- `frontend/signup.html`
- `frontend/login.html`
- `frontend/js/main.js`
- `frontend/css/style.css`

### Node Service
Location: `backend/node-service/`

Purpose:
- create user accounts
- validate login credentials
- issue membership numbers
- manage secure internal session handling

Tech stack:
- Node.js
- Express
- PostgreSQL
- Sequelize
- JWT / cookies

Main files:
- `backend/node-service/src/server.js`
- `backend/node-service/src/controllers/authController.js`
- `backend/node-service/src/models/User.js`
- `backend/node-service/src/routes/authRoutes.js`
- `backend/node-service/src/middleware/authMiddleware.js`

### Django Service
Location: `backend/django-service/`

Purpose:
- collect full registration details
- process M-Pesa STK Push
- handle payment callbacks
- manage the dashboard and admin reporting
- coordinate the handoff to the Node service for membership-number assignment

Tech stack:
- Python
- Django
- Django REST Framework
- PostgreSQL / SQLite fallback

Main files:
- `backend/django-service/manage.py`
- `backend/django-service/config/settings.py`
- `backend/django-service/config/urls.py`
- `backend/django-service/registration/views.py`
- `backend/django-service/payments/views.py`
- `backend/django-service/payments/services/mpesa.py`
- `backend/django-service/dashboard/views.py`

---

## 3. How the Signup Flow Works

The full signup flow is split into a few clear stages:

1. User fills in personal details on the frontend
2. Frontend validates the form and sends account creation to the Node service
3. Frontend sends full registration data to the Django service
4. Django saves the registration record and returns the subscription amount
5. Frontend sends an M-Pesa STK Push request to the Django payment endpoint
6. Django triggers Safaricom Daraja STK push
7. User enters PIN on phone
8. Safaricom calls back to the Django callback URL
9. Django marks the registration as active and triggers Node membership assignment
10. Node issues a membership number such as `MKDY-2026-0001`
11. Django stores the membership number and final registration status
12. The UI shows the confirmation page

This design keeps identity and payment responsibilities separate but linked through a shared internal API key.

---

## 4. Folder Structure

```text
manyatta-kisumu-youth/
├── README.md
├── frontend/
│   ├── 404.html
│   ├── about.html
│   ├── gallery.html
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── testimonials.html
│   ├── team.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
├── backend/
│   ├── README.md
│   ├── django-service/
│   │   ├── config/
│   │   ├── dashboard/
│   │   ├── payments/
│   │   ├── registration/
│   │   ├── templates/
│   │   ├── manage.py
│   │   ├── requirements.txt
│   │   └── db.sqlite3
│   └── node-service/
│       ├── src/
│       ├── package.json
│       ├── package-lock.json
│       └── db.sqlite3
```

---

## 5. Local Development Setup

### 5.1 Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- Git
- SQLite for local quick testing
- PostgreSQL recommended for production and stable local work

### 5.2 Start the frontend

```bash
cd frontend
python -m http.server 8000
```

Open:

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/signup.html`

### 5.3 Start the Node service

```bash
cd backend/node-service
npm install
npm start
```

Default local port:

- `http://127.0.0.1:5001`

### 5.4 Start the Django service

```bash
cd backend/django-service
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```

Default local port:

- `http://127.0.0.1:8001`

---

## 6. Environment Variables and Configuration

### Node service
The Node service uses environment variables via `.env` in `backend/node-service/`.

Typical variables include:

- `PORT=5001`
- `JWT_SECRET=...`
- `DATABASE_URL=...`
- `NODE_ENV=development`
- `INTERNAL_API_KEY=...`

### Django service
The Django service uses environment variables via `.env` in `backend/django-service/`.

Typical variables include:

- `SECRET_KEY=...`
- `DEBUG=True`
- `ALLOWED_HOSTS=127.0.0.1,localhost`
- `NODE_SERVICE_URL=http://127.0.0.1:5001`
- `INTERNAL_API_KEY=...`
- `MPESA_ENV=sandbox`
- `MPESA_CONSUMER_KEY=...`
- `MPESA_CONSUMER_SECRET=...`
- `MPESA_SHORTCODE=...`
- `MPESA_PASSKEY=...`
- `MPESA_CALLBACK_URL=http://127.0.0.1:8001/api/payments/mpesa/callback/`
- `CORS_ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000`

Important:
- both backend services must share the same `INTERNAL_API_KEY`
- production environment variables must never be committed to source control

---

## 7. Database Strategy

### Local development
- SQLite is used by default in local quick-start mode
- this is acceptable for testing only

### Recommended production setup
- PostgreSQL on a managed host such as Supabase, Neon, or a proper PostgreSQL service
- separate databases for:
  - Node auth service
  - Django application

Do not use SQLite in production for a real payment system.

---

## 8. M-Pesa Integration

This project uses Safaricom Daraja STK Push.

### Payment flow

1. User enters phone number and clicks “Send M-Pesa Prompt”
2. Frontend calls the Django STK endpoint
3. Django calls Safaricom Daraja with the phone number and amount
4. Safaricom sends a push prompt to the phone
5. User enters PIN
6. Safaricom posts a callback to the configured callback URL
7. Django validates and updates the registration status
8. Django calls the Node service to assign a membership number

### Callback URL
The callback must be public and HTTPS in production.

Example:

```text
https://your-domain.com/api/payments/mpesa/callback/
```

### Sandbox notes
Safaricom sandbox only delivers test prompts to official test numbers, such as:

- `254708374149`

This is important if you are testing with the sandbox environment.

---

## 9. Roles of Each Backend Service

### Node service responsibilities
- account creation
- login validation
- session/cookie management
- membership number generation
- membership assignment API

### Django service responsibilities
- member registration form
- payment processing
- M-Pesa callback handling
- dashboard data and reporting
- admin and committee views

This separation keeps the auth system independent from the membership/payment system.

---

## 10. API Notes

### Node service API examples

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/membership/assign`

### Django service API examples

- `POST /api/registration/`
- `GET /api/registration/<id>/`
- `POST /api/payments/mpesa/stkpush/`
- `POST /api/payments/mpesa/callback/`
- `GET /dashboard/`
- `GET /admin/`

The Django app also exposes internal endpoints for the Node service callback using the shared internal API key.

---

## 11. Security Considerations

Before production deployment, confirm the following:

- no secrets in source code
- use `.env` or a cloud secret manager
- set `DEBUG=False`
- configure `ALLOWED_HOSTS`
- restrict CORS to trusted origins
- protect internal endpoints with `INTERNAL_API_KEY`
- use HTTPS everywhere
- store production DB credentials securely
- do not expose payment secrets in frontend code

---

## 12. Production Deployment Recommendation

Best free or low-cost production deployment approach:

- Frontend: Cloudflare Pages or Vercel
- Django backend: Render
- Node backend: Render
- Database: Supabase or Neon Postgres

Why:
- frontend is static
- Django and Node need a server runtime
- SQLite is not recommended for production
- M-Pesa requires HTTPS and public callback access

---

## 13. Production M-Pesa Checklist

Before switching to live M-Pesa:

- deploy the app publicly on HTTPS
- configure production callback URL
- get live Safaricom credentials from the business channel
- set `MPESA_ENV=live` or production config
- configure `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, and `MPESA_PASSKEY`
- test with a small transaction safely
- confirm callback signature verification and handling
- ensure the registration and membership-number flow works in production mode

Important:
- local URLs such as `127.0.0.1` and `localhost` are not valid for live payment callbacks

---

## 14. Troubleshooting

### Frontend not progressing to payment
Likely causes:
- stale browser cache
- stale JS file caching
- incorrect script versioning
- page refresh restoring an old step state

Fix:
- add cache-busting query strings
- use no-cache headers where necessary
- ensure each step intentionally hides/shows panels

### Backend not reachable
Likely causes:
- service not running
- wrong port
- CORS blocked
- environment variables missing

Fix:
- verify `npm start` and `python manage.py runserver` are active
- confirm expected ports are used
- check browser network tab and server logs

### STK push not reaching phone
Likely causes:
- sandbox test number restriction
- wrong Safaricom credentials
- callback URL not public
- wrong environment settings

Fix:
- verify sandbox number rules
- confirm production vs sandbox env selection
- ensure callback URL is reachable over HTTPS

### Membership number not assigned
Likely causes:
- Node service down
- invalid internal API key
- Django callback failed before Node handoff

Fix:
- verify `INTERNAL_API_KEY` matches both services
- check Node service logs
- test the assignment API directly

---

## 15. Known Current Status

The current project is in a functional local-development state:

- frontend loads and signup flow can proceed through the wizard
- Node service can create accounts and assign membership numbers
- Django service handles registration and payment flow
- the M-Pesa STK flow is implemented and tested in sandbox-style conditions
- production deployment and live Safaricom configuration remain the next major step

---

## 16. Suggested Next Milestones

1. Move from SQLite to Postgres for local stability and production readiness
2. Deploy frontend to Cloudflare Pages or Vercel
3. Deploy Django and Node to Render
4. Configure production secrets and callback URLs
5. Test live payment flow in a safe production-style environment
6. Launch with production M-Pesa credentials
7. Add automated tests and monitoring

---

## 17. Useful Commands

### Frontend
```bash
cd frontend
python -m http.server 8000
```

### Node
```bash
cd backend/node-service
npm install
npm start
```

### Django
```bash
cd backend/django-service
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```

### Check ports
```bash
netstat -ano | findstr :8000 :8001 :5001
```

---

## 18. Final Notes

This project is a solid full-stack web application with a clear separation of concerns:

- frontend for public experience and registration
- Node for identity and membership numbering
- Django for member data and payment flows

The remaining work is mainly production hardening and live payment configuration, not basic app logic.

---

## 19. Quick Summary

This project is ready in principle for local development and for a hosted production rollout, as long as the following are completed:

- PostgreSQL in production
- HTTPS deployment
- live M-Pesa credentials
- public callback URLs
- secure environment management
- final smoke tests against the live hosted environment

