const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'mkdy_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * We hand the token back both ways:
 *  - as an HttpOnly cookie, so the browser sends it automatically on every
 *    request and a login actually "sticks" across page loads (no JS storage
 *    involved at all, so nothing for a script on the page to steal)
 *  - in the JSON body too, for API clients that aren't a browser (Postman,
 *    a future mobile app, etc.)
 */
function attachAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
  });
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'fullName, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ fullName, email, passwordHash });

    const token = signToken(user);
    attachAuthCookie(res, token);
    return res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    attachAuthCookie(res, token);
    return res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  return res.json({ message: 'Logged out' });
}

// GET /api/auth/me  (requires auth)
async function me(req, res, next) {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, me, COOKIE_NAME };
