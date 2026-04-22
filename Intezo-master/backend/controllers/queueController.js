import Queue from '../models/Queue.js';
import Clinic from '../models/Clinic.js';
import Patient from '../models/Patient.js';
import redisClient from '../config/redis.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import { emitToClinic, emitToDoctor } from '../config/pusher.js';
import Doctor from '../models/Doctor.js';
import FCMService from '../services/fcmService.js';
import { calculateEstimatedWaitTime, getPatientWaitTime, getQueueWithWaitTimes } from '../utils/waitTimeCalculator.js';

// Helper function to validate UUID
const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && uuidRegex.test(id);
};

// Helper function to validate and sanitize numeric input
const validateNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) {
    return null;
  }
  return num;
};

// In queueController.js, update triggerQueueUpdate function
export const triggerQueueUpdate = async (clinicId, doctorId = null, data = null) => {
  try {
    // Get clinic status
    const clinic = await Clinic.findByPk(clinicId, {
      attributes: ['isOpen', 'operatingHours']
    });

    const queueData = data || await getQueueDataForBroadcast(clinicId, doctorId);

    // Add clinic status to broadcast data
    const broadcastData = {
      ...queueData,
      clinicStatus: {
        isOpen: clinic.isOpen,
        operatingHours: clinic.operatingHours
      }
    };

    // Always emit to clinic room with doctorId
    emitToClinic(clinicId, 'queue_updated', { ...broadcastData, doctorId });
    if (doctorId) {
      emitToDoctor(doctorId, 'queue_updated', { ...broadcastData, doctorId });
    }

    return broadcastData;
  } catch (err) {
    console.error('Pusher trigger error:', err);
    throw err;
  }
};

const getQueueDataForBroadcast = async (clinicId, doctorId = null) => {
  let currentNumber = 0;
  try {
    if (redisClient.isOpen) {
      const redisKey = doctorId ? `doctor:${doctorId}:clinic:${clinicId}:current` : `clinic:${clinicId}:current`;
      const val = await redisClient.get(redisKey);
      currentNumber = val ? parseInt(val) : 0;
    }
  } catch (redisError) {
    console.warn('Redis unavailable for broadcast data');
  }

  const [queueData, clinic] = await Promise.all([
    Queue.findAll({
      where: {
        clinicId: clinicId,
        doctorId: doctorId || null,
        status: 'waiting'
      },
      order: [['number', 'ASC']],
      limit: 10,
      attributes: ['number', 'patientName', 'patientId', 'manualEntry'],
      include: [{
        association: 'patient',
        attributes: ['name']
      }],
      raw: true
    }),
    Clinic.findByPk(clinicId, {
      attributes: ['averageProcessTime']
    })
  ]);

  const avgProcessTime = clinic?.averageProcessTime || 15;
  const upcoming = queueData.map(queue => ({
    ...queue,
    patient: {
      name: queue.patientName || queue.patient?.name || 'Unknown'
    },
    isManualEntry: !!queue.manualEntry
  }));

  return {
    currentNumber,
    upcoming,
    totalWaiting: upcoming.length,
    avgWaitTime: avgProcessTime,
    avgProcessTimeMinutes: avgProcessTime,
    hasNextPatient: upcoming.length > 0,
    isDoctorQueue: !!doctorId,
    timestamp: new Date().toISOString()
  };
};

// Calculate average wait time based on historical data
const calculateWaitTime = async (clinicId, doctorId = null) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (!clinic) throw new Error('Clinic not found');

  const redisKey = doctorId ? `doctor:${doctorId}:clinic:${clinicId}:current` : `clinic:${clinicId}:current`;
  const redisValue = await redisClient.get(redisKey);
  const currentNumber = redisValue ? parseInt(redisValue) : 0;

  const waitingCount = await Queue.count({
    where: {
      clinicId: clinicId,
      doctorId: doctorId || null,
      status: 'waiting',
      number: { [Op.gt]: currentNumber }
    }
  });

  return {
    avgWaitPerPatient: clinic.averageProcessTime * 60000, // Convert to milliseconds
    totalWaitTime: waitingCount * clinic.averageProcessTime,
    waitingCount
  };
};

const generateDoctorQueueNumber = async (clinicId, doctorId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Find the highest queue number for this doctor today
  const lastQueue = await Queue.findOne({
    where: {
      clinicId: clinicId,
      doctorId: doctorId,
      bookedAt: { [Op.gte]: todayStart }
    },
    order: [['number', 'DESC']],
    attributes: ['number']
  });

  return lastQueue ? lastQueue.number + 1 : 1;
};

