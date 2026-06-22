import redisClient from '../config/redis.js';
import { emitToClinic, emitToDoctor, emitToUser } from '../config/pusher.js';
import Queue from '../models/Queue.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Emit queue updates via Socket.IO
 */
export const publishQueueUpdate = async (clinicId, data) => {
  emitToClinic(clinicId, 'queue_updated', data);
  // Also cache in Redis for persistence
  await redisClient.setex(`clinic:${clinicId}:last_update`, 300, JSON.stringify(data));
};

/**
 * Emit doctor status updates
 */
export const publishDoctorUpdate = async (clinicId, doctorId, data) => {
  emitToClinic(clinicId, 'doctor_status_changed', { doctorId, ...data });
  emitToDoctor(doctorId, 'status_changed', data);
};

/**
 * Emit patient notifications
 */
export const publishPatientUpdate = async (patientId, data) => {
  emitToUser(patientId, 'patient_update', data);
};

/**
 * Get estimated wait time (Pakistan peak hours aware)
 */
export const calculateWaitTime = async (clinicId) => {
  const [current, avgTimeResult] = await Promise.all([
    redisClient.get(`clinic:${clinicId}:current`),
    Queue.findAll({
      where: {
        clinicId: clinicId,
        status: 'served',
        servedAt: { [Op.ne]: null }
      },
      attributes: [
        [sequelize.fn('AVG', 
          sequelize.literal('EXTRACT(EPOCH FROM ("servedAt" - "createdAt")) * 1000')
        ), 'avgTime']
      ],
      raw: true
    })
  ]);

  // Adjust for Pakistan peak hours (12PM-3PM)
  const now = new Date();
  const isPeak = now.getHours() >= 12 && now.getHours() < 15;
  const baseTime = avgTimeResult[0]?.avgTime || 300000; // 5 mins default
  const adjustedTime = isPeak ? baseTime * 1.5 : baseTime;

  return {
    currentNumber: current || 0,
    avgWaitPerPatient: adjustedTime,
    isPeakHours: isPeak
  };
};

/**
 * Broadcast system-wide notifications
 */
export const broadcastNotification = async (type, data) => {
  const io = (await import('../config/pusher.js')).getIO();
  io.emit('system_notification', { type, ...data });
};

/**
 * Publish admin-specific updates
 */
export const publishAdminUpdate = async (type, data) => {
  const { emitToAdmin } = await import('../config/pusher.js');
  emitToAdmin('admin_update', { 
    type, 
    data, 
    timestamp: new Date() 
  });
};

/**
 * Get real-time system activity
 */
export const getSystemActivity = async () => {
  try {
    const activities = await redisClient.lRange('system:activity', 0, 49);
    return activities.map(activity => JSON.parse(activity));
  } catch (error) {
    console.log('Redis not available for activity retrieval');
    return [];
  }
};

/**
 * Log system activity
 */
export const logActivity = async (type, description, userId = null) => {
  const activity = {
    type,
    description,
    userId,
    timestamp: new Date()
  };
  
  try {
    await redisClient.lPush('system:activity', JSON.stringify(activity));
    await redisClient.lTrim('system:activity', 0, 99); // Keep last 100 activities
  } catch (error) {
    console.log('Redis activity logging failed, continuing without Redis');
  }
  
  // Broadcast to admins
  publishAdminUpdate('new_activity', activity);
};