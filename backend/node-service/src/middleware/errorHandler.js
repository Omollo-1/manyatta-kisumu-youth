/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  if (err.name === 'SequelizeValidationError') {
    let message = err.errors && err.errors[0] ? err.errors[0].message : 'Validation failed';
    if (message.includes('isEmail')) {
      message = 'Please provide a valid email address (e.g. user@example.com).';
    }
    return res.status(400).json({ error: message });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'field';
    return res.status(409).json({ error: `An account with that ${field} already exists.` });
  }

  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError' || err.name === 'SequelizeHostNotFoundError') {
    return res.status(503).json({ error: 'Database is unavailable right now. Check your database configuration.' });
  }

  const status = err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
