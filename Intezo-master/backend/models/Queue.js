import { DataTypes, Op } from 'sequelize';
import sequelize from '../config/database.js';

const Queue = sequelize.define('Queue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
    references: {
      model: 'doctors',
      key: 'id'
    }
  },
  patientId: {
    type: DataTypes.UUID,
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  patientName: {
    type: DataTypes.STRING
  },
  manualEntry: {
    type: DataTypes.JSONB
  },
  number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('waiting', 'served', 'cancelled', 'missed', 'skipped'),
    defaultValue: 'waiting'
  },
  bookedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  servedAt: {
    type: DataTypes.DATE
  },
  missedAt: {
    type: DataTypes.DATE
  },
  cancelledAt: {
    type: DataTypes.DATE
  },
  skippedAt: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  tableName: 'queues',
  underscored: true,
  indexes: [
    { fields: ['clinic_id', 'doctor_id', 'status', 'number'] },
    { fields: ['clinic_id', 'doctor_id', 'booked_at'] },
    { fields: ['patient_id', 'status'] },
    { fields: ['status', 'booked_at'] },
    { fields: ['doctor_id', 'status', 'number'] }
  ]
});

Queue.getNextQueueNumber = async function(clinicId, doctorId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const lastQueue = await this.findOne({
    where: {
      clinicId,
      doctorId,
      bookedAt: { [Op.gte]: todayStart }
    },
    order: [['number', 'DESC']],
    attributes: ['number']
  });

  return lastQueue ? lastQueue.number + 1 : 1;
};

Queue.getWaitingQueues = async function(clinicId, doctorId, limit = 10) {
  return await this.findAll({
    where: {
      clinicId,
      doctorId,
      status: 'waiting'
    },
    order: [['number', 'ASC']],
    limit,
    attributes: ['number', 'patientName', 'patientId', 'manualEntry'],
    include: [{
      association: 'patient',
      attributes: ['name']
    }]
  });
};

export default Queue;
