import Clinic from '../models/Clinic.js';
// Add these imports at the top
import Queue from '../models/Queue.js';
import redisClient from '../config/redis.js'; // Add this import
import Patient from '../models/Patient.js'; // Add this import
// import { broadcastClinicStatus, triggerQueueUpdate } from './queueController.js'; // Commented out - not needed
import { emitToClinic, emitToDoctor } from '../config/pusher.js';
import Doctor from '../models/Doctor.js';
import FCMService from '../services/fcmService.js';
import fs from 'fs';
import path from 'path';

// Add this function to track daily resets
// Update checkDailyReset function
const checkDailyReset = async (clinicId) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Check if any doctor has bookings today
    const doctors = await Doctor.findAll({ where: { clinic: clinicId, isActive: true } });
    
    for (const doctor of doctors) {
      const todayBookings = await Queue.count({
        where: {
          clinic: clinicId,
          doctor: doctor.id,
          bookedAt: { [Op.gte]: todayStart }
        }
      });

      // If no bookings today but Redis has old data, reset it
      if (todayBookings === 0) {
        const currentServing = redisClient.isOpen ? parseInt(await redisClient.get(`doctor:${doctor.id}:current`) || 0) : 0;
        if (currentServing > 0 && redisClient.isOpen) {
          await redisClient.set(`doctor:${doctor.id}:current`, 0);
          console.log(`Daily reset: Doctor ${doctor.id} Redis counter reset to 0`);
        }
      }
    }
  } catch (err) {
    console.error('Error in daily reset check:', err);
  }
};

// Get Clinic Profile
export const getClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic._id, {
      attributes: { exclude: ['password', '__v'] }
    });
    res.json(clinic);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update Clinic Profile
export const updateClinic = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'phone', 'address', 'services', 'operatingHours'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates!' });
    }

    const clinic = await Clinic.findByPk(req.clinic._id);
    if (!clinic) {
      return res.status(400).json({ error: 'Clinic not found' });
    }

    Object.assign(clinic, req.body);
    await clinic.save();
    res.json(clinic);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Clinic
