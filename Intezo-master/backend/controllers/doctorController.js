// controllers/doctorController.js
import Doctor from '../models/Doctor.js';
import Clinic from '../models/Clinic.js';
import Queue from '../models/Queue.js';
import Patient from '../models/Patient.js';
import redisClient from '../config/redis.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { emitToClinic, getIO } from '../config/pusher.js';
import FCMService from '../services/fcmService.js';
import fs from 'fs';
import path from 'path';

// Helper function to trigger queue updates
const triggerQueueUpdate = async (clinicId, doctorId, data = null) => {
  try {
    // Check if Socket.IO is initialized
    const io = getIO();
    if (!io) {
      console.warn('Socket.IO not initialized, skipping queue update');
      return;
    }

    if (data) {
      // Trigger update with provided data
      emitToClinic(clinicId, 'queue_updated', { doctorId, ...data });
    } else {
      // Fetch fresh data and trigger update
      const [currentNumber, waitingPatients] = await Promise.all([
        redisClient.isOpen ? (await redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`) || 0) : 0,
        Queue.findAll({
          where: {
            doctorId,
            status: 'waiting'
          },
          order: [['number', 'ASC']],
          limit: 10,
          include: [{
            association: 'patient',
            attributes: ['name', 'phone']
          }]
        })
      ]);
      
      const current = parseInt(currentNumber);
      const upcoming = waitingPatients.filter(q => q.number > current);
      
      const updateData = {
        currentNumber: current,
        upcoming,
        totalWaiting: upcoming.length,
        hasNextPatient: upcoming.length > 0
      };
      
      emitToClinic(clinicId, 'queue_updated', { doctorId, ...updateData });
    }
  } catch (error) {
    console.error('Error triggering queue update:', error);
  }
};

// Get all doctors for a clinic
export const getDoctors = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    
    // Find doctors who have this clinic in their clinics array
    const doctors = await Doctor.findAll({
      where: sequelize.literal(`clinics @> :clinicFilter`),
      replacements: {
        clinicFilter: JSON.stringify([{ clinic: clinicId, isActive: true }])
      },
      attributes: { exclude: ['password'] }
    });
    
    // Transform data to match old format for frontend compatibility
    const transformedDoctors = doctors.map(doctor => {
      const clinicAssociation = doctor.clinics.find(c => c.clinic._id.toString() === clinicId.toString());
      return {
        _id: doctor._id,
        name: doctor.name,
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        email: doctor.email,
        phone: doctor.phone,
        consultationFee: clinicAssociation?.consultationFee || 0,
        availableDays: clinicAssociation?.availableDays || [],
        availableHours: clinicAssociation?.availableHours || { start: '09:00', end: '17:00' },
        isActive: clinicAssociation?.isActive || false,
        isAvailable: clinicAssociation?.isAvailable || false,
        currentQueueNumber: clinicAssociation?.currentQueueNumber || 0,
        patientsServed: clinicAssociation?.patientsServed || 0
      };
    });
    
    res.json(transformedDoctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a specific doctor
export const getDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      where: sequelize.literal(`id = :doctorId AND clinics @> :clinicFilter`),
      replacements: {
        doctorId: req.params.id,
        clinicFilter: JSON.stringify([{ clinic: req.clinic._id }])
      },
      attributes: { exclude: ['__v'] }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new doctor
export const addDoctor = async (req, res) => {
  try {
    const {
      name,
      specialty,
      consultationFee,
      availableDays,
      availableHours
    } = req.body;

    const doctor = await Doctor.create({
      name,
      specialty,
      consultationFee: consultationFee || 0,
      availableDays: availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableHours: availableHours || { start: '09:00', end: '17:00' },
      clinics: [{
        clinic: req.clinic._id,
        consultationFee: consultationFee || 0,
        availableDays: availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        availableHours: availableHours || { start: '09:00', end: '17:00' },
        isActive: true,
        isAvailable: false,
        currentQueueNumber: 0,
        patientsServed: 0
      }]
    });

    res.status(201).json({
      message: 'Doctor added successfully',
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialty,
        consultationFee: doctor.consultationFee,
        availableDays: doctor.availableDays,
        availableHours: doctor.availableHours
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update doctor information
export const updateDoctor = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'specialty', 'consultationFee', 'availableDays', 'availableHours', 'isActive'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates!' });
    }

    const [rowsUpdated, [doctor]] = await Doctor.update(
      req.body,
      {
        where: { id: req.params.id },
        returning: true
      }
    );

    if (rowsUpdated === 0 || !doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (doctor.password) {
      doctor.password = undefined;
    }

    res.json({
      message: 'Doctor updated successfully',
      doctor
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a doctor
export const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      where: sequelize.literal(`id = :doctorId AND clinics @> :clinicFilter`),
      replacements: {
        doctorId: req.params.id,
        clinicFilter: JSON.stringify([{ clinic: req.clinic._id }])
      }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await doctor.destroy();
    res.json({ message: 'Doctor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Clear cache when timestamp parameter is present
const clearCacheIfNeeded = async (req, doctorId, clinicId) => {
  if (req.query.t && redisClient.isOpen) {
    // Clear relevant caches
    await redisClient.del(`doctor:${doctorId}:profile`);
    await redisClient.del(`doctor:${doctorId}:stats`);
    if (clinicId) {
      await redisClient.del(`doctors:clinic:${clinicId}:public`);
      await redisClient.del(`doctor:${doctorId}:clinic:${clinicId}:queue`);
    }
  }
};

// Get doctor's current queue status
// In doctorController.js - Add new functions for doctor queue management
export const toggleDoctorAvailability = async (req, res) => {
  try {
    let doctorId, clinicId, isAvailable;
    
    // Handle different authentication contexts
    if (req.doctor) {
      // Doctor is toggling their own availability
      doctorId = req.doctor._id;
      ({ clinicId, isAvailable } = req.body);
      
      if (!clinicId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Clinic ID is required' 
        });
      }
    } else if (req.clinic) {
      // Clinic is toggling doctor availability
      doctorId = req.params.id;
      clinicId = req.clinic._id;
      ({ isAvailable } = req.body);
      
      if (!doctorId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Doctor ID is required' 
        });
      }
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Update doctor availability for specific clinic
    const doctor = await Doctor.findOne({
      where: sequelize.literal(`id = :doctorId AND clinics @> :clinicFilter`),
      replacements: {
        doctorId: doctorId,
        clinicFilter: JSON.stringify([{ clinic: clinicId }])
      }
    });

    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not associated with this clinic' 
      });
    }

    const clinicIndex = doctor.clinics.findIndex(c => c.clinic.toString() === clinicId.toString());
    if (clinicIndex < 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not associated with this clinic' 
      });
    }

    doctor.clinics[clinicIndex].isAvailable = isAvailable;
    doctor.clinics[clinicIndex].lastStatusChange = new Date();
    await doctor.save();

    // Clear cache
    if (redisClient.isOpen) {
      await redisClient.del(`doctors:clinic:${clinicId}:public`);
    }

    // Emit real-time update
    try {
      const io = getIO();
      if (io) {
        emitToClinic(clinicId, 'doctor_status_changed', {
          doctorId,
          isAvailable,
          lastStatusChange: new Date()
        });
      }
    } catch (emitError) {
      console.error('Error emitting status change:', emitError);
    }

    res.json({
      success: true,
      message: `Doctor ${isAvailable ? 'available' : 'unavailable'} for clinic`,
      isAvailable
    });

  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

// Update getDoctorQueueStatus to handle doctor-specific data
export const getDoctorQueueStatus = async (req, res) => {
  try {
    const doctorId = req.params.id;
    console.log('Getting queue status for doctor:', doctorId);
    
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Get the first clinic association (assuming doctor is active in at least one clinic)
    const clinicAssociation = doctor.clinics.find(c => c.isActive) || doctor.clinics[0];
    if (!clinicAssociation) {
      return res.status(400).json({ error: 'Doctor is not associated with any clinic' });
    }

    const clinicId = clinicAssociation.clinic;
    
    // Clear cache if timestamp parameter is present
    await clearCacheIfNeeded(req, doctorId, clinicId);
    
    const [currentNumber, waitingPatients] = await Promise.all([
      redisClient.isOpen ? (await redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`) || 0) : 0,
      Queue.findAll({
        where: {
          clinicId,
          doctorId,
          status: 'waiting'
        },
        order: [['number', 'ASC']],
        limit: 10,
        include: [{
          association: 'patient',
          attributes: ['name', 'phone']
        }]
      })
    ]);

    const current = parseInt(currentNumber);
    const upcoming = waitingPatients.filter(q => q.number > current);

    console.log('Doctor queue status:', {
      doctorName: doctor.name,
      currentNumber: current,
      upcomingCount: upcoming.length,
      totalWaiting: upcoming.length
    });

    res.json({
      doctor: {
        name: doctor.name,
        specialty: doctor.specialties?.[0] || 'General Practitioner',
        isAvailable: clinicAssociation.isAvailable !== false
      },
      currentNumber: current,
      upcoming,
      totalWaiting: upcoming.length,
      hasNextPatient: upcoming.length > 0
    });
  } catch (err) {
    console.error('Error in getDoctorQueueStatus:', err);
    res.status(500).json({ error: err.message });
  }
};
// Get public doctors list for a clinic - OPTIMIZED
export const getDoctorsPublic = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const cacheKey = `doctors:clinic:${clinicId}:public`;
    
    // Try Redis cache first
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`Serving doctors for clinic ${clinicId} from cache`);
        return res.json(JSON.parse(cached));
      }
    }
    
    // Optimized query for better performance
    const doctors = await sequelize.query(
      `SELECT id, name, specialties, qualifications, email, phone, profile_photo AS "profilePhoto", clinics
       FROM doctors
       WHERE clinics @> :clinicFilter
       ORDER BY name`,
      {
        replacements: {
          clinicFilter: JSON.stringify([{ clinic: clinicId, isActive: true }])
        },
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Transform data efficiently
    const transformedDoctors = doctors.map(doctor => {
      const clinicAssociation = doctor.clinics.find(c => c.clinic === clinicId) || doctor.clinics[0];
      return {
        _id: doctor._id,
        name: doctor.name,
        specialty: doctor.specialties?.[0] || 'General Practitioner',
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        email: doctor.email,
        phone: doctor.phone,
        profilePhoto: doctor.profilePhoto,
        consultationFee: clinicAssociation?.consultationFee || 0,
        availableDays: clinicAssociation?.availableDays || [],
        availableHours: clinicAssociation?.availableHours || { start: '09:00', end: '17:00' },
        isActive: clinicAssociation?.isActive || false,
        isAvailable: clinicAssociation?.isAvailable || false
      };
    });

    // Cache for 2 minutes (shorter than clinics since availability changes more frequently)
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 120, JSON.stringify(transformedDoctors));
    }

    console.log(`Found ${transformedDoctors.length} doctors for clinic ${clinicId}`);
    res.json(transformedDoctors);
  } catch (err) {
    console.error('Error in getDoctorsPublic:', err);
    res.status(500).json({ error: err.message });
  }
};

