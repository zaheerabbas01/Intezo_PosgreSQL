import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PremiumPayment = sequelize.define('PremiumPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  paymentMethod: {
    type: DataTypes.ENUM('easypesa', 'jazzcash', 'nayapay', 'sadapay'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 100
  },
  paymentImage: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  reviewedAt: {
    type: DataTypes.DATE
  },
  reviewedBy: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  rejectionReason: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true,
  tableName: 'premium_payments',
  underscored: true
});

export default PremiumPayment;