export const deleteClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic._id);
    if (clinic) {
      await clinic.destroy();
    }
    res.json({ message: 'Clinic deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
export const getQueueDashboard = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    const [currentQueue, upcoming] = await Promise.all([
      Queue.findOne({ where: { clinic: clinicId, status: 'waiting' }, order: [['number', 'ASC']] }),
      Queue.findAll({ where: { clinic: clinicId, status: 'waiting' }, order: [['number', 'ASC']], limit: 5, include: [{ association: 'patient', attributes: ['phone'] }] }),
    ]);

    res.json({
      current: currentQueue?.number || 0,
      upcoming,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

// In clinicController.js - Update the getQueueAnalytics function
export const getQueueAnalytics = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    
    // Get patients by status with full details
    const [waiting, served, cancelled] = await Promise.all([
      Queue.findAll({ 
        where: { clinic: clinicId, status: 'waiting' },
        include: [{ association: 'patient', attributes: ['name', 'phone'] }, { association: 'doctor', attributes: ['name', 'specialties'] }],
        attributes: ['number', 'status', 'bookedAt', 'patient', 'patientName', 'manualEntry', 'doctor'],
        order: [['number', 'ASC']]
      }),
      
      Queue.findAll({ 
        where: { clinic: clinicId, status: 'served' },
        include: [{ association: 'patient', attributes: ['name', 'phone'] }, { association: 'doctor', attributes: ['name', 'specialties'] }],
        attributes: ['number', 'status', 'servedAt', 'patient', 'patientName', 'manualEntry', 'doctor'],
        order: [['servedAt', 'DESC']],
        limit: 50
      }),
      
      Queue.findAll({ 
        where: { clinic: clinicId, status: 'cancelled' },
        include: [{ association: 'patient', attributes: ['name', 'phone'] }, { association: 'doctor', attributes: ['name', 'specialties'] }],
        attributes: ['number', 'status', 'cancelledAt', 'patient', 'patientName', 'manualEntry', 'doctor'],
        order: [['cancelledAt', 'DESC']],
        limit: 50
      })
    ]);

    res.json({
      waiting: waiting.map(q => ({
        id: q.id,
        number: q.number,
        status: q.status,
        bookedAt: q.bookedAt,
        name: q.patientName || q.patient?.name || 'Anonymous',
        phone: q.manualEntry?.phone || q.patient?.phone || 'N/A',
        doctor: q.doctor ? {
          id: q.doctor.id,
          name: q.doctor.name,
          specialty: q.doctor.specialties?.[0] || 'General Practitioner'
        } : null,
        isManualEntry: !!q.manualEntry && !q.patient
      })),
      served: served.map(q => ({
        id: q.id,
        number: q.number,
        status: q.status,
        servedAt: q.servedAt,
        name: q.patientName || q.patient?.name || 'Anonymous',
        phone: q.manualEntry?.phone || q.patient?.phone || 'N/A',
        doctor: q.doctor ? {
          id: q.doctor.id,
          name: q.doctor.name,
          specialty: q.doctor.specialties?.[0] || 'General Practitioner'
        } : null,
        isManualEntry: !!q.manualEntry && !q.patient
      })),
      cancelled: cancelled.map(q => ({
        id: q.id,
        number: q.number,
        status: q.status,
        cancelledAt: q.cancelledAt,
        name: q.patientName || q.patient?.name || 'Anonymous',
        phone: q.manualEntry?.phone || q.patient?.phone || 'N/A',
        doctor: q.doctor ? {
          id: q.doctor.id,
          name: q.doctor.name,
          specialty: q.doctor.specialties?.[0] || 'General Practitioner'
        } : null,
        isManualEntry: !!q.manualEntry && !q.patient
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Import the queue reset utility
import { resetAllDoctorQueuesForClinic, verifyAndFixRedisCounters } from '../utils/queueReset.js';



// Toggle clinic open/close status
export const toggleClinicStatus = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic._id);
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const wasOpen = clinic.isOpen;
    clinic.isOpen = !clinic.isOpen;
    clinic.lastStatusChange = new Date();
    
    let resetCount = 0;
    
    // If clinic is being closed, reset all doctor queues
    if (wasOpen && !clinic.isOpen) {
      resetCount = await resetAllDoctorQueuesForClinic(clinic._id);
    }
    
    await clinic.save();
    
    // Send FCM notification when clinic opens
    if (!wasOpen && clinic.isOpen) {
      await FCMService.sendClinicOpenNotification(req.clinic._id, clinic.name);
    }
    
    // Invalidate cache
    if (redisClient.isOpen) {
      await redisClient.del(`clinic:${req.clinic._id}:status`);
      await redisClient.del('clinics:public:list');
    }
    
    // Broadcast the status change to all clients
    try {
      const { getIO } = await import('../config/pusher.js');
      const io = getIO();
      if (io) {
        io.emit('clinic_status_updated', {
          clinicId: req.clinic._id,
          isOpen: clinic.isOpen,
          lastStatusChange: clinic.lastStatusChange.toISOString(),
          queuesReset: !clinic.isOpen,
          resetCount: resetCount
        });
      }
    } catch (socketError) {
      console.error('Error broadcasting clinic status:', socketError);
    }
    
    const statusMessage = clinic.isOpen ? 'Clinic is now open' : `Clinic is now closed${resetCount > 0 ? ` and ${resetCount} queues were reset` : ''}`;
    
    res.json({ 
      success: true, 
      isOpen: clinic.isOpen,
      message: statusMessage,
      resetCount: resetCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// Get clinic status - OPTIMIZED
export const getClinicStatus = async (req, res) => {
  try {
    const cacheKey = `clinic:${req.clinic._id}:status`;
    
    // Try cache first
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }
    
    const clinic = await Clinic.findByPk(req.clinic._id, {
      attributes: ['isOpen', 'operatingHours', 'lastStatusChange', 'name'],
      raw: true
    });
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    const [openingHour, openingMinute] = clinic.operatingHours.opening.split(':').map(Number);
    const [closingHour, closingMinute] = clinic.operatingHours.closing.split(':').map(Number);
    
    const openingTime = new Date();
    openingTime.setHours(openingHour, openingMinute, 0, 0);
    
    const closingTime = new Date();
    closingTime.setHours(closingHour, closingMinute, 0, 0);
    
    const isWithinOperatingHours = now >= openingTime && now <= closingTime;
    
    const response = {
      isOpen: clinic.isOpen,
      operatingHours: clinic.operatingHours,
      lastStatusChange: clinic.lastStatusChange,
      name: clinic.name,
      currentTime: currentTime,
      isWithinOperatingHours: isWithinOperatingHours
    };
    
    // Cache for 30 seconds
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 30, JSON.stringify(response));
    }
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// OPTIMIZED: Get specific doctor queue data quickly
export const getDoctorQueueFast = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;
    const cacheKey = `doctor:queue:${doctorId}:${clinicId}`;
    
    // Try cache first (15 seconds cache)
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }
    
    const [currentServing, waitingPatients, doctor] = await Promise.all([
      redisClient.isOpen ? redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`).then(val => parseInt(val || 0)) : 0,
      Queue.findAll({
        where: { clinic: clinicId, doctor: doctorId, status: 'waiting' },
        attributes: ['number', 'patientName'],
        include: [{ association: 'patient', attributes: ['name'] }],
        order: [['number', 'ASC']],
        limit: 5,
        raw: true
      }),
      Doctor.findByPk(doctorId, {
        attributes: ['name', 'specialties'],
        raw: true
      })
    ]);
    
    const response = {
      current: currentServing,
      nextNumber: currentServing + 1,
      upcoming: waitingPatients.map(q => ({
        number: q.number,
        patientName: q.patientName || q.patient?.name || 'Patient'
      })),
      totalWaiting: waitingPatients.length,
      avgWaitTime: 15,
      doctor: {
        name: doctor?.name || 'Doctor',
        specialty: doctor?.specialties?.[0] || 'General Practitioner'
      }
    };
    
    // Cache for 15 seconds
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 15, JSON.stringify(response));
    }
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add this to clinicController.js or create a new debug controller
export const debugQueueStatus = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    
    const redisCurrent = redisClient.isOpen ? await redisClient.get(`clinic:${clinicId}:current`) : 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayBookings = await Queue.findAll({
      where: { clinic: clinicId, bookedAt: { [Op.gte]: todayStart }, status: { [Op.ne]: 'cancelled' } },
      order: [['number', 'DESC']]
    });
    
    const allBookings = await Queue.findAll({ where: { clinic: clinicId }, order: [['number', 'DESC']], limit: 5 });
    
    res.json({
      redisCurrent: parseInt(redisCurrent || 0),
      todayBookingsCount: todayBookings.length,
      todayBookings: todayBookings.map(q => ({ number: q.number, status: q.status, bookedAt: q.bookedAt })),
      recentBookings: allBookings.map(q => ({ number: q.number, status: q.status, bookedAt: q.bookedAt })),
      clinicStatus: await Clinic.findByPk(clinicId, {
        attributes: ['isOpen', 'operatingHours']
      })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Manual reset of all doctor queues for a clinic
export const resetAllQueues = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    
    console.log(`🔄 Manual reset requested for clinic: ${clinicId}`);
    
    // First verify and fix any Redis counter issues
    await verifyAndFixRedisCounters(clinicId);
    
    // Then perform the full reset
    const resetCount = await resetAllDoctorQueuesForClinic(clinicId);
    
    // Clear all related caches after reset
    if (redisClient.isOpen) {
      const pattern = `*${clinicId}*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🧹 Cleared ${keys.length} cache keys for clinic ${clinicId}`);
      }
    }
    
    res.json({
      success: true,
      message: `Successfully reset all doctor queues`,
      resetCount: resetCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error in manual queue reset:', err);
    res.status(500).json({ error: err.message });
  }
};

// OPTIMIZED: Batch get multiple doctor queues
export const getBatchDoctorQueues = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { doctorIds } = req.body;
    
    if (!doctorIds || !Array.isArray(doctorIds)) {
      return res.status(400).json({ error: 'Doctor IDs array required' });
    }
    
    const cacheKey = `batch:queues:${clinicId}:${doctorIds.sort().join(',')}`;
    
    // Try cache first
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }
    
    // Get all queue data in parallel
    const queuePromises = doctorIds.map(async (doctorId) => {
      const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
      
      const [currentServing, waitingCount] = await Promise.all([
        redisClient.isOpen ? redisClient.get(redisKey).then(val => parseInt(val || 0)) : 0,
        Queue.count({
          where: {
            clinic: clinicId,
            doctor: doctorId,
            status: 'waiting'
          }
        })
      ]);
      
      return {
        doctorId,
        current: currentServing,
        nextNumber: currentServing + 1,
        totalWaiting: waitingCount
      };
    });
    
    const queues = await Promise.all(queuePromises);
    const response = queues.reduce((acc, queue) => {
      acc[queue.doctorId] = {
        current: queue.current,
        nextNumber: queue.nextNumber,
        totalWaiting: queue.totalWaiting,
        avgWaitTime: 15
      };
      return acc;
    }, {});
    
    // Cache for 20 seconds
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 20, JSON.stringify(response));
    }
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// OPTIMIZED: Get clinic summary for quick loading
export const getClinicSummary = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const cacheKey = `clinic:summary:${clinicId}`;
    
    // Try cache first (60 seconds)
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }
    
    const [clinic, doctorCount, totalWaiting] = await Promise.all([
      Clinic.findByPk(clinicId, {
        attributes: ['name', 'address', 'isOpen', 'operatingHours'],
        raw: true
      }),
      Doctor.count({
        where: {
          '$clinics.clinic$': clinicId,
          '$clinics.isActive$': true
        }
      }),
      Queue.count({
        where: {
          clinic: clinicId,
          status: 'waiting'
        }
      })
    ]);
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    const summary = {
      ...clinic,
      doctorCount,
      totalWaiting,
      avgWaitTime: clinic.averageProcessTime || 15
    };
    
    // Cache for 60 seconds
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(summary));
    }
    
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get clinics for public access (no authentication required) - OPTIMIZED
export const getClinicsPublic = async (req, res) => {
  try {
    const cacheKey = 'clinics:public:list';
    
    // Try to get from Redis cache first
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('Serving clinics from cache');
        return res.json(JSON.parse(cached));
      }
    }
    
    // If not in cache, fetch from database with optimized query
    const clinics = await Clinic.findAll({ 
      where: { isActive: { [Op.ne]: false } },
      attributes: ['name', 'phone', 'address', 'services', 'operatingHours', 'isOpen', 'lastStatusChange', 'profilePhoto'],
      raw: true
    });
    
    // Cache for 5 minutes
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(clinics));
    }
    
    res.json(clinics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get recently visited clinics with optimized data - NEW ENDPOINT
export const getRecentClinics = async (req, res) => {
  try {
    const { clinicIds } = req.body; // Array of clinic IDs from mobile app
    
    if (!clinicIds || !Array.isArray(clinicIds) || clinicIds.length === 0) {
      return res.json([]);
    }
    
    const cacheKey = `clinics:recent:${clinicIds.sort().join(',')}`;
    
    // Try cache first
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('Serving recent clinics from cache');
        return res.json(JSON.parse(cached));
      }
    }
    
    // Fetch only requested clinics with minimal data
    const clinics = await Clinic.findAll({ 
      where: { id: { [Op.in]: clinicIds }, isActive: { [Op.ne]: false } },
      attributes: ['name', 'phone', 'address', 'isOpen', 'operatingHours', 'lastStatusChange'],
      raw: true
    });
    
    // Maintain order based on input array
    const orderedClinics = clinicIds.map(id => 
      clinics.find(clinic => clinic.id?.toString() === id)
    ).filter(Boolean);
    
    // Cache for 2 minutes (shorter cache for recent visits)
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(orderedClinics));
    }
    
    res.json(orderedClinics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// OPTIMIZED: Get complete clinic info with doctors and queue data in single call
export const getClinicComplete = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const cacheKey = `clinic:complete:${clinicId}`;
    
    // Try cache first (30 seconds cache)
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`Serving complete clinic data from cache for ${clinicId}`);
        return res.json(JSON.parse(cached));
      }
    }
    
    // Parallel fetch clinic and doctors
    const [clinic, doctors] = await Promise.all([
      Clinic.findByPk(clinicId, {
        attributes: ['name', 'phone', 'address', 'services', 'operatingHours', 'isOpen', 'lastStatusChange', 'profilePhoto'],
        raw: true
      }),
      Doctor.findAll({
        where: {
          '$clinics.clinic$': clinicId,
          '$clinics.isActive$': true
        },
        attributes: ['id', 'name', 'specialties', 'qualifications', 'profilePhoto', 'clinics'],
        order: [['name', 'ASC']],
        raw: true
      })
    ]);
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    
    // Transform doctors data and get queue info in parallel
    const doctorPromises = doctors.map(async (doctor) => {
      const clinicAssociation = doctor.clinics?.find(c => c.clinic?.toString() === clinicId.toString()) || doctor.clinics?.[0];
      const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
      
      // Get current serving number and waiting count in parallel
      const [currentServing, waitingCount] = await Promise.all([
        redisClient.isOpen ? redisClient.get(redisKey).then(val => parseInt(val || 0)) : 0,
        Queue.count({
          where: {
            clinic: clinicId,
            doctor: doctor.id,
            status: 'waiting'
          }
        })
      ]);
      
      return {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialties?.[0] || 'General Practitioner',
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        profilePhoto: doctor.profilePhoto,
        consultationFee: clinicAssociation?.consultationFee || 0,
        availableDays: clinicAssociation?.availableDays || [],
        availableHours: clinicAssociation?.availableHours || { start: '09:00', end: '17:00' },
        isActive: clinicAssociation?.isActive || false,
        isAvailable: clinicAssociation?.isAvailable !== false,
        queueInfo: {
          current: currentServing,
          nextNumber: currentServing + 1,
          totalWaiting: waitingCount,
          avgWaitTime: clinic.averageProcessTime || 15
        }
      };
    });
    
    const doctorsWithQueue = await Promise.all(doctorPromises);
    
    const response = {
      clinic,
      doctors: doctorsWithQueue,
      timestamp: new Date().toISOString()
    };
    
    // Cache for 30 seconds
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 30, JSON.stringify(response));
    }
    
    console.log(`Complete clinic data loaded for ${clinicId}: ${doctorsWithQueue.length} doctors`);
    res.json(response);
  } catch (err) {
    console.error('Error in getClinicComplete:', err);
    res.status(500).json({ error: err.message });
  }
};

// Upload profile photo
export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const clinic = await Clinic.findByPk(req.clinic._id);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    // Delete old profile photo if exists
    if (clinic.profilePhoto) {
      const oldPhotoPath = path.join('uploads/profiles', path.basename(clinic.profilePhoto));
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update clinic with new photo URL - use Cloudinary URL directly
    const photoUrl = req.file.path; // This should be the full Cloudinary URL
    console.log('Uploaded file path:', photoUrl);
    
    clinic.profilePhoto = photoUrl;
    await clinic.save();

    // Clear cache
    if (redisClient.isOpen) {
      await redisClient.del('clinics:public:list');
      await redisClient.del(`clinic:${req.clinic._id}:status`);
    }

    res.json({
      message: 'Profile photo uploaded successfully',
      profilePhoto: photoUrl
    });
  } catch (err) {
    // Clean up uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
};

// Delete profile photo
export const deleteProfilePhoto = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic._id);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    if (clinic.profilePhoto) {
      // Delete photo file
      const photoPath = path.join('uploads/profiles', path.basename(clinic.profilePhoto));
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }

      // Remove photo URL from database
      clinic.profilePhoto = null;
      await clinic.save();

      // Clear cache
      if (redisClient.isOpen) {
        await redisClient.del('clinics:public:list');
        await redisClient.del(`clinic:${req.clinic._id}:status`);
      }
    }

    res.json({ message: 'Profile photo deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check if clinic is outside operating hours and close if needed
export const checkOperationHours = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic._id);
    
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const openingTime = clinic.operatingHours.opening;
    const closingTime = clinic.operatingHours.closing;
    const isWithinHours = currentTime >= openingTime && currentTime < closingTime;
    
    let resetCount = 0;
    let message = `Clinic operating hours: ${openingTime} - ${closingTime}`;
    
    // Close clinic if outside operating hours and currently open
    if (!isWithinHours && clinic.isOpen) {
      resetCount = await resetAllDoctorQueuesForClinic(clinic._id);
      
      clinic.isOpen = false;
      clinic.lastStatusChange = new Date();
      await clinic.save();
      
      message = `Clinic closed (outside operating hours). ${resetCount} queues reset`;
      
      // Broadcast the status change
      try {
        const { getIO } = await import('../config/pusher.js');
        const io = getIO();
        if (io) {
          io.emit('clinic_status_updated', {
            clinicId: req.clinic._id,
            isOpen: false,
            lastStatusChange: clinic.lastStatusChange.toISOString(),
            queuesReset: true,
            resetCount: resetCount,
            reason: 'outside_operating_hours'
          });
        }
      } catch (socketError) {
        console.error('Error broadcasting clinic status:', socketError);
      }
    } else if (isWithinHours) {
      message = `Clinic is within operating hours (${openingTime} - ${closingTime})`;
    } else {
      message = `Clinic is closed (outside operating hours: ${openingTime} - ${closingTime})`;
    }
    
    res.json({
      success: true,
      currentTime: currentTime,
      operatingHours: { opening: openingTime, closing: closingTime },
      isWithinHours: isWithinHours,
      isOpen: clinic.isOpen,
      message: message,
      resetCount: resetCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Verify and fix Redis counters for all doctors
export const verifyRedisCounters = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    
    console.log(`🔍 Verifying Redis counters for clinic: ${clinicId}`);
    
    const fixedCount = await verifyAndFixRedisCounters(clinicId);
    
    res.json({
      success: true,
      message: `Verified and fixed Redis counters`,
      fixedCount: fixedCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error verifying Redis counters:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get patient history for clinic dashboard
export const getPatientHistoryForClinic = async (req, res) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.clinic._id;
    
    console.log('Getting patient history for:', { patientId, clinicId });
    
    // Clear any cached data for this request
    const cacheKey = `patient:${patientId}:clinic:${clinicId}:history`;
    if (redisClient.isOpen) {
      await redisClient.del(cacheKey);
    }
    
    let history = [];
    let searchQueries = [];
    
    // Build multiple search queries based on the identifier type
    if (patientId) {
      // Search by patient ID
      searchQueries.push({
        clinic: clinicId,
        status: { [Op.in]: ['served', 'cancelled'] },
        patient: patientId
      });
      console.log('Added ID search for patient:', patientId);
    }
    
    // If looks like phone number, search by phone in multiple places
    if (/^[\d\+\-\s\(\)]+$/.test(patientId)) {
      // Search in manualEntry.phone
      searchQueries.push({
        clinic: clinicId,
        status: { [Op.in]: ['served', 'cancelled'] },
        'manualEntry.phone': patientId
      });
      
      // Also search for registered patients with this phone
      try {
        const patientsWithPhone = await Patient.findAll({ where: { phone: patientId }, attributes: ['id'] });
        if (patientsWithPhone.length > 0) {
          searchQueries.push({
            clinic: clinicId,
            status: { [Op.in]: ['served', 'cancelled'] },
            patient: { [Op.in]: patientsWithPhone.map(p => p.id) }
          });
          console.log('Found registered patients with phone:', patientsWithPhone.length);
        }
      } catch (phoneSearchError) {
        console.warn('Error searching patients by phone:', phoneSearchError.message);
      }
      console.log('Added phone search for:', patientId);
    }
    
    // Search by name (case-insensitive)
    searchQueries.push({
      clinic: clinicId,
      status: { [Op.in]: ['served', 'cancelled'] },
      patientName: { [Op.like]: `%${patientId}%` }
    });
    
    // Also search in registered patients by name
    try {
      const patientsWithName = await Patient.findAll({ 
        where: { name: { [Op.like]: `%${patientId}%` } },
        attributes: ['id']
      });
      if (patientsWithName.length > 0) {
        searchQueries.push({
          clinic: clinicId,
          status: { [Op.in]: ['served', 'cancelled'] },
          patient: { [Op.in]: patientsWithName.map(p => p.id) }
        });
        console.log('Found registered patients with name:', patientsWithName.length);
      }
    } catch (nameSearchError) {
      console.warn('Error searching patients by name:', nameSearchError.message);
    }
    
    console.log('Total search queries:', searchQueries.length);
    
    // Execute all search queries and combine results
    const searchPromises = searchQueries.map(async (query, index) => {
      try {
        console.log(`Executing search query ${index + 1}:`, JSON.stringify(query, null, 2));
        const results = await Queue.findAll({
          where: query,
          include: [{ association: 'doctor', attributes: ['name', 'specialties'] }, { association: 'patient', attributes: ['name', 'phone'] }],
          attributes: ['number', 'status', 'bookedAt', 'servedAt', 'cancelledAt', 'patientName', 'manualEntry', 'doctor', 'patient', 'updatedAt'],
          raw: true
        });
        console.log(`Query ${index + 1} returned ${results.length} results`);
        return results;
      } catch (queryError) {
        console.error(`Error in search query ${index + 1}:`, queryError.message);
        return [];
      }
    });
    
    const searchResults = await Promise.all(searchPromises);
    
    // Combine and deduplicate results
    const allResults = searchResults.flat();
    console.log('Total results before deduplication:', allResults.length);
    
    const uniqueResults = allResults.filter((item, index, self) => 
      index === self.findIndex(t => t.id?.toString() === item.id?.toString())
    );
    
    console.log('Unique results after deduplication:', uniqueResults.length);
    
    // Sort by most recent
    history = uniqueResults.sort((a, b) => {
      const aDate = new Date(a.servedAt || a.cancelledAt || a.updatedAt);
      const bDate = new Date(b.servedAt || b.cancelledAt || b.updatedAt);
      return bDate - aDate;
    }).slice(0, 50); // Limit to 50 most recent
    
    console.log('Final history entries:', history.length);
    if (history.length > 0) {
      console.log('Sample entries:', history.slice(0, 3).map(h => ({
        id: h.id,
        number: h.number,
        status: h.status,
        patientName: h.patientName,
        patientAccount: h.patient?.name,
        phone: h.manualEntry?.phone || h.patient?.phone,
        date: h.servedAt || h.cancelledAt || h.updatedAt
      })));
    }
    
    res.json(history);
  } catch (err) {
    console.error('Error in getPatientHistoryForClinic:', err);
    res.status(500).json({ error: err.message });
  }
};

// Add patient to queue manually from clinic dashboard (new queue method)
export const addPatientToQueue = async (req, res) => {
  try {
    const { name, phone, doctorId } = req.body;
    const clinicId = req.clinic._id;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Validate phone format
    if (!/^(\+92|92|0)?3\d{9}$/.test(phone.replace(/\D/g, ''))) {
      return res.status(400).json({ error: 'Please enter a valid Pakistani phone number' });
    }

    // Check if clinic is open
    const clinic = await Clinic.findByPk(clinicId);
    if (!clinic || !clinic.isOpen) {
      return res.status(400).json({ error: 'Clinic is currently closed' });
    }

    // If doctorId is provided, validate doctor
    let doctor = null;
    if (doctorId) {
      doctor = await Doctor.findByPk(doctorId);
      if (!doctor) {
        return res.status(400).json({ error: 'Doctor not found' });
      }

      // Check if doctor is associated with this clinic and is active
      const clinicAssociation = doctor.clinics.find(c => c.clinic.toString() === clinicId.toString());
      if (!clinicAssociation || !clinicAssociation.isActive) {
        return res.status(400).json({ error: 'Doctor is not active in this clinic' });
      }

      if (clinicAssociation.isAvailable === false) {
        return res.status(400).json({ error: 'Selected doctor is not available' });
      }
    } else {
      // If no doctor specified, get the first available doctor
      const availableDoctors = await Doctor.findAll({
        where: { '$clinics.clinic$': clinicId, '$clinics.isActive$': true, '$clinics.isAvailable$': { [Op.ne]: false } }
      });
      
      if (availableDoctors.length === 0) {
        return res.status(400).json({ error: 'No available doctors found' });
      }
      
      doctor = availableDoctors[0];
    }

    // Generate doctor-specific queue number
    const nextNumber = await Queue.getNextQueueNumber(clinicId, doctor.id);

    // Create queue entry without creating patient account
    const queue = await Queue.create({
      clinic: clinicId,
      doctor: doctor.id,
      patient: null, // No patient account created
      patientName: name, // Store name directly in queue
      number: nextNumber,
      status: 'waiting',
      bookedAt: new Date(),
      // Store phone in a custom field for manual entries
      manualEntry: {
        phone: phone,
        addedBy: 'clinic'
      }
    });

    // Initialize Redis counter for doctor-clinic combination if not exists
    const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
    if (redisClient.isOpen && !(await redisClient.get(redisKey))) {
      await redisClient.set(redisKey, 0);
    }

    // Trigger queue update
    const { triggerQueueUpdate } = await import('./queueController.js');
    await triggerQueueUpdate(clinicId, doctor.id);

    res.status(201).json({
      success: true,
      queueNumber: nextNumber,
      patientName: name,
      phone: phone,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialties?.[0] || 'General Practitioner'
      },
      message: `Patient added to queue successfully! Queue number: ${nextNumber}`
    });

  } catch (err) {
    console.error('Error adding patient to queue:', err);
    res.status(500).json({ error: err.message });
  }
};