// Add function to get doctor's current queue status
export const getDoctorCurrentQueue = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const doctor = await Doctor.findByPk(doctorId);
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Get the first clinic association
    const clinicAssociation = doctor.clinics.find(c => c.isActive) || doctor.clinics[0];
    const clinicId = clinicAssociation?.clinic;
    
    const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
    const currentNumber = redisClient.isOpen ? parseInt(await redisClient.get(redisKey) || 0) : 0;

    const waitingPatients = await Queue.findAll({
      where: {
        clinicId,
        doctorId,
        status: 'waiting'
      },
      order: [['number', 'ASC']],
      limit: 10,
      include: [{
        association: 'patient',
        attributes: ['name', 'phone']
      }]
    });

    const upcoming = waitingPatients.filter(q => q.number > currentNumber);

    res.json({
      doctor: {
        name: doctor.name,
        specialty: doctor.specialties?.[0] || 'General Practitioner',
        isAvailable: clinicAssociation?.isAvailable !== false
      },
      currentNumber,
      upcoming,
      totalWaiting: upcoming.length,
      hasNextPatient: upcoming.length > 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Doctor profile and stats endpoints
export const getDoctorProfile = async (req, res) => {
  try {
    // Clear cache if timestamp parameter is present
    await clearCacheIfNeeded(req, req.doctor._id);
    
    const doctor = await Doctor.findByPk(req.doctor._id, {
      attributes: { exclude: ['password'] }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json({
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialty: doctor.specialty,
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        licenseNumber: doctor.licenseNumber,
        clinics: doctor.clinics,
        role: doctor.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDoctorStats = async (req, res) => {
  try {
    const doctorId = req.doctor._id;
    
    // Clear cache if timestamp parameter is present
    await clearCacheIfNeeded(req, doctorId);
    
    const doctor = await Doctor.findByPk(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Calculate total patients served directly from Queue collection
    const totalPatientsServed = await Queue.count({
      where: {
        doctorId,
        status: 'served'
      }
    });

    // Get today's patients count from database
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPatients = await Queue.count({
      where: {
        doctorId,
        status: 'served',
        servedAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    });

    // Get active queues count
    const activeQueues = await Queue.count({
      where: {
        doctorId,
        status: 'waiting'
      }
    });

    console.log('Doctor stats:', {
      doctorId,
      totalPatientsServed,
      todayPatients,
      activeQueues,
      clinicsCount: doctor.clinics.length
    });

    // Get recent activity
    const recentActivity = [
      {
        description: `Served ${todayPatients} patients today`,
        time: 'Today'
      },
      {
        description: `Total served: ${totalPatientsServed} patients`,
        time: 'All time'
      },
      {
        description: `Active in ${doctor.clinics.length} clinics`,
        time: 'Current'
      }
    ];

    res.json({
      totalPatientsServed,
      todayPatients,
      activeQueues,
      recentActivity
    });
  } catch (err) {
    console.error('Error in getDoctorStats:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updateDoctorProfile = async (req, res) => {
  try {
    const { name, phone, specialties, qualifications } = req.body;
    
    const doctor = await Doctor.findByPk(req.doctor._id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await doctor.update({ name, phone, specialties, qualifications });
    if (doctor.password) doctor.password = undefined;

    res.json({
      message: 'Profile updated successfully',
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        licenseNumber: doctor.licenseNumber,
        role: doctor.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get available doctors that can be added to clinic
export const getAvailableDoctors = async (req, res) => {
  try {
    const clinicId = req.clinic._id;
    
    // Get all registered doctors
    const allDoctors = await Doctor.findAll({
      attributes: ['id', 'name', 'email', 'specialties', 'qualifications', 'licenseNumber', 'phone', 'clinics']
    });
    
    // Filter out doctors who are already in this clinic
    const availableDoctors = allDoctors.filter(doctor => {
      // Check if this clinic is in the doctor's clinics array
      const hasClinic = doctor.clinics?.some(c => c.clinic?.toString() === clinicId.toString());
      return !hasClinic;
    }).map(doctor => ({
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      specialties: doctor.specialties,
      qualifications: doctor.qualifications,
      licenseNumber: doctor.licenseNumber,
      phone: doctor.phone
    }));
    
    res.json(availableDoctors);
  } catch (err) {
    console.error('Error in getAvailableDoctors:', err);
    res.status(500).json({ error: err.message });
  }
};

// Add existing doctor to clinic
export const addDoctorToClinic = async (req, res) => {
  try {
    const { doctorId, consultationFee, availableDays, availableHours } = req.body;
    const clinicId = req.clinic._id;
    
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    // Check if doctor is already in this clinic
    const existingAssociation = doctor.clinics.find(c => c.clinic.toString() === clinicId.toString());
    if (existingAssociation) {
      return res.status(400).json({ error: 'Doctor is already associated with this clinic' });
    }
    
    // Add clinic to doctor's clinics array
    doctor.clinics.push({
      clinic: clinicId,
      consultationFee: consultationFee || 0,
      availableDays: availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableHours: availableHours || { start: '09:00', end: '17:00' }
    });
    
    await doctor.save();
    
    res.json({
      message: 'Doctor added to clinic successfully',
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        specialties: doctor.specialties,
        qualifications: doctor.qualifications,
        email: doctor.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Upload profile photo
export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const doctor = await Doctor.findByPk(req.doctor._id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Delete old profile photo if exists
    if (doctor.profilePhoto) {
      const uploadDir = path.resolve('uploads/profiles');
      const oldPhotoPath = path.resolve(path.join(uploadDir, path.basename(doctor.profilePhoto)));
      // Verify path is within uploads/profiles directory
      if (oldPhotoPath.startsWith(uploadDir) && fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update doctor with new photo URL
    const photoUrl = req.file.path || `/uploads/profiles/${req.file.filename}`;
    doctor.profilePhoto = photoUrl;
    await doctor.save();

    // Clear related caches
    if (redisClient.isOpen) {
      // Clear doctor caches for all clinics this doctor is associated with
      for (const clinicAssoc of doctor.clinics) {
        await redisClient.del(`doctors:clinic:${clinicAssoc.clinic}:public`);
      }
    }

    res.json({
      message: 'Profile photo uploaded successfully',
      profilePhoto: photoUrl
    });
  } catch (err) {
    // Clean up uploaded file if error occurs
    if (req.file && req.file.path) {
      const uploadDir = path.resolve('uploads/profiles');
      const filePath = path.resolve(req.file.path);
      // Verify path is within uploads/profiles directory
      if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(500).json({ error: err.message });
  }
};

// Delete profile photo
export const deleteProfilePhoto = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.doctor._id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (doctor.profilePhoto) {
      // Delete photo file
      const uploadDir = path.resolve('uploads/profiles');
      const photoPath = path.resolve(path.join(uploadDir, path.basename(doctor.profilePhoto)));
      // Verify path is within uploads/profiles directory
      if (photoPath.startsWith(uploadDir) && fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }

      // Remove photo URL from database
      doctor.profilePhoto = null;
      await doctor.save();

      // Clear related caches
      if (redisClient.isOpen) {
        for (const clinicAssoc of doctor.clinics) {
          await redisClient.del(`doctors:clinic:${clinicAssoc.clinic}:public`);
        }
      }
    }

    res.json({ message: 'Profile photo deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};