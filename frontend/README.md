# Frontend — Manyatta Kisumu Diocese Youths

Static HTML/CSS/JS site: home, about, team, gallery, testimonials, login,
a join/registration flow with a **real M-Pesa STK Push**, a custom 404, and
a downloadable constitution PDF.

## Structure
```
frontend/
├── index.html
├── about.html
├── team.html
├── gallery.html
├── testimonials.html
├── login.html
├── signup.html
├── 404.html
├── css/
│   └── style.css     # all styling + brand color variables (:root)
├── js/
│   └── main.js        # hamburger nav, gallery lightbox, real registration + M-Pesa payment wiring
├── images/
│   └── favicon.svg    # logo / favicon (swap in your own artwork anytime)
└── docs/
    └── constitution.pdf
```

Every page links to the shared stylesheet and script the same way:
```html
<link rel="icon" type="image/svg+xml" href="images/favicon.svg">
<link rel="stylesheet" href="css/style.css">
...
<script src="js/main.js"></script>
```
Because every HTML file lives at the same folder level, these relative
paths work identically from any page.

## Preview locally
```
cd frontend
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## Deploy
Any static host works as-is — GitHub Pages, Netlify, Vercel, or normal
hosting. Just upload the `frontend/` folder contents (no build step).

## Signup now calls the real backend
`signup.html` is wired to real APIs, not a browser-only demo:
1. **Your Details** → `POST {django}/api/registration/` creates a real registration record and returns the correct subscription fee for your category.
2. **Subscription Payment** → `POST {django}/api/payments/mpesa/stkpush/` sends a real M-Pesa STK Push to the phone number entered, via Django's Safaricom Daraja integration.
3. The page then polls `GET {django}/api/registration/<id>/` every few seconds. Once Django's M-Pesa callback confirms payment and Node has issued a membership number, the page shows it automatically.

The Django API base URL is set at the top of `js/main.js`:
```js
var DJANGO_API_BASE = 'https://manyatta-kisumu-youth.onrender.com';
```
Change this if you deploy the backend elsewhere.

**For an STK push to actually work**, `backend/django-service` needs real
Safaricom Daraja credentials in its `.env` (see its README) — without them,
the payment step shows a clear error instead of pretending to succeed.

**Testing in Safaricom's sandbox:** their sandbox environment only ever
delivers the prompt to Safaricom's own test number, `254708374149` — typing
in your personal number in sandbox mode will not trigger a real prompt on
your phone. To reach an arbitrary real phone, you need a production
("Go‑Live") shortcode from Safaricom.

**For the confirmation step (membership number appearing) to work locally**,
Safaricom needs to reach your Django server's callback URL over the public
internet — use a tool like [ngrok](https://ngrok.com) (`ngrok http 8001`)
and put that URL in `MPESA_CALLBACK_URL` in the Django `.env`.

## Login now calls the real backend too
`login.html` calls Node's real `/api/auth/login`, and stays signed in
across page loads via an HttpOnly session cookie (not `localStorage` —
see `node-service/README.md` for why). On load it also checks
`/api/auth/me`; if you're already signed in, it shows a "Welcome back"
state with a working Log Out button instead of the form.

`signup.html`'s first step now also creates the real login account (via
Node's `/api/auth/register`) before submitting the full membership form to
Django — so an account created at signup can immediately be used to log in.

The Node API base URL is set at the top of `js/main.js` alongside the
Django one:
```js
var NODE_API_BASE = 'https://manyatta-kisumu-youth-1.onrender.com';
```

## Payment methods
M-Pesa is currently the only payment method exposed on the site. The Django
backend still has working PayPal and Card (Flutterwave) integrations built
— they're just not surfaced in this UI. Re-adding them to `signup.html` is
straightforward if you want to offer them again later.

## Editing the design
Brand colors live at the top of `css/style.css` under `:root`
(`--blue`, `--pitch-orange`, `--orange`, `--jungle-green`) — change them
there to retune the whole site at once.
