import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcrypt';

const Patient = sequelize.define('Patient', {
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
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phoneVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  phoneVerifiedAt: {
    type: DataTypes.DATE
  },
  whatsappVerificationPhone: {
    type: DataTypes.STRING
  },
  whatsappVerificationTokenHash: {
    type: DataTypes.STRING(64)
  },
  whatsappVerificationExpiresAt: {
    type: DataTypes.DATE
  },
  whatsappVerificationRequestedAt: {
    type: DataTypes.DATE
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
  },
  fcmToken: {
    type: DataTypes.STRING
  },
  currentQueue: {
    type: DataTypes.UUID,
    references: {
      model: 'queues',
      key: 'id'
    }
  },
  activeQueues: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  },
  queueHistory: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  premiumExpiresAt: {
    type: DataTypes.DATE
  },
  clinicNotifications: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  },
  doctorNotifications: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  }
}, {
  timestamps: true,
  tableName: 'patients',
  underscored: true,
  hooks: {
    beforeSave: async (patient) => {
      if (patient.changed('verificationCode') && patient.verificationCode) {
        patient.verificationCode = await bcrypt.hash(patient.verificationCode, 10);
      }
    }
  }
});

Patient.prototype.compareVerificationCode = async function(code) {
  return bcrypt.compare(code, this.verificationCode);
};

Patient.prototype.addActiveQueue = function(queueId) {
  if (this.isPremium && this.premiumExpiresAt > new Date()) {
    if (!this.activeQueues.includes(queueId)) {
      this.activeQueues.push(queueId);
    }
  }
};

Patient.prototype.removeActiveQueue = function(queueId) {
  this.activeQueues = this.activeQueues.filter(id => id !== queueId);
  if (!this.queueHistory.includes(queueId)) {
    this.queueHistory.push(queueId);
  }
};

export default Patient;
