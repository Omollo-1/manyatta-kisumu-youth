/**
 * Protects internal, service-to-service routes so only the Django backend
 * (which knows the shared secret) can call them — e.g. assigning a
 * membership number right after it confirms a payment.
 *
 * Expects: x-internal-key: <INTERNAL_API_KEY>
 */
function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'];

  if (!process.env.INTERNAL_API_KEY) {
    return res.status(500).json({ error: 'INTERNAL_API_KEY is not configured on this server' });
  }

  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: invalid or missing internal key' });
  }

  next();
}

module.exports = requireInternalKey;
