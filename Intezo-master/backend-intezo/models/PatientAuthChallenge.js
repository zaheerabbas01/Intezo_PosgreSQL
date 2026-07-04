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
    type: DataTypes.ENUM('login', 'register'),
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
  }
}, {
  timestamps: true,
  tableName: 'patient_auth_challenges',
  underscored: true
});

export default PatientAuthChallenge;
