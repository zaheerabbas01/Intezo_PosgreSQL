import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PendingUser = sequelize.define('PendingUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userData: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  userType: {
    type: DataTypes.ENUM('doctor', 'clinic', 'patient'),
    allowNull: false
  },
  verificationCode: {
    type: DataTypes.STRING
  },
  verificationCodeExpires: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('pending_verification', 'pending_approval', 'approved', 'rejected'),
    defaultValue: 'pending_verification'
  }
}, {
  timestamps: true,
  tableName: 'pending_users',
  underscored: true
});

export default PendingUser;
