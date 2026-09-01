require('dotenv').config();
const app = require('./app');
const { sequelize, connectDB } = require('./config/db');

const PORT = process.env.PORT || 5001;

let server;

connectDB().then(() => {
  server = app.listen(PORT, () => {
    console.log(`[mkdy-auth-service] listening on http://localhost:${PORT}`);
    console.log(`[mkdy-auth-service] health check: http://localhost:${PORT}/api/health`);
  });
});

/**
 * Graceful shutdown: stop accepting new requests, finish in-flight ones,
 * then close the PostgreSQL connection pool cleanly. Useful in production
 * (e.g. when a process manager or container platform sends SIGTERM to
 * restart the service) and harmless in development (Ctrl+C).
 */
function shutdown(signal) {
  console.log(`\n[mkdy-auth-service] received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await sequelize.close();
      console.log('[mkdy-auth-service] closed HTTP server and PostgreSQL connection');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
