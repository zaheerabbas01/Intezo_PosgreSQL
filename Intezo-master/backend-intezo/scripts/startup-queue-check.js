import Clinic from '../models/Clinic.js';
import Doctor from '../models/Doctor.js';
import redisClient from '../config/redis.js';
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
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    for (const clinic of clinics) {
      try {
        const { opening, closing } = clinic.operatingHours;
        const isWithinHours = currentTime >= opening && currentTime < closing;

        // Auto-open if within hours and not manually closed
        if (isWithinHours && !clinic.isOpen && !clinic.manuallyClosed) {
          clinic.isOpen = true;
          clinic.lastStatusChange = new Date();
          await clinic.save();
          console.log(`🔓 Startup: auto-opened clinic "${clinic.name}" (within operating hours)`);
        }

        // Auto-close if outside hours and still open
        if (!isWithinHours && clinic.isOpen) {
          const { resetAllDoctorQueuesForClinic } = await import('../utils/queueReset.js');
          await resetAllDoctorQueuesForClinic(clinic.id);
          clinic.isOpen = false;
          clinic.manuallyClosed = false;
          clinic.lastStatusChange = new Date();
          await clinic.save();
          console.log(`🔒 Startup: auto-closed clinic "${clinic.name}" (outside operating hours)`);
        }

        const doctors = await Doctor.findAll({
          where: { clinics: { [Op.contains]: [{ clinic: clinic.id }] } }
        });

        for (const doctor of doctors) {
          const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;

          if (!clinic.isOpen) {
            await redisClient.set(redisKey, 0);
          } else {
            const { Queue } = await import('../models/index.js');
            const waitingCount = await Queue.count({
              where: { clinicId: clinic.id, doctorId: doctor.id, status: 'waiting' }
            });
            const existing = await redisClient.get(redisKey);
            if (existing === null) {
              await redisClient.set(redisKey, waitingCount);
            }
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