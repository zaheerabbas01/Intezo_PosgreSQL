import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Report = sequelize.define('Report', {
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
  clinicId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'clinics',
      key: 'id'
    }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'doctors',
      key: 'id'
    }
  },
  reportType: {
    type: DataTypes.ENUM('medical', 'lab_test'),
    defaultValue: 'medical'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  symptoms: {
    type: DataTypes.TEXT
  },
  treatment: {
    type: DataTypes.TEXT
  },
  medications: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT
  },
  recommendations: {
    type: DataTypes.TEXT
  },
  labTests: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  followUpDate: {
    type: DataTypes.DATE
  },
  pdfUrl: {
    type: DataTypes.STRING
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  patientName: {
    type: DataTypes.STRING
  },
  visitDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  tableName: 'reports',
  underscored: true,
  indexes: [
    { fields: ['patient_id', 'created_at'] },
    { fields: ['clinic_id', 'created_at'] },
    { fields: ['doctor_id', 'created_at'] }
  ]
});

export default Report;
