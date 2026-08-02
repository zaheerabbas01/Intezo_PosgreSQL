import { DataTypes } from 'sequelize';

import sequelize from '../config/database.js';

const PatientAuthChallenge = sequelize.define('PatientAuthChallenge', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID
  },
  purpose: {
    type: DataTypes.ENUM('login', 'register', 'phone'),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(120)
  },
  phone: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  messageTokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  smsCodeHash: {
    type: DataTypes.STRING(64)
  },
  smsCodeCiphertext: {
    type: DataTypes.TEXT
  },
  pollTokenHash: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  verifiedAt: {
    type: DataTypes.DATE
  },
  consumedAt: {
    type: DataTypes.DATE
  },
  gatewayStatus: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'pending'
  },
  gatewayClaimedAt: {
    type: DataTypes.DATE
  },
  gatewaySentAt: {
    type: DataTypes.DATE
  },
  gatewayAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  gatewayLastError: {
    type: DataTypes.TEXT
  },
  verificationAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  timestamps: true,
  tableName: 'patient_auth_challenges',
  underscored: true
});

export default PatientAuthChallenge;
