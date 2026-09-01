const { Sequelize } = require('sequelize');
const path = require('path');

/**
 * A single shared Sequelize instance for the node-service.
 * Uses PostgreSQL if POSTGRES_HOST is specified, otherwise automatically
 * falls back to SQLite (`db.sqlite3`), providing zero-setup local execution
 * just like the Django service.
 */
let sequelize;

if (process.env.POSTGRES_HOST && process.env.POSTGRES_HOST.trim() !== '') {
  const postgresPassword = process.env.POSTGRES_PASSWORD !== undefined ? String(process.env.POSTGRES_PASSWORD) : '';
  sequelize = new Sequelize(
    process.env.POSTGRES_DB || 'mkdy_auth',
    process.env.POSTGRES_USER || 'postgres',
    postgresPassword,
    {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      dialect: 'postgres',
      logging: false,
    }
  );
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../db.sqlite3'),
    logging: false,
  });
}

/**
 * Connects and syncs models to tables.
 */
async function connectDB() {
  try {
    await sequelize.authenticate();
    const dbType = process.env.POSTGRES_HOST ? 'PostgreSQL' : 'SQLite';
    console.log(`[db] ${dbType} connected successfully.`);
    await sequelize.sync({ alter: true });
    console.log('[db] Tables synced successfully.');
  } catch (err) {
    console.error('[db] DB connection error:', err.message);
    // Fallback to SQLite in-memory if primary connection fails
    try {
      console.warn('[db] Switching to SQLite fallback instance...');
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../../db.sqlite3'),
        logging: false,
      });
      await sequelize.authenticate();
      await sequelize.sync({ alter: true });
      console.log('[db] SQLite fallback connected and tables synced.');
    } catch (fallbackErr) {
      console.error('[db] Critical DB initialization error:', fallbackErr.message);
    }
  }
}

module.exports = { sequelize, connectDB };
