import Queue from '../models/Queue.js';
import Clinic from '../models/Clinic.js';
import Patient from '../models/Patient.js';
import redisClient from '../config/redis.js';
import { Op } from 'sequelize';

/**
 * Calculate estimated wait time for patients in queue
 * @param {string} clinicId - Clinic ID
 * @param {string} doctorId - Doctor ID (optional)
 * @param {number} patientPosition - Patient's position in queue (optional)
 * @returns {Object} Wait time estimation data
 */
export const calculateEstimatedWaitTime = async (clinicId, doctorId = null, patientPosition = null) => {
  try {
    // Get clinic data for average processing time
    const clinic = await Clinic.findByPk(clinicId, {
      attributes: ['averageProcessTime']
    });
    if (!clinic) throw new Error('Clinic not found');

    const avgProcessTime = clinic.averageProcessTime || 15; // Default 15 minutes

    // Get current serving number from Redis
    const redisKey = doctorId ? `doctor:${doctorId}:clinic:${clinicId}:current` : `clinic:${clinicId}:current`;
    const currentNumber = parseInt(await redisClient.get(redisKey) || 0);

    // Get all waiting patients
    const where = {
      clinicId: clinicId,
      status: 'waiting',
      number: { [Op.gt]: currentNumber }
    };
    
    if (doctorId) {
      where.doctorId = doctorId;
    } else {
      where.doctorId = null;
    }
    
    const waitingPatients = await Queue.findAll({
      where,
      order: [['number', 'ASC']],
      attributes: ['number', 'bookedAt']
    });

    const totalWaiting = waitingPatients.length;

    // If specific patient position is provided, calculate their wait time
    if (patientPosition !== null) {
      // Count patients ahead of this patient in the waiting queue
      const patientsAhead = waitingPatients.filter(p => p.number < patientPosition).length;
      const estimatedWaitMinutes = patientsAhead * avgProcessTime;
      
      return {
        patientPosition,
        patientsAhead,
        estimatedWaitMinutes,
        estimatedWaitTime: formatWaitTime(estimatedWaitMinutes),
        currentlyServing: currentNumber,
        totalWaiting
      };
    }

    // Calculate general queue statistics
    const totalEstimatedTime = totalWaiting * avgProcessTime;
    
    return {
      currentlyServing: currentNumber,
      totalWaiting,
      avgProcessTimeMinutes: avgProcessTime,
      totalEstimatedTimeMinutes: totalEstimatedTime,
      totalEstimatedTime: formatWaitTime(totalEstimatedTime),
      nextPatientNumber: waitingPatients.length > 0 ? waitingPatients[0].number : null
    };

  } catch (error) {
    console.error('Error calculating wait time:', error);
    throw error;
  }
};

/**
 * Get wait time for a specific patient's queue booking
 * @param {string} queueId - Queue booking ID
 * @returns {Object} Patient-specific wait time data
 */
export const getPatientWaitTime = async (queueId) => {
  try {
    const queue = await Queue.findByPk(queueId, {
      attributes: ['clinicId', 'doctorId', 'number', 'status']
    });
    if (!queue || queue.status !== 'waiting') {
      throw new Error('Queue not found or not in waiting status');
    }

    return await calculateEstimatedWaitTime(queue.clinicId, queue.doctorId || null, queue.number);
  } catch (error) {
    console.error('Error getting patient wait time:', error);
    throw error;
  }
};

/**
 * Format wait time in minutes to human-readable format
 * @param {number} minutes - Wait time in minutes
 * @returns {string} Formatted wait time
 */
const formatWaitTime = (minutes) => {
  if (minutes < 1) return 'Less than 1 minute';
  if (minutes < 60) return `${Math.round(minutes)} minutes`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  
  if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`;
};

/**
 * Get real-time queue updates with wait times
 * @param {string} clinicId - Clinic ID
 * @param {string} doctorId - Doctor ID (optional)
 * @returns {Object} Complete queue data with wait times
 */
export const getQueueWithWaitTimes = async (clinicId, doctorId = null) => {
  try {
    const waitTimeData = await calculateEstimatedWaitTime(clinicId, doctorId);
    
    // Get detailed queue data
    const redisKey = doctorId ? `doctor:${doctorId}:clinic:${clinicId}:current` : `clinic:${clinicId}:current`;
    const currentNumber = parseInt(await redisClient.get(redisKey) || 0);
    
    const where = {
      clinicId: clinicId,
      status: 'waiting',
      number: { [Op.gt]: currentNumber }
    };
    
    if (doctorId) {
      where.doctorId = doctorId;
    } else {
      where.doctorId = null;
    }
    
    const upcomingPatients = await Queue.findAll({
      where,
      order: [['number', 'ASC']],
      limit: 10,
      include: [{
        model: Patient,
        as: 'patient',
        attributes: ['name', 'phone']
      }],
      raw: false
    });

    // Add individual wait times for each patient
    const patientsWithWaitTimes = upcomingPatients.map((patient, index) => ({
      ...patient.toJSON(),
      estimatedWaitMinutes: (index + 1) * waitTimeData.avgProcessTimeMinutes,
      estimatedWaitTime: formatWaitTime((index + 1) * waitTimeData.avgProcessTimeMinutes),
      positionInQueue: index + 1
    }));

    return {
      ...waitTimeData,
      upcomingPatients: patientsWithWaitTimes,
      hasNextPatient: upcomingPatients.length > 0
    };
  } catch (error) {
    console.error('Error getting queue with wait times:', error);
    throw error;
  }
};