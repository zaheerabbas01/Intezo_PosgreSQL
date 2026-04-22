import Clinic from '../models/Clinic.js';
import Doctor from '../models/Doctor.js';
import redisClient from '../config/redis.js';
import { verifyAndFixRedisCounters } from '../utils/queueReset.js';
import { Op } from 'sequelize';

/**
 * Startup script to verify and fix Redis counters for all clinics
 * This ensures that when the server starts, all Redis counters are properly set
 */
export const performStartupQueueCheck = async () => {
  try {
    if (!redisClient.isOpen) {
      return;
    }
    
    const clinics = await Clinic.findAll({});
    let totalFixed = 0;
    
    for (const clinic of clinics) {
      try {
        const fixedCount = await verifyAndFixRedisCounters(clinic.id);
        totalFixed += fixedCount;
        
        if (!clinic.isOpen) {
          const doctors = await Doctor.findAll({ 
            where: {
              clinics: {
                [Op.contains]: [{ clinic: clinic.id }]
              }
            }
          });
          
          for (const doctor of doctors) {
            const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
            await redisClient.set(redisKey, 0);
          }
        }
        
      } catch (clinicError) {
        console.error(`❌ Error checking clinic ${clinic.name}:`, clinicError.message);
      }
    }
    
  } catch (err) {
    console.error('❌ Startup queue check failed:', err.message);
  }
};

/**
 * Initialize Redis counters for a new doctor-clinic association
 */
export const initializeDoctorRedisCounter = async (doctorId, clinicId) => {
  try {
    if (!redisClient.isOpen) {
      return;
    }
    
    const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
    const exists = await redisClient.exists(redisKey);
    
    if (!exists) {
      await redisClient.set(redisKey, 0);
    }
    
  } catch (err) {
    console.error('❌ Error initializing doctor Redis counter:', err.message);
  }
};

/**
 * Clean up Redis counters for removed doctor-clinic associations
 */
export const cleanupDoctorRedisCounter = async (doctorId, clinicId) => {
  try {
    if (!redisClient.isOpen) {
      return;
    }
    
    const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
    await redisClient.del(redisKey);
    
  } catch (err) {
    console.error('❌ Error cleaning up doctor Redis counter:', err.message);
  }
};