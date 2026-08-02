import { DataTypes } from 'sequelize';

import sequelize from '../config/database.js';

const SmsGatewayDevice = sequelize.define('SmsGatewayDevice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  deviceId: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true
  },
  fcmToken: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  tableName: 'sms_gateway_devices',
  underscored: true
});

export default SmsGatewayDevice;
