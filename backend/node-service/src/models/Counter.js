const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * One row per year, e.g. { id: "membership_2026", seq: 42 }. The actual
 * atomic increment happens via a raw "INSERT ... ON CONFLICT ... RETURNING"
 * statement in utils/generateMembershipNumber.js — a single round-trip to
 * Postgres, so two people paying at the same second can never be handed the
 * same number.
 */
class Counter extends Model {}

Counter.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    seq: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Counter',
    tableName: 'counters',
    timestamps: false,
  }
);

module.exports = Counter;
