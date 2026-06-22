import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const Doctor = sequelize.define('Doctor', {
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
  profilePhoto: {
    type: DataTypes.STRING
  },
  specialties: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false
  },
  qualifications: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  clinics: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'doctor'
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
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  tableName: 'doctors',
  underscored: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['license_number'] }
  ],
  hooks: {
    beforeSave: async (doctor, options) => {
      // Skip hashing if explicitly told to (e.g., during migration)
      if (options.skipPasswordHash) {
        return;
      }
      if (doctor.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        doctor.password = await bcrypt.hash(doctor.password, salt);
      }
    }
  }
});

Doctor.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default Doctor;
