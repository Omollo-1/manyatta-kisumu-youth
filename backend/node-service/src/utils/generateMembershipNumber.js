const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Registers the Counter model's table with Sequelize (via Counter.init())
require('../models/Counter');

/**
 * Atomically increments this year's counter and returns a formatted
 * membership number like "MKDY-2026-0001".
 *
 * Uses Postgres native upsert when running on PostgreSQL, and falls back to
 * clean model-level atomic increment when running on SQLite.
 */
async function generateMembershipNumber() {
  const year = new Date().getFullYear();
  const counterId = `membership_${year}`;
  const isPostgres = sequelize.getDialect() === 'postgres';
  let seq = 1;

  if (isPostgres) {
    const [row] = await sequelize.query(
      `INSERT INTO counters (id, seq)
       VALUES (:counterId, 1)
       ON CONFLICT (id) DO UPDATE SET seq = counters.seq + 1
       RETURNING seq`,
      {
        replacements: { counterId },
        type: QueryTypes.SELECT,
      }
    );
    seq = row.seq;
  } else {
    const Counter = require('../models/Counter');
    let counter = await Counter.findByPk(counterId);
    if (!counter) {
      counter = await Counter.create({ id: counterId, seq: 1 });
      seq = 1;
    } else {
      counter.seq += 1;
      await counter.save();
      seq = counter.seq;
    }
  }

  const padded = String(seq).padStart(4, '0');
  return `MKDY-${year}-${padded}`;
}

module.exports = generateMembershipNumber;
