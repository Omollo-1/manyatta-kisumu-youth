const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/db');

class User extends Model {
  // Never leak the password hash in API responses.
  toSafeObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      role: this.role,
      membershipNumber: this.membershipNumber,
      membershipStatus: this.membershipStatus,
      membershipAssignedAt: this.membershipAssignedAt,
      createdAt: this.createdAt,
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue('email', value.toLowerCase().trim());
      },
    },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'member',
    },
    // Set by the Django service (via the internal API) once payment succeeds.
    membershipNumber: { type: DataTypes.STRING, allowNull: true, unique: true },
    membershipStatus: {
      type: DataTypes.STRING,
      defaultValue: 'pending_payment',
    },
    membershipAssignedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true, // adds createdAt / updatedAt
  }
);

module.exports = User;
