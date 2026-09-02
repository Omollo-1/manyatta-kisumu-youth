# Production Deployment Guide

This guide explains how to deploy the Manyatta Kisumu Diocese Youths project to production using free and low-cost hosting.

## Recommended stack

- Frontend: Cloudflare Pages
- Django API: Render
- Node auth service: Render
- Database: Supabase or Neon Postgres
- Payment callback: HTTPS public domain

---

## 1. Prepare the codebase

Push the project to GitHub first:

```bash
git add .
git commit -m "Prepare project for deployment"
git push origin main
```

The repository is now available at:

https://github.com/Omollo-1/manyatta-kisumu-youth

---

## 2. Create production databases

Create two separate PostgreSQL databases:

- `mkdy_django`
- `mkdy_auth`

Recommended hosts:

- Supabase
- Neon
- Render Postgres

Keep these credentials safe. Do not commit them to Git.

---

## 3. Configure Django environment variables

Use the Django service environment variables in `backend/django-service/.env.example` as the template.

Example production values:

```env
SECRET_KEY=replace-with-long-random-secret
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

POSTGRES_HOST=your-postgres-host
POSTGRES_DB=mkdy_django
POSTGRES_USER=your-db-user
POSTGRES_PASSWORD=your-db-password
POSTGRES_PORT=5432

CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

NODE_SERVICE_URL=https://your-node-service.onrender.com
INTERNAL_API_KEY=must-match-node-service

MPESA_ENV=production
MPESA_CONSUMER_KEY=your-live-key
MPESA_CONSUMER_SECRET=your-live-secret
MPESA_SHORTCODE=your-live-shortcode
MPESA_PASSKEY=your-live-passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback/

PAYPAL_ENV=live
PAYPAL_CLIENT_ID=your-live-client-id
PAYPAL_CLIENT_SECRET=your-live-client-secret

CARD_PROVIDER=flutterwave
FLUTTERWAVE_PUBLIC_KEY=your-live-public-key
FLUTTERWAVE_SECRET_KEY=your-live-secret-key
```

### Important

- `DEBUG` must be `False` in production
- `ALLOWED_HOSTS` must include the public domain
- `MPESA_CALLBACK_URL` must be HTTPS and public

---

## 4. Configure Node environment variables

Use `backend/node-service/.env.example` as the template.

Example production values:

```env
PORT=10000
NODE_ENV=production

POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=mkdy_auth
POSTGRES_USER=your-db-user
POSTGRES_PASSWORD=your-db-password

JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=7d

INTERNAL_API_KEY=must-match-django-service
CLIENT_ORIGIN=https://yourdomain.com
```

### Important

- `CLIENT_ORIGIN` must be the exact frontend origin
- `INTERNAL_API_KEY` must be the same in both backend services

---

## 5. Deploy the Django app on Render

1. Go to Render
2. Click New > Web Service
3. Connect your GitHub repository
4. Select the repo and choose the root folder if needed
5. Set the environment to Python
6. Use build command:

```bash
pip install -r backend/django-service/requirements.txt
```

7. Use start command:

```bash
cd backend/django-service && python manage.py migrate && gunicorn config.wsgi:application
```

8. Add production environment variables
9. Set the service to public
10. Copy the generated HTTPS URL

### Notes

- If Render expects the app root to be the repo root, adjust the paths accordingly
- For production, set `gunicorn` in the dependencies if not already present

---

## 6. Deploy the Node app on Render

1. Go to Render
2. Click New > Web Service
3. Connect the same GitHub repository
4. Select the repo and point the app root to `backend/node-service`
5. Set the environment to Node
6. Use build command:

```bash
npm install
```

7. Use start command:

```bash
npm start
```

8. Add production environment variables
9. Set service to public
10. Copy the generated HTTPS URL

### Important

Render usually injects a port automatically through `process.env.PORT`, so the app should read that value in production.

---

## 7. Deploy the frontend to Cloudflare Pages

1. Sign in to Cloudflare Pages
2. Click Create project
3. Connect the GitHub repository
4. Set project root to the repo root or the `frontend` directory depending on how you structure the deploy
5. Use the static site deployment flow
6. Save and deploy

### Production frontend URL

Example:

```text
https://yourproject.pages.dev
```

### Frontend API values

Update the frontend JavaScript to use the deployed backend URLs instead of localhost.

Example:

```js
const DJANGO_API_BASE = 'https://your-django-service.onrender.com';
const NODE_API_BASE = 'https://your-node-service.onrender.com';
```

---

## 8. Update CORS and trusted origins

For the Django service, ensure `CORS_ALLOWED_ORIGINS` includes the frontend domain.

Example:

```env
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

For the Node service, set:

```env
CLIENT_ORIGIN=https://yourdomain.com
```

---

## 9. Configure public callback URL for M-Pesa

Safaricom callbacks must use HTTPS and a public URL.

Example:

```text
https://yourdomain.com/api/payments/mpesa/callback/
```

This URL must be reachable from Safaricom.

### Important

Do not use localhost or 127.0.0.1 in production.

---

## 10. Go live with M-Pesa

When the app is live and public, switch from sandbox to production by updating the environment variables:

```env
MPESA_ENV=production
```

Use your live Safaricom credentials:

- consumer key
- consumer secret
- shortcode
- passkey

Then test with a minimal real-world transaction using the approved process for your payer setup.

---

## 11. Final production checklist

Before launch, confirm the following:

- [ ] Frontend hosted on HTTPS public domain
- [ ] Django service deployed and healthy
- [ ] Node service deployed and healthy
- [ ] Two Postgres databases created and connected
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` configured
- [ ] CORS configured correctly
- [ ] `INTERNAL_API_KEY` matches both services
- [ ] All secrets stored in environment variables
- [ ] M-Pesa callback URL is public HTTPS
- [ ] production M-Pesa credentials configured
- [ ] live signup flow tested end-to-end

---

## 12. Recommended next step

After you have the hosting accounts ready, the next actions are:

1. Create the Postgres databases
2. Deploy Django to Render
3. Deploy Node to Render
4. Deploy the frontend to Cloudflare Pages
5. Test signup and payment flow live
6. Switch M-Pesa from sandbox to production

---

## 13. Best free setup summary

Best practical free/low-cost hosting path:

- Cloudflare Pages for the website
- Render for Django
- Render for Node
- Supabase or Neon Postgres

This is the best production direction for this project.
