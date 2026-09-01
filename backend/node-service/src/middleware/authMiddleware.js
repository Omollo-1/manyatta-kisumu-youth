const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'mkdy_token';

/**
 * Protects routes that require a logged-in user. Accepts the token from
 * either source, so both browser sessions (cookie, set automatically by
 * login/register) and non-browser API clients (Authorization header) work:
 *   - Cookie: mkdy_token=<jwt>          (how the frontend actually uses this)
 *   - Header: Authorization: Bearer <jwt>
 */
function requireAuth(req, res, next) {
  let token = req.cookies && req.cookies[COOKIE_NAME];

  if (!token) {
    const header = req.headers.authorization || '';
    const [scheme, headerToken] = header.split(' ');
    if (scheme === 'Bearer' && headerToken) token = headerToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = requireAuth;
