import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const Clinic = sequelize.define('Clinic', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  profilePhoto: {
    type: DataTypes.STRING
  },
  services: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['General Consultation']
  },
  operatingHours: {
    type: DataTypes.JSONB,
    defaultValue: {
      opening: '09:00',
      closing: '17:00'
    }
  },
  averageProcessTime: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  maxActiveQueues: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'clinic'
  },
  isOpen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastStatusChange: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationCode: {
    type: DataTypes.STRING
  },
  verificationCodeExpires: {
    type: DataTypes.BIGINT
  },
  customReportTemplates: {
    type: DataTypes.JSONB,
    defaultValue: {
      titles: [],
      symptoms: [],
      diagnoses: [],
      treatments: [],
      medications: [],
      recommendations: [],
      labTestTitles: ['Blood Test Report', 'Urine Test Report', 'X-Ray Report', 'CT Scan Report', 'MRI Report', 'ECG Report', 'Ultrasound Report'],
      labTestNames: ['Hemoglobin', 'Blood Sugar', 'Cholesterol', 'Blood Pressure', 'White Blood Cells', 'Red Blood Cells', 'Platelets', 'Creatinine', 'Urea', 'Liver Enzymes'],
      labTestSummaries: ['Normal results', 'Abnormal results - requires follow-up', 'Critical values detected', 'Inconclusive results', 'Test completed successfully']
    }
  }
}, {
  timestamps: true,
  tableName: 'clinics',
  underscored: true,
  hooks: {
    beforeSave: async (clinic, options) => {
      // Skip hashing if explicitly told to (e.g., during migration)
      if (options.skipPasswordHash) {
        return;
      }
      if (clinic.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        clinic.password = await bcrypt.hash(clinic.password, salt);
      }
    }
  }
});

Clinic.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default Clinic;
