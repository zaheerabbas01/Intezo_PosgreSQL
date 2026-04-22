import Patient from '../models/Patient.js';
import Queue from '../models/Queue.js';
import Clinic from '../models/Clinic.js';
import Doctor from '../models/Doctor.js';
import redisClient from '../config/redis.js';
import { triggerQueueUpdate } from './queueController.js';
import FCMService from '../services/fcmService.js';
import { Op } from 'sequelize';

// This function is now handled in authController.js
// Keeping for backward compatibility but redirecting to auth
export const registerPatient = async (req, res) => {
  res.status(400).json({ 
    error: 'Please use /auth/register/patient endpoint for registration' 
  });
};

// Get patient profile
export const getPatientProfile = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient._id, {
      attributes: { exclude: ['createdAt', 'updatedAt', '__v'] }
    });
    
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update FCM token for notifications
export const updateFCMToken = async (req, res) => {
  try {
    console.log('📱 FCM token update request received');
    console.log('📱 Request body:', req.body);
    console.log('📱 Patient from auth:', req.patient ? req.patient._id : 'null');
    
    const { fcmToken } = req.body;
    
    if (!req.patient) {
      console.log('❌ No authenticated patient found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log(`📱 FCM token registration request from patient ${req.patient._id}`);
    console.log(`📱 Token: ${fcmToken ? fcmToken.substring(0, 20) + '...' : 'null'}`);
    
    if (!fcmToken) {
      console.log('❌ No FCM token provided in request');
      return res.status(400).json({ error: 'FCM token is required' });
    }
    
    const [rowsUpdated, [patient]] = await Patient.update(
      { fcmToken },
      {
        where: { id: req.patient._id },
        returning: true
      }
    );

    if (rowsUpdated === 0 || !patient) {
      console.log('❌ Patient not found');
      return res.status(404).json({ error: 'Patient not found' });
    }

    console.log(`✅ FCM token registered successfully for patient ${patient.name} (${patient.email})`);
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) {
    console.log(`❌ Error updating FCM token: ${err.message}`);
    console.log(`❌ Stack trace: ${err.stack}`);
    res.status(500).json({ error: err.message });
  }
};

// Get current queue status for patient
export const getCurrentQueueStatus = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient._id);
    const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
    
    // Clean up patient record - remove served/cancelled queues from activeQueues and currentQueue
    const servedOrCancelledQueues = await Queue.findAll({
      where: {
        patientId: req.patient._id,
        status: { [Op.in]: ['served', 'cancelled'] },
        id: { [Op.in]: patient.activeQueues || [] }
      }
    });
    
    if (servedOrCancelledQueues.length > 0) {
      const queueIdsToRemove = servedOrCancelledQueues.map(q => q.id);
      const queueIdsToAddToHistory = servedOrCancelledQueues.map(q => q.id);
      
      // Update activeQueues and queueHistory
      const updatedActiveQueues = (patient.activeQueues || []).filter(id => !queueIdsToRemove.includes(id));
      const updatedQueueHistory = [...new Set([...(patient.queueHistory || []), ...queueIdsToAddToHistory])];
      
      const updateData = {
        activeQueues: updatedActiveQueues,
        queueHistory: updatedQueueHistory
      };
      
      // For free users, clear currentQueue if it's served/cancelled
      // For premium users, only clear if currentQueue is served/cancelled
      const currentQueueServed = servedOrCancelledQueues.find(q => 
        patient.currentQueue && q.id.toString() === patient.currentQueue.toString()
      );
      
      if (!isPremiumActive || currentQueueServed) {
        updateData.currentQueue = null;
      }
      
      await patient.update(updateData);
    }
    
    // Get all active queues for this patient
    const activeQueues = await Queue.findAll({
      where: {
        patientId: req.patient._id,
        status: 'waiting'
      },
      include: [
        { association: 'clinic' },
        { association: 'doctor' }
      ]
    });
    
    console.log('🔥 PREMIUM USER CHECK:', {
      patientId: req.patient._id,
      isPremium: patient.isPremium,
      premiumExpiresAt: patient.premiumExpiresAt,
      isPremiumActive,
      activeQueuesCount: activeQueues.length,
      currentTime: new Date()
    });
    
    if (activeQueues.length === 0) {
      return res.status(404).json({ error: 'No active queue found' });
    }
    
    // For premium users with multiple bookings OR any premium user, return all active bookings
    if (isPremiumActive) {
      const activeBookings = [];
      
      for (const queue of activeQueues) {
        // Get current serving number from Redis
        const redisKey = queue.doctorId ? 
          `doctor:${queue.doctorId}:clinic:${queue.clinicId}:current` : 
          `clinic:${queue.clinicId}:current`;
        const currentNumber = await redisClient.get(redisKey) || 0;
        
        // Calculate actual position among waiting patients
        const waitingPatientsAhead = await Queue.count({
          where: {
            clinicId: queue.clinicId,
            ...(queue.doctorId ? { doctorId: queue.doctorId } : { doctorId: null }),
            status: 'waiting',
            number: { [Op.gt]: currentNumber, [Op.lt]: queue.number }
          }
        });
        const position = waitingPatientsAhead + 1; // +1 because this patient is also waiting
        
        // Calculate estimated wait time based on actual position
        const avgProcessTime = queue.clinic?.averageProcessTime || 15;
        const waitTime = waitingPatientsAhead > 0 ? waitingPatientsAhead * avgProcessTime : 0;
        
        activeBookings.push({
          _id: queue.id,
          queueId: queue.id,
          number: queue.number,
          queueNumber: queue.number,
          patientName: queue.patientName || patient.name,
          clinic: {
            _id: queue.clinic.id,
            name: queue.clinic?.name,
            address: queue.clinic?.address
          },
          doctor: queue.doctor ? {
            _id: queue.doctor.id,
            name: queue.doctor.name,
            specialty: queue.doctor.specialty
          } : null,
          currentServing: parseInt(currentNumber),
          positionInQueue: waitingPatientsAhead,
          estimatedWait: waitTime,
          status: queue.status,
          bookedAt: queue.bookedAt
        });
      }
      
      return res.json({ 
        isPremium: true,
        activeBookings,
        totalActive: activeBookings.length
      });
    }
    
    // For non-premium users or single booking, return old format
    const queue = activeQueues[0];
    const redisKey = queue.doctorId ? 
      `doctor:${queue.doctorId}:clinic:${queue.clinicId}:current` : 
      `clinic:${queue.clinicId}:current`;
    const currentNumber = await redisClient.get(redisKey) || 0;
    
    // Calculate actual position among waiting patients
    const waitingPatientsAhead = await Queue.count({
      where: {
        clinicId: queue.clinicId,
        ...(queue.doctorId ? { doctorId: queue.doctorId } : { doctorId: null }),
        status: 'waiting',
        number: { [Op.gt]: currentNumber, [Op.lt]: queue.number }
      }
    });
    const position = waitingPatientsAhead + 1; // +1 because this patient is also waiting
    const avgProcessTime = queue.clinic?.averageProcessTime || 15;
    const waitTime = waitingPatientsAhead > 0 ? waitingPatientsAhead * avgProcessTime : 0;

    res.json({
      isPremium: false,
      currentQueue: {
        _id: queue.id,
        number: queue.number,
        status: queue.status,
        bookedAt: queue.bookedAt,
        currentServing: parseInt(currentNumber),
        positionInQueue: waitingPatientsAhead,
        estimatedWait: waitTime,
        clinic: {
          _id: queue.clinic.id,
          name: queue.clinic.name,
          address: queue.clinic.address,
          operatingHours: queue.clinic.operatingHours
        },
        doctor: queue.doctor ? {
          _id: queue.doctor.id,
          name: queue.doctor.name,
          specialty: queue.doctor.specialty
        } : null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cancel booking (supports specific queue ID for premium users)
export const cancelBooking = async (req, res) => {
  try {
    const { queueId } = req.body; // Optional: specific queue to cancel
    const patient = await Patient.findByPk(req.patient._id, {
      include: [
        { association: 'currentQueue' },
        { association: 'activeQueues' }
      ]
    });
    
    let queueToCancel;
    
    if (queueId) {
      // Cancel specific queue (for premium users)
      queueToCancel = await Queue.findOne({
        where: {
          id: queueId,
          patientId: req.patient._id,
          status: 'waiting'
        }
      });
      
      if (!queueToCancel) {
        return res.status(404).json({ error: 'Queue not found or already processed' });
      }
    } else {
      // Cancel current queue (backward compatibility)
      if (!patient || !patient.currentQueue) {
        return res.status(400).json({ error: 'No active booking to cancel' });
      }
      queueToCancel = patient.currentQueue;
    }
    
    // Only allow cancellation if not already served
    if (queueToCancel.status !== 'waiting') {
      return res.status(400).json({ error: 'Cannot cancel already processed booking' });
    }

    // Update queue status
    await queueToCancel.update({
      status: 'cancelled',
      cancelledAt: new Date()
    });

    // Update patient records
    const updatedActiveQueues = (patient.activeQueues || []).filter(id => id !== queueToCancel.id);
    const updatedQueueHistory = [...new Set([...(patient.queueHistory || []), queueToCancel.id])];
    
    const updateData = {
      activeQueues: updatedActiveQueues,
      queueHistory: updatedQueueHistory
    };
    
    // For free users, always clear currentQueue when cancelling
    // For premium users, only clear if this was the currentQueue
    const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
    
    if (!isPremiumActive) {
      // Free user - always clear currentQueue when cancelling any booking
      updateData.currentQueue = null;
    } else if (patient.currentQueue && patient.currentQueue.id.toString() === queueToCancel.id.toString()) {
      // Premium user - only clear if this was the currentQueue
      updateData.currentQueue = null;
    }
    
    await patient.update(updateData);

    // Trigger queue update
    await triggerQueueUpdate(queueToCancel.clinicId, queueToCancel.doctorId);
    
    // Send FCM notification for queue updates
    const clinic = await Clinic.findByPk(queueToCancel.clinicId);
    const doctor = queueToCancel.doctorId ? await Doctor.findByPk(queueToCancel.doctorId) : null;
    
    // Get current serving number and notify patients within 3 numbers
    const redisKey = doctor ? `doctor:${doctor.id}:clinic:${clinic.id}:current` : `clinic:${clinic.id}:current`;
    const currentNumber = parseInt(await redisClient.get(redisKey)) || 0;
    
    const upcomingQueues = await Queue.findAll({
      where: {
        clinicId: clinic.id,
        ...(doctor && { doctorId: doctor.id }),
        status: 'waiting',
        number: { [Op.gt]: currentNumber, [Op.lte]: currentNumber + 3 }
      },
      include: [{ association: 'patient' }]
    });
    
    for (const queue of upcomingQueues) {
      if (queue.patient?.fcmToken) {
        await FCMService.sendQueueNotification(
          queue.patient.id,
          currentNumber,
          queue.number,
          clinic.name,
          doctor?.name || 'Doctor'
        );
      }
    }

    res.json({ 
      success: true,
      cancelledQueue: {
        queueId: queueToCancel.id,
        number: queueToCancel.number
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update registerPatientAndAddToQueue for doctor-specific booking
export const registerPatientAndAddToQueue = async (req, res) => {
  try {
    const { name, email, clinicId, doctorId } = req.body;

     if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    // Check if clinic is open
    const clinic = await Clinic.findByPk(clinicId);
    if (!clinic || !clinic.isOpen) {
      return res.status(400).json({ error: 'Clinic is currently closed' });
    }

    // Check if doctor is specified and available
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor || !doctor.isActive || !doctor.isAvailable) {
      return res.status(400).json({ error: 'Doctor is not available' });
    }

    // Check if patient already exists
    let patient = await Patient.findOne({ where: { email } });
    if (!patient) {
      return res.status(400).json({ 
        error: 'Patient not found. Please register first using /auth/register/patient' 
      });
    }

    // Check if email is verified
    if (!patient.emailVerified) {
      return res.status(400).json({ 
        error: 'Email not verified. Please verify your email first.' 
      });
    }

    // Check if patient has active waiting queues
    const activeQueues = await Queue.findAll({
      where: {
        patientId: patient.id,
        status: 'waiting'
      }
    });

    // For non-premium users, only allow one active booking
    if (activeQueues.length > 0) {
      const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
      if (!isPremiumActive) {
        return res.status(400).json({ error: 'Patient already in queue. Premium users can book multiple queues.' });
      }
      
      // For premium users, check if they already have a booking with this doctor
      const existingBookingWithDoctor = activeQueues.find(queue => 
        queue.doctorId && queue.doctorId.toString() === doctorId.toString()
      );
      
      if (existingBookingWithDoctor) {
        return res.status(400).json({ error: 'Patient already has an active booking with this doctor' });
      }
    }

    // Generate doctor-specific queue number
    const nextNumber = await Queue.getNextQueueNumber(clinicId, doctorId);

    // Create queue entry
    const queue = await Queue.create({
      clinicId: clinicId,
      doctorId: doctorId || null,
      patientId: patient.id,
      number: nextNumber,
      status: 'waiting',
      bookedAt: new Date()
    });

    // Update patient's queue references
    const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
    
    const updatedActiveQueues = [...new Set([...(patient.activeQueues || []), queue.id])];
    const updateData = { activeQueues: updatedActiveQueues };
    
    if (isPremiumActive) {
      // For premium users, set currentQueue only if it's null (first booking)
      if (!patient.currentQueue) {
        updateData.currentQueue = queue.id;
      }
    } else {
      // For non-premium users, use currentQueue as before
      updateData.currentQueue = queue.id;
    }
    
    await patient.update(updateData);

    // Initialize Redis counter if needed
    const redisKey = doctorId ? `doctor:${doctorId}:current` : `clinic:${clinicId}:current`;
    if (!(await redisClient.get(redisKey))) {
      await redisClient.set(redisKey, 0);
    }

    // Trigger queue update
    await triggerQueueUpdate(clinicId, doctorId);

    res.status(201).json({
      patient: {
        _id: patient.id,
        name: patient.name,
        email: patient.email
      },
      queueNumber: nextNumber,
      isDoctorQueue: !!doctorId,
      doctor: doctor ? { name: doctor.name, specialty: doctor.specialty } : null
    });
  } catch (err) {
    console.error('Error in registerPatientAndAddToQueue:', err);
    res.status(500).json({ error: err.message });
  }
};

// Add to patientController.js
export const updatePatientInfo = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { name, email } = req.body;

    const [rowsUpdated, [patient]] = await Patient.update(
      { name, email },
      {
        where: { id: patientId },
        returning: true
      }
    );

    if (rowsUpdated === 0 || !patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPatientQueueHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const cacheKey = `patient:${patientId}:history`;
    
    // Try cache first
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        try {
          if (typeof cached !== 'string' || cached.length > 1000000) {
            await redisClient.del(cacheKey);
          } else {
            // Use JSON.parse with reviver to prevent prototype pollution
            const parsedData = JSON.parse(cached, (key, value) => {
              // Only allow plain objects and primitives
              if (value && typeof value === 'object' && value.constructor !== Object && value.constructor !== Array) {
                return undefined;
              }
              return value;
            });
            
            if (Array.isArray(parsedData) && parsedData.every(item => 
              item && typeof item === 'object' && ('number' in item || 'status' in item)
            )) {
              return res.json(parsedData);
            }
            await redisClient.del(cacheKey);
          }
        } catch (parseError) {
          await redisClient.del(cacheKey);
        }
      }
    }

    const history = await Queue.findAll({
      where: {
        patientId: patientId,
        status: { [Op.in]: ['served', 'cancelled'] }
      },
      include: [
        { association: 'clinic', attributes: ['name', 'address'] },
        { association: 'doctor', attributes: ['name'] }
      ],
      order: [['updatedAt', 'DESC']],
      attributes: ['number', 'status', 'bookedAt', 'servedAt', 'updatedAt', 'patientName'],
      limit: 50
    });
    
    // Cache for 1 minute
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(history));
    }
    
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
