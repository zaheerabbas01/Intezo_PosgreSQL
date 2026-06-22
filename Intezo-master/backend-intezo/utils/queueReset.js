import Doctor from '../models/Doctor.js';
import Queue from '../models/Queue.js';
import Patient from '../models/Patient.js';
import redisClient from '../config/redis.js';
import { emitToClinic, emitToDoctor } from '../config/pusher.js';
import { Op } from 'sequelize';

/**
 * Reset all doctor queues for a specific clinic
 * This function ensures all Redis counters are properly reset to 0
 */
export const resetAllDoctorQueuesForClinic = async (clinicId) => {
  try {
    console.log(`🔄 Resetting all doctor queues for clinic: ${clinicId}`);
    
    // Get all doctors associated with this clinic
    const doctors = await Doctor.findAll({ 
      where: {
        clinics: {
          [Op.contains]: [{ clinic: clinicId }]
        }
      }
    });
    
    console.log(`Found ${doctors.length} active doctors in clinic ${clinicId}`);
    
    // Reset Redis counters for all doctors - CRITICAL FIX
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
      
      if (redisClient.isOpen) {
        await redisClient.set(redisKey, 0);
        console.log(`✅ Reset Redis counter for doctor ${doctor.name} (${doctor.id}): ${redisKey} = 0`);
      } else {
        console.warn(`⚠️ Redis not available, skipping reset for doctor ${doctor.id}`);
      }
    }
    
    // Cancel all waiting queues for this clinic
    const updateResult = await Queue.update(
      { 
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { 
        where: {
          clinicId: clinicId, 
          status: 'waiting'
        }
      }
    );
    
    console.log(`📋 Cancelled ${updateResult[0]} waiting queues`);

    // Clear patient queue references
    const cancelledQueues = await Queue.findAll({
      where: {
        clinicId: clinicId,
        status: 'cancelled',
        cancelledAt: { [Op.gte]: new Date(Date.now() - 60000) } // Last minute
      }
    });
    
    for (const queue of cancelledQueues) {
      if (queue.patientId) {
        const patient = await Patient.findByPk(queue.patientId);
        if (patient) {
          // Check if premium is active
          const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
          
          // Update patient - remove from active queues, add to history
          let queueHistory = patient.queueHistory || [];
          if (!queueHistory.includes(queue.id)) {
            queueHistory.push(queue.id);
          }
          
          let activeQueues = patient.activeQueues || [];
          activeQueues = activeQueues.filter(id => id !== queue.id);
          
          const updateData = {
            activeQueues,
            queueHistory
          };
          
          // Clear currentQueue appropriately based on premium status
          if (!isPremiumActive) {
            updateData.currentQueue = null;
          } else {
            if (patient.currentQueue && patient.currentQueue === queue.id) {
              updateData.currentQueue = null;
            } else if (activeQueues.length === 0) {
              updateData.currentQueue = null;
            }
          }
          
          await patient.update(updateData);
        }
      }
    }

    // Broadcast queue reset notifications
    try {
      emitToClinic(clinicId, 'all_queues_reset', {
        message: 'All doctor queues have been reset due to clinic closing',
        timestamp: new Date().toISOString(),
        resetCount: updateResult.modifiedCount,
        reason: 'clinic_closed'
      });
      
      // Emit to each doctor's channel
      for (const doctor of doctors) {
        emitToDoctor(doctor.id, 'queue_reset', {
          message: 'Your queue has been reset due to clinic closing',
          timestamp: new Date().toISOString(),
          reason: 'clinic_closed'
        });
      }
    } catch (socketError) {
      console.error('❌ Error broadcasting queue reset:', socketError);
    }
    
    console.log(`✅ Successfully reset all queues for clinic ${clinicId}`);
    return updateResult[0];
  } catch (err) {
    console.error('❌ Error in resetAllDoctorQueuesForClinic:', err);
    throw err;
  }
};

/**
 * Verify and fix Redis counters for all doctors in a clinic
 * This ensures Redis counters are properly set to 0 when clinic is closed
 */
export const verifyAndFixRedisCounters = async (clinicId) => {
  try {
    console.log(`🔍 Verifying Redis counters for clinic: ${clinicId}`);
    
    if (!redisClient.isOpen) {
      console.warn('⚠️ Redis not available, skipping verification');
      return;
    }
    
    // Get all doctors in this clinic
    const doctors = await Doctor.findAll({ 
      where: {
        clinics: {
          [Op.contains]: [{ clinic: clinicId }]
        }
      }
    });
    
    let fixedCount = 0;
    
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
      const currentValue = await redisClient.get(redisKey);
      
      // If Redis key doesn't exist or has a value > 0, reset it
      if (currentValue === null || parseInt(currentValue) > 0) {
        await redisClient.set(redisKey, 0);
        console.log(`🔧 Fixed Redis counter for doctor ${doctor.name}: ${redisKey} = 0 (was: ${currentValue})`);
        fixedCount++;
      }
    }
    
    console.log(`✅ Verified and fixed ${fixedCount} Redis counters for clinic ${clinicId}`);
    return fixedCount;
  } catch (err) {
    console.error('❌ Error verifying Redis counters:', err);
    throw err;
  }
};

/**
 * Daily reset function to ensure all counters start fresh each day
 */
export const performDailyReset = async () => {
  try {
    console.log('🌅 Starting daily queue reset...');
    
    const Clinic = (await import('../models/Clinic.js')).default;
    const clinics = await Clinic.findAll();
    
    let totalResetCount = 0;
    
    for (const clinic of clinics) {
      // Get all doctors in this clinic
      const doctors = await Doctor.findAll({ 
        where: {
          clinics: {
            [Op.contains]: [{ clinic: clinic.id }]
          }
        }
      });
      
      // Reset Redis counters for all doctors in this clinic
      for (const doctor of doctors) {
        const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
        if (redisClient.isOpen) {
          await redisClient.set(redisKey, 0);
          totalResetCount++;
        }
      }
      
      console.log(`🏥 Reset ${doctors.length} doctor counters for clinic ${clinic.name}`);
    }
    
    // Cancel any remaining waiting queues from previous day
    const yesterdayEnd = new Date();
    yesterdayEnd.setHours(0, 0, 0, 0);
    
    const oldWaitingQueues = await Queue.findAll({
      where: {
        status: 'waiting',
        bookedAt: { [Op.lt]: yesterdayEnd }
      }
    });
    
    if (oldWaitingQueues.length > 0) {
      await Queue.update(
        {
          status: 'cancelled',
          cancelledAt: new Date()
        },
        {
          where: {
            status: 'waiting',
            bookedAt: { [Op.lt]: yesterdayEnd }
          }
        }
      );
      
      // Clear patient references
      for (const queue of oldWaitingQueues) {
        if (queue.patientId) {
          const patient = await Patient.findByPk(queue.patientId);
          if (patient) {
            let queueHistory = patient.queueHistory || [];
            if (!queueHistory.includes(queue.id)) {
              queueHistory.push(queue.id);
            }
            await patient.update({ 
              currentQueue: null,
              queueHistory
            });
          }
        }
      }
      
      console.log(`📋 Cancelled ${oldWaitingQueues.length} old waiting queues`);
    }
    
    console.log(`✅ Daily reset completed: ${totalResetCount} counters reset, ${oldWaitingQueues.length} old queues cancelled`);
  } catch (err) {
    console.error('❌ Daily reset error:', err);
  }
};