// Replace the bookNumber function with doctor-specific logic
export const bookNumber = async (req, res) => {
  try {
    const { clinicId, patientId, doctorId, patientName } = req.body;
    console.log('Booking request:', { clinicId, patientId, doctorId, patientName });
    console.log('Request body keys:', Object.keys(req.body));

    // Validate all required IDs
    if (!doctorId || !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    if (!clinicId || !isValidUUID(clinicId)) {
      return res.status(400).json({ error: 'Valid Clinic ID is required' });
    }

    if (!patientId || !isValidUUID(patientId)) {
      return res.status(400).json({ error: 'Valid Patient ID is required' });
    }

    // Sanitize patient name if provided
    const sanitizedPatientName = patientName ? patientName.trim().substring(0, 100) : null;

    // Validate doctor and clinic association
    const doctor = await Doctor.findByPk(doctorId);
    console.log('Found doctor:', doctor ? { name: doctor.name, clinics: doctor.clinics } : 'null');
    
    if (!doctor) {
      return res.status(400).json({ error: 'Doctor not found' });
    }

    // Check if doctor is associated with this clinic and is active
    const clinicAssociation = doctor.clinics.find(c => c.clinic.toString() === clinicId.toString());
    console.log('Clinic association:', clinicAssociation);
    
    if (!clinicAssociation) {
      return res.status(400).json({ error: 'Doctor is not associated with this clinic' });
    }

    console.log('Doctor availability check:', {
      isActive: clinicAssociation.isActive,
      isAvailable: clinicAssociation.isAvailable
    });

    if (!clinicAssociation.isActive) {
      return res.status(400).json({ error: 'Doctor is not active in this clinic' });
    }

    if (clinicAssociation.isAvailable === false) {
      return res.status(400).json({ error: 'Selected doctor is not available, choose another' });
    }

    // Check if clinic is open
    const clinic = await Clinic.findByPk(clinicId);
    if (!clinic || !clinic.isOpen) {
      return res.status(400).json({ error: 'Clinic is currently closed' });
    }

    // Get patient and validate
    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Check if patient has active waiting queues
    const activeQueues = await Queue.findAll({
      where: {
        patientId: patientId,
        status: 'waiting'
      },
      include: [{
        association: 'doctor',
        attributes: ['id', 'name']
      }]
    });

    const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
    console.log('Premium status check:', { isPremium: patient.isPremium, premiumExpiresAt: patient.premiumExpiresAt, isPremiumActive });
    console.log('Active queues found:', activeQueues.length);

    // For non-premium users, only allow one active booking
    if (activeQueues.length > 0 && !isPremiumActive) {
      return res.status(400).json({ error: 'You have an active booking. Premium users can book multiple queues.' });
    }

    // For premium users, always require patient name
    if (isPremiumActive) {
      if (!sanitizedPatientName) {
        return res.status(400).json({ 
          error: 'PATIENT_NAME_REQUIRED',
          message: 'Premium users must provide patient name for all bookings.' 
        });
      }
      
      if (sanitizedPatientName.length < 2) {
        return res.status(400).json({ 
          error: 'Patient name must be at least 2 characters long' 
        });
      }
    }

    // Generate doctor-specific queue number
    const nextNumber = await Queue.getNextQueueNumber(clinicId, doctorId);

    // Create queue entry
    const queue = await Queue.create({
      clinicId: clinicId,
      doctorId: doctorId,
      patientId: patientId,
      patientName: sanitizedPatientName, // Store custom patient name for premium users
      number: nextNumber,
      status: 'waiting',
      bookedAt: new Date()
    });

    // Update patient's queue references
    if (isPremiumActive) {
      // For premium users, add to activeQueues array
      const activeQueuesArr = patient.activeQueues || [];
      if (!activeQueuesArr.includes(queue.id)) {
        activeQueuesArr.push(queue.id);
      }
      const updateData = { activeQueues: activeQueuesArr };
      if (!patient.currentQueue) {
        updateData.currentQueue = queue.id;
      }
      await patient.update(updateData);
    } else {
      // For non-premium users, use currentQueue as before
      const activeQueuesArr = patient.activeQueues || [];
      if (!activeQueuesArr.includes(queue.id)) {
        activeQueuesArr.push(queue.id);
      }
      await patient.update({
        currentQueue: queue.id,
        activeQueues: activeQueuesArr
      });
    }

    // Initialize Redis counter for doctor-clinic combination if not exists
    const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
    if (!(await redisClient.get(redisKey))) {
      await redisClient.set(redisKey, 0);
    }

    // Calculate detailed wait time using the new utility
    const waitTimeData = await calculateEstimatedWaitTime(clinicId, doctorId, nextNumber);

    // Broadcast update with enhanced wait time data
    const enhancedQueueData = await getQueueDataForBroadcast(clinicId, doctorId);
    await triggerQueueUpdate(clinicId, doctorId, enhancedQueueData);
    
    // Also emit a specific wait time update event for new booking
    const { emitToClinic, emitToDoctor } = await import('../config/pusher.js');
    const waitTimeUpdateData = {
      currentNumber: enhancedQueueData.currentNumber,
      avgProcessTimeMinutes: waitTimeData.avgProcessTimeMinutes || clinic.averageProcessTime || 15,
      newBooking: true,
      timestamp: new Date().toISOString()
    };
    
    emitToDoctor(doctorId, 'wait_time_updated', waitTimeUpdateData);
    emitToClinic(clinicId, 'wait_time_updated', waitTimeUpdateData);

    res.status(201).json({
      queueNumber: nextNumber,
      estimatedWait: waitTimeData.estimatedWaitMinutes,
      estimatedWaitTime: waitTimeData.estimatedWaitTime,
      patientsAhead: waitTimeData.patientsAhead,
      currentlyServing: waitTimeData.currentlyServing,
      doctor: { name: doctor.name, specialty: doctor.specialty },
      patientName: sanitizedPatientName || patient.name
    });

  } catch (err) {
    console.error('Error in bookNumber:', err);
    res.status(500).json({ error: err.message });
  }
};

// Add this function to handle doctor status toggling
export const toggleDoctorStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { isAvailable } = req.body;

    // Validate doctor ID
    if (!doctorId || !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    // Validate isAvailable is boolean
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean' });
    }

    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await doctor.update({
      isAvailable,
      lastStatusChange: new Date()
    });

    // If doctor is being made unavailable, handle their current queue
    if (!isAvailable) {
      // Reset doctor's queue
      await redisClient.set(`doctor:${doctorId}:current`, 0);

      // Cancel all waiting patients for this doctor
      await Queue.update(
        {
          status: 'cancelled',
          cancelledAt: new Date()
        },
        {
          where: {
            doctorId: doctorId,
            status: 'waiting'
          }
        }
      );

      // Clear patient currentQueue references
      const cancelledQueues = await Queue.findAll({
        where: {
          doctorId: doctorId,
          status: 'cancelled'
        },
        attributes: ['patientId', 'id']
      });

      for (const queue of cancelledQueues) {
        if (queue.patientId) {
          const patient = await Patient.findByPk(queue.patientId);
          if (patient) {
            const queueHistoryArr = patient.queueHistory || [];
            if (!queueHistoryArr.includes(queue.id)) {
              queueHistoryArr.push(queue.id);
            }
            await patient.update({
              currentQueue: null,
              queueHistory: queueHistoryArr
            });
          }
        }
      }

      // Trigger queue update
      await triggerQueueUpdate(doctor.clinicId, doctorId);
    }

    res.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        isAvailable: doctor.isAvailable,
        lastStatusChange: doctor.lastStatusChange
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper function to find the next available patient number
const findNextAvailableNumber = async (clinicId, currentNumber) => {
  const nextPatient = await Queue.findOne({
    where: {
      clinicId: clinicId,
      number: { [Op.gt]: currentNumber },
      status: 'waiting'
    },
    order: [['number', 'ASC']],
    attributes: ['number']
  });

  return nextPatient ? nextPatient.number : null;
};

// In queueController.js - Optimized version
export const updateCurrentNumber = async (req, res) => {
  try {
    const { doctorId, action, clinicId } = req.body;
    console.log('updateCurrentNumber request:', req.body);
    console.log('Request headers:', req.headers);
    console.log('Auth clinic:', req.clinic);

    // Validate doctor ID
    if (!doctorId || !isValidUUID(doctorId)) {
      console.log('Invalid doctorId provided');
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    // Validate action
    if (!action || !['next', 'specific'].includes(action)) {
      return res.status(400).json({ error: 'Valid action is required (next or specific)' });
    }

    // Validate newNumber if action is specific
    if (action === 'specific') {
      const validatedNumber = validateNumber(req.body.newNumber, 1, 9999);
      if (validatedNumber === null) {
        return res.status(400).json({ error: 'Valid queue number is required (1-9999)' });
      }
      req.body.newNumber = validatedNumber;
    }

    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Use authenticated clinic ID
    const targetClinicId = req.clinic._id;
    console.log('Using authenticated clinic ID:', targetClinicId);
    
    const redisKey = `doctor:${doctorId}:clinic:${targetClinicId}:current`;
    const currentServing = parseInt(await redisClient.get(redisKey) || 0);

    let newNumber;

    if (action === 'next') {
      const nextPatient = await Queue.findOne({
        where: {
          clinicId: targetClinicId,
          doctorId: doctorId,
          number: { [Op.gt]: currentServing },
          status: 'waiting'
        },
        order: [['number', 'ASC']],
        attributes: ['number']
      });

      if (!nextPatient) {
        return res.status(400).json({
          error: 'No more patients to serve',
          currentNumber: currentServing
        });
      }

      // Serve the next available patient directly (e.g., jump from 1 to 4)
      newNumber = nextPatient.number;
      await redisClient.set(redisKey, newNumber);
      
      console.log(`Serving patient ${newNumber} (skipped from ${currentServing})`);
    } else if (action === 'specific' && req.body.newNumber) {
      newNumber = parseInt(req.body.newNumber);
      await redisClient.set(redisKey, newNumber);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Mark only the current patient as served (not the skipped ones)
    const servedQueue = await Queue.findOne({
      where: {
        clinicId: targetClinicId,
        doctorId: doctorId,
        number: newNumber,
        status: 'waiting'
      }
    });

    if (servedQueue) {
      await servedQueue.update({
        status: 'served',
        servedAt: new Date()
      });

      // Reload with patient data
      await servedQueue.reload({
        include: [{ association: 'patient', attributes: ['id', 'name', 'isPremium', 'premiumExpiresAt', 'activeQueues', 'currentQueue'] }]
      });
    }

    if (servedQueue?.patient) {
      const patient = await Patient.findByPk(servedQueue.patient.id);
      const updateQuery = {};
      
      // Always clear currentQueue and activeQueues when a booking is served
      // This ensures the patient can book again immediately
      const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
      
      const activeQueuesArr = patient.activeQueues || [];
      const filteredActiveQueues = activeQueuesArr.filter(qid => qid !== servedQueue.id);
      updateQuery.activeQueues = filteredActiveQueues;
      
      const queueHistoryArr = patient.queueHistory || [];
      if (!queueHistoryArr.includes(servedQueue.id)) {
        queueHistoryArr.push(servedQueue.id);
      }
      updateQuery.queueHistory = queueHistoryArr;
      
      if (!isPremiumActive) {
        // Free user - always clear currentQueue when any booking is served
        updateQuery.currentQueue = null;
      } else {
        // Premium user - clear currentQueue if this was the currentQueue
        // OR if they have no other active queues after removing this one
        if (patient.currentQueue && patient.currentQueue.toString() === servedQueue.id.toString()) {
          updateQuery.currentQueue = null;
        } else if (filteredActiveQueues.length === 0) {
          // This is their last active queue, clear currentQueue
          updateQuery.currentQueue = null;
        }
      }
      
      await patient.update(updateQuery);
      
      // Get clinic info for notification
      const clinic = await Clinic.findByPk(targetClinicId, { attributes: ['name'] });
      
      console.log(`🎯 Attempting to send notification to served patient: ${servedQueue.patient.id} for queue ${servedQueue.id}`);
      
      // Send thank you notification to served patient (only once per queue)
      // Skip notification for manual entries without patient accounts
      if (servedQueue.patient) {
        await FCMService.sendPatientServedNotification(
          servedQueue.patient._id,
          clinic?.name || 'Clinic',
          doctor.name,
          servedQueue._id
        );
      }
      
      // Emit patient-served event to both doctor and patient
      const { getIO } = await import('../config/pusher.js');
      const io = getIO();
      if (io) {
        io.to(`doctor_${doctorId}`).emit('patient-served', {
          patientId: servedQueue.patient?._id || null,
          queueId: servedQueue._id,
          isManualEntry: !servedQueue.patient
        });
        
        // Only emit to patient's room if it's not a manual entry
        if (servedQueue.patient) {
          io.to(`patient_${servedQueue.patient._id}`).emit('patient-served', {
            patientId: servedQueue.patient._id,
            queueId: servedQueue._id
          });
          
          // Emit patient profile update to force refresh
          io.to(`patient_${servedQueue.patient._id}`).emit('profile_updated', {
            patientId: servedQueue.patient._id,
            message: 'Your booking has been completed'
          });
        }
      }
    } else {
      console.log(`⚠️ No served queue found or patient missing for queue number ${newNumber}`);
    }

    // Update doctor's served count
    const docToUpdate = await Doctor.findByPk(doctorId);
    if (docToUpdate) {
      const clinics = docToUpdate.clinics || [];
      const clinicIndex = clinics.findIndex(c => c.clinic === targetClinicId || c.clinic.toString() === targetClinicId.toString());
      if (clinicIndex !== -1) {
        clinics[clinicIndex].patientsServed = (clinics[clinicIndex].patientsServed || 0) + 1;
        await docToUpdate.update({ clinics });
      }
    }

    // Get upcoming patients
    const upcoming = await Queue.findAll({
      where: {
        clinicId: targetClinicId,
        doctorId: doctorId,
        number: { [Op.gt]: newNumber },
        status: 'waiting'
      },
      order: [['number', 'ASC']],
      limit: 5,
      include: [{ association: 'patient', attributes: ['name', 'phone'] }]
    });

    // Calculate wait time
    const waitingCount = await Queue.count({
      where: {
        clinicId: targetClinicId,
        doctorId: doctorId,
        status: 'waiting',
        number: { [Op.gt]: newNumber }
      }
    });

    const clinicForWaitTime = await Clinic.findByPk(targetClinicId, { attributes: ['averageProcessTime', 'name'] });
    const avgWaitTime = clinicForWaitTime?.averageProcessTime || 15;
    const totalWaitTime = waitingCount * avgWaitTime;

    // Broadcast update
    const enhancedQueueData = await getQueueDataForBroadcast(targetClinicId, doctorId);
    await triggerQueueUpdate(targetClinicId, doctorId, enhancedQueueData);
    
    // Also emit a specific wait time update event
    const { emitToClinic, emitToDoctor } = await import('../config/pusher.js');
    const waitTimeUpdateData = {
      currentNumber: newNumber,
      avgProcessTimeMinutes: avgWaitTime,
      timestamp: new Date().toISOString()
    };
    
    if (doctorId) {
      emitToDoctor(doctorId, 'wait_time_updated', waitTimeUpdateData);
    }
    emitToClinic(targetClinicId, 'wait_time_updated', waitTimeUpdateData);
    
    // Send FCM notifications to patients who are next (within 3 positions)
    // Only notify patients who are 1-3 positions away from being served
    const patientsToNotify = upcoming.filter(patient => 
      patient.number <= newNumber + 3 && patient.number > newNumber
    ).slice(0, 3); // Limit to 3 patients max
    
    // Use Promise-based approach instead of setTimeout to prevent resource leaks
    const notificationPromises = patientsToNotify.map((upcomingPatient, index) => {
      // Only send notifications to patients with accounts (not manual entries)
      if (upcomingPatient.patient && upcomingPatient.patient._id) {
        // Add delay between notifications to prevent overwhelming FCM
        return new Promise((resolve) => {
          setTimeout(async () => {
            try {
              await FCMService.sendQueueNotification(
                upcomingPatient.patient._id,
                newNumber,
                upcomingPatient.number,
                clinicForWaitTime?.name || 'Clinic',
                doctor.name
              );
            } catch (error) {
              console.error('Error sending notification:', error);
            }
            resolve();
          }, index * 1000); // 1 second delay between each
        });
      }
      return Promise.resolve();
    });
    
    // Don't wait for notifications to complete
    Promise.all(notificationPromises).catch(err => 
      console.error('Error sending notifications:', err)
    );

    res.json({
      success: true,
      currentNumber: newNumber,
      upcoming,
      waitTime: totalWaitTime,
      hasNextPatient: upcoming.length > 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper function to process served patients asynchronously
async function processServedPatients(clinicId, doctorId, newNumber) {
  try {
    const servedQuery = {
      where: {
        clinicId: clinicId,
        number: { [Op.lte]: newNumber },
        status: 'waiting'
      }
    };
    
    if (doctorId) {
      servedQuery.where.doctorId = doctorId;
    }

    // Get count of patients being served
    const servedCount = await Queue.count(servedQuery);
    console.log(`Serving ${servedCount} patients for doctor ${doctorId}`);

    // Update served patients
    await Queue.update(
      {
        status: 'served',
        servedAt: new Date()
      },
      servedQuery
    );

    // Update patient records
    const servedQueues = await Queue.findAll({
      ...servedQuery,
      include: [{ association: 'patient', attributes: ['id', 'isPremium', 'premiumExpiresAt', 'activeQueues', 'currentQueue', 'queueHistory'] }]
    });

    for (const queue of servedQueues) {
      if (queue.patient) {
        const patient = await Patient.findByPk(queue.patient.id);
        const updateQuery = {};
        
        // Always clear currentQueue and activeQueues when a booking is served
        // This ensures the patient can book again immediately
        const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
        
        const activeQueuesArr = patient.activeQueues || [];
        const filteredActiveQueues = activeQueuesArr.filter(qid => qid !== queue.id);
        updateQuery.activeQueues = filteredActiveQueues;
        
        const queueHistoryArr = patient.queueHistory || [];
        if (!queueHistoryArr.includes(queue.id)) {
          queueHistoryArr.push(queue.id);
        }
        updateQuery.queueHistory = queueHistoryArr;
        
        if (!isPremiumActive) {
          // Free user - always clear currentQueue when any booking is served
          updateQuery.currentQueue = null;
        } else {
          // Premium user - clear currentQueue if this was the currentQueue
          // OR if they have no other active queues after removing this one
          if (patient.currentQueue && patient.currentQueue.toString() === queue.id.toString()) {
            updateQuery.currentQueue = null;
          } else if (filteredActiveQueues.length === 0) {
            // This is their last active queue, clear currentQueue
            updateQuery.currentQueue = null;
          }
        }
        
        await patient.update(updateQuery);
      }
    }

    // Update doctor's patientsServed count for this clinic
    if (doctorId && servedCount > 0) {
      const doctor = await Doctor.findByPk(doctorId);
      if (doctor) {
        const clinics = doctor.clinics || [];
        const clinicIndex = clinics.findIndex(c => c.clinic === clinicId || c.clinic.toString() === clinicId.toString());
        if (clinicIndex !== -1) {
          clinics[clinicIndex].patientsServed = (clinics[clinicIndex].patientsServed || 0) + servedCount;
          await doctor.update({ clinics });
        }
      }
      console.log(`Updated doctor ${doctorId} served count by ${servedCount}`);
    }

  } catch (error) {
    console.error('Error processing served patients:', error);
  }
}


// controllers/queueController.js - Update getQueueDataForPublic
export const getQueueDataForPublic = async (clinicId, doctorId = null) => {
  try {
    if (!doctorId) {
      throw new Error('Doctor ID is required');
    }

    let current = 0;
    try {
      if (redisClient.isOpen) {
        const redisValue = await redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`);
        current = parseInt(redisValue || '0');
      }
    } catch (redisError) {
      console.warn('Redis unavailable, using current = 0');
    }

    const [queueData, clinic] = await Promise.all([
      Queue.findAll({
        where: {
          clinicId: clinicId,
          doctorId: doctorId,
          status: 'waiting'
        },
        order: [['number', 'ASC']],
        attributes: ['number', 'patientName', 'id'],
        include: [{ association: 'patient', attributes: ['name'] }]
      }),
      Clinic.findByPk(clinicId, { attributes: ['averageProcessTime'] })
    ]);

    const avgWaitTime = clinic?.averageProcessTime || 15;
    const upcoming = queueData
      .filter(q => q.number > current)
      .map(queue => ({
        id: queue.id,
        number: queue.number,
        patient: {
          name: queue.patientName || queue.patient?.name || 'Unknown'
        }
      }));

    return {
      current,
      upcoming,
      avgWaitTime,
      totalWaiting: upcoming.length,
      canCallNext: upcoming.length > 0,
      isDoctorQueue: true
    };
  } catch (err) {
    console.error('Error in getQueueDataForPublic:', err);
    throw err;
  }
};

// Update getCurrentQueue to handle doctor-specific queues
export const getCurrentQueue = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;

    if (!clinicId || !isValidUUID(clinicId)) {
      return res.status(400).json({ error: 'Valid Clinic ID is required' });
    }

    if (!doctorId || !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    const queueData = await getQueueDataForPublic(clinicId, doctorId);
    res.json(queueData);
  } catch (err) {
    console.error('Queue error:', err);
    res.status(500).json({
      error: 'Failed to load queue',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  }
};


// Cancel a queue number
// Update cancelNumber function to handle doctor-specific queues
export const cancelNumber = async (req, res) => {
  try {
    const { queueId } = req.params;
    const patientId = req.user.id;

    // Validate queue ID
    if (!queueId || !isValidUUID(queueId)) {
      return res.status(400).json({ error: 'Valid Queue ID is required' });
    }

    // Validate patient ID
    if (!patientId || !isValidUUID(patientId)) {
      return res.status(400).json({ error: 'Valid Patient ID is required' });
    }

    const queue = await Queue.findOne({
      where: {
        id: queueId,
        patientId: patientId,
        status: 'waiting'
      }
    });

    if (!queue) {
      return res.status(404).json({
        error: 'Queue not found or already processed'
      });
    }

    await queue.update({
      status: 'cancelled',
      cancelledAt: new Date()
    });

    // Reload with clinic
    await queue.reload({
      include: [{ association: 'clinic', attributes: ['id', 'name', 'averageProcessTime'] }]
    });

    // Update patient record - handle both currentQueue and activeQueues
    const patient = await Patient.findByPk(patientId);
    const updateQuery = {};
    
    const activeQueuesArr = patient.activeQueues || [];
    const filteredActiveQueues = activeQueuesArr.filter(qid => qid !== queue.id);
    updateQuery.activeQueues = filteredActiveQueues;
    
    const queueHistoryArr = patient.queueHistory || [];
    if (!queueHistoryArr.includes(queue.id)) {
      queueHistoryArr.push(queue.id);
    }
    updateQuery.queueHistory = queueHistoryArr;
    
    // Always clear currentQueue and activeQueues when a booking is cancelled
    // This ensures the patient can book again immediately
    const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
    
    if (!isPremiumActive) {
      // Free user - always clear currentQueue when cancelling any booking
      updateQuery.currentQueue = null;
    } else {
      // Premium user - clear currentQueue if this was the currentQueue
      // OR if they have no other active queues after removing this one
      if (patient.currentQueue && patient.currentQueue.toString() === queue.id.toString()) {
        updateQuery.currentQueue = null;
      } else if (filteredActiveQueues.length === 0) {
        // This is their last active queue, clear currentQueue
        updateQuery.currentQueue = null;
      }
    }
    
    await patient.update(updateQuery);

    // Determine the appropriate Redis key
    const redisKey = queue.doctorId ? `doctor:${queue.doctorId}:clinic:${queue.clinicId}:current` : `clinic:${queue.clinicId}:current`;

    // Get updated queue data
    const [currentNumber, queueData] = await Promise.all([
      redisClient.get(redisKey).then(val => val ? parseInt(val) : 0),
      Queue.findAll({
        where: {
          clinicId: queue.clinicId,
          status: 'waiting'
        },
        order: [['number', 'ASC']],
        limit: 10,
        include: [{ association: 'patient', attributes: ['name', 'phone'] }]
      })
    ]);

    if (queue.doctorId) {
      queueData = queueData.filter(q => q.doctorId === queue.doctorId);
    }

    const waitTime = await calculateWaitTime(queue.clinicId, queue.doctorId || null);

    // Get clinic for average process time
    const clinic = queue.clinic || await Clinic.findByPk(queue.clinicId, { attributes: ['averageProcessTime'] });
    const avgProcessTime = clinic?.averageProcessTime || 15;
    
    // Broadcast via Pusher with enhanced data
    await triggerQueueUpdate(queue.clinicId, queue.doctorId || null, {
      currentNumber: parseInt(currentNumber),
      upcoming: queueData,
      totalWaiting: waitTime.waitingCount,
      avgWaitTime: waitTime.avgWaitPerPatient / 60000,
      avgProcessTimeMinutes: avgProcessTime,
      hasNextPatient: queueData.length > 0,
      cancelledNumber: queue.number,
      isDoctorQueue: !!queue.doctor,
      timestamp: new Date().toISOString()
    });
    
    // Also emit a specific wait time update event for cancellation
    const { emitToClinic, emitToDoctor } = await import('../config/pusher.js');
    const waitTimeUpdateData = {
      currentNumber: parseInt(currentNumber),
      avgProcessTimeMinutes: avgProcessTime,
      cancelled: true,
      cancelledNumber: queue.number,
      timestamp: new Date().toISOString()
    };
    
    if (queue.doctor) {
      emitToDoctor(queue.doctor, 'wait_time_updated', waitTimeUpdateData);
    }
    emitToClinic(queue.clinic._id, 'wait_time_updated', waitTimeUpdateData);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const broadcastClinicStatus = async (clinicId, statusData) => {
  try {
    emitToClinic(clinicId, 'clinic_status_updated', statusData);
    console.log(`Clinic status broadcast for clinic: ${clinicId}`);
  } catch (err) {
    console.error('Error broadcasting clinic status:', err);
  }
};

// Import the queue reset utility
import { resetAllDoctorQueuesForClinic } from '../utils/queueReset.js';

// Export the function for backward compatibility
export { resetAllDoctorQueuesForClinic };

/**
 * Get estimated wait time for current queue
 * GET /api/queue/:clinicId/:doctorId/wait-time
 */
export const getWaitTime = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;

    if (!clinicId || !isValidUUID(clinicId)) {
      return res.status(400).json({ error: 'Valid Clinic ID is required' });
    }

    if (doctorId && !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    const waitTimeData = await calculateEstimatedWaitTime(clinicId, doctorId || null);
    res.json(waitTimeData);
  } catch (error) {
    console.error('Error getting wait time:', error);
    res.status(500).json({ error: 'Failed to calculate wait time' });
  }
};

/**
 * Get wait time for a specific patient's booking
 * GET /api/queue/patient/:queueId/wait-time
 */
export const getPatientSpecificWaitTime = async (req, res) => {
  try {
    const { queueId } = req.params;

    if (!queueId || !isValidUUID(queueId)) {
      return res.status(400).json({ error: 'Valid Queue ID is required' });
    }

    const waitTimeData = await getPatientWaitTime(queueId);
    res.json(waitTimeData);
  } catch (error) {
    console.error('Error getting patient wait time:', error);
    res.status(500).json({ error: 'Failed to get patient wait time' });
  }
};

/**
 * Get complete queue data with individual wait times
 * GET /api/queue/:clinicId/:doctorId/detailed
 */
export const getDetailedQueueWithWaitTimes = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;

    if (!clinicId || !isValidUUID(clinicId)) {
      return res.status(400).json({ error: 'Valid Clinic ID is required' });
    }

    if (doctorId && !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    const queueData = await getQueueWithWaitTimes(clinicId, doctorId || null);
    res.json(queueData);
  } catch (error) {
    console.error('Error getting detailed queue:', error);
    res.status(500).json({ error: 'Failed to get detailed queue data' });
  }
};

// Skip a patient - mark as skipped but keep in queue for later calling
export const skipPatient = async (req, res) => {
  try {
    const { doctorId, patientNumber, clinicId } = req.body;
    
    // Validate doctor ID
    if (!doctorId || !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    // Validate patient number
    const validatedPatientNumber = validateNumber(patientNumber, 1, 9999);
    if (validatedPatientNumber === null) {
      return res.status(400).json({ error: 'Valid patient number is required (1-9999)' });
    }

    const targetClinicId = req.clinic.id;
    
    // Find and skip the specific patient
    const skippedQueue = await Queue.findOne({
      where: {
        clinicId: targetClinicId,
        doctorId: doctorId,
        number: validatedPatientNumber,
        status: 'waiting'
      }
    });

    if (!skippedQueue) {
      return res.status(404).json({ error: 'Patient not found or already processed' });
    }

    await skippedQueue.update({
      status: 'skipped',
      skippedAt: new Date()
    });

    // Reload with patient data
    await skippedQueue.reload({
      include: [{ association: 'patient', attributes: ['id', 'name', 'activeQueues'] }]
    });

    // Update patient record to remove from active queues but keep in skipped list
    if (skippedQueue.patient) {
      const patient = await Patient.findByPk(skippedQueue.patient.id);
      if (patient) {
        const activeQueuesArr = patient.activeQueues || [];
        const filteredActiveQueues = activeQueuesArr.filter(qid => qid !== skippedQueue.id);
        await patient.update({
          activeQueues: filteredActiveQueues
        });
      }
    }

    // Broadcast update
    const enhancedQueueData = await getQueueDataForBroadcast(targetClinicId, doctorId);
    await triggerQueueUpdate(targetClinicId, doctorId, enhancedQueueData);

    res.json({
      success: true,
      skippedPatient: {
        number: skippedQueue.number,
        name: skippedQueue.patientName || skippedQueue.patient?.name || 'Unknown',
        skippedAt: skippedQueue.skippedAt
      }
    });

  } catch (err) {
    console.error('Error skipping patient:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get skipped patients list
export const getSkippedPatients = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Validate doctor ID
    if (!doctorId || !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    const targetClinicId = req.clinic.id;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const skippedPatients = await Queue.findAll({
      where: {
        clinicId: targetClinicId,
        doctorId: doctorId,
        status: 'skipped',
        skippedAt: { [Op.gte]: todayStart }
      },
      order: [['skippedAt', 'DESC']],
      include: [{ association: 'patient', attributes: ['name', 'phone'] }]
    });

    const formattedPatients = skippedPatients.map(queue => ({
      id: queue.id,
      number: queue.number,
      name: queue.patientName || queue.patient?.name || 'Unknown',
      phone: queue.patient?.phone || null,
      skippedAt: queue.skippedAt,
      isManualEntry: !!queue.manualEntry
    }));

    res.json({ skippedPatients: formattedPatients });
  } catch (err) {
    console.error('Error getting skipped patients:', err);
    res.status(500).json({ error: err.message });
  }
};

// Call back a skipped patient
export const callSkippedPatient = async (req, res) => {
  try {
    const { queueId } = req.params;
    const { doctorId } = req.body;

    // Validate queue ID
    if (!queueId || !isValidUUID(queueId)) {
      return res.status(400).json({ error: 'Valid Queue ID is required' });
    }

    // Validate doctor ID
    if (!doctorId || !isValidUUID(doctorId)) {
      return res.status(400).json({ error: 'Valid Doctor ID is required' });
    }

    const targetClinicId = req.clinic.id;
    
    // Find the skipped patient and change status back to waiting
    const calledBackQueue = await Queue.findOne({
      where: {
        id: queueId,
        clinicId: targetClinicId,
        doctorId: doctorId,
        status: 'skipped'
      }
    });

    if (!calledBackQueue) {
      return res.status(404).json({ error: 'Skipped patient not found' });
    }

    await calledBackQueue.update({
      status: 'waiting',
      skippedAt: null
    });

    // Reload with patient data
    await calledBackQueue.reload({
      include: [{ association: 'patient', attributes: ['id', 'name', 'activeQueues'] }]
    });

    // Update patient record to add back to active queues
    if (calledBackQueue.patient) {
      const patient = await Patient.findByPk(calledBackQueue.patient.id);
      if (patient) {
        const activeQueuesArr = patient.activeQueues || [];
        if (!activeQueuesArr.includes(calledBackQueue.id)) {
          activeQueuesArr.push(calledBackQueue.id);
        }
        await patient.update({
          activeQueues: activeQueuesArr
        });
      }
    }

    // Broadcast update
    const enhancedQueueData = await getQueueDataForBroadcast(targetClinicId, doctorId);
    await triggerQueueUpdate(targetClinicId, doctorId, enhancedQueueData);

    res.json({
      success: true,
      calledBackPatient: {
        number: calledBackQueue.number,
        name: calledBackQueue.patientName || calledBackQueue.patient?.name || 'Unknown'
      }
    });

  } catch (err) {
    console.error('Error calling back skipped patient:', err);
    res.status(500).json({ error: err.message });
  }
};