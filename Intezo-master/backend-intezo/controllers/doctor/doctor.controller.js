import * as doctorService from './doctor.service.js';
import * as queueService from '../queue/queue.service.js';
import { Doctor } from '../../models/index.js';
import sequelize from '../../config/database.js';
import { Op } from 'sequelize';
import { cleanupFailedUpload, deleteProfilePhotoAsset, persistProfilePhoto } from '../../middleware/upload.js';

export const getDoctors = async (req, res) => {
  try {
    const clinicId = req.clinic.id;
    const doctors = await Doctor.findAll({
      where: sequelize.literal(`clinics @> '[{"clinic": "${clinicId}", "isActive": true}]'`),
      attributes: { exclude: ['password'] }
    });
    const transformed = doctors.map(doc => {
      const assoc = doc.clinics.find(c => c.clinic === clinicId);
      return { id: doc.id, name: doc.name, specialties: doc.specialties, consultationFee: assoc?.consultationFee || 0, availableDays: assoc?.availableDays || [], isAvailable: assoc?.isAvailable || false, isActive: assoc?.isActive || false };
    });
    res.json(transformed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addDoctor = async (req, res) => {
  try {
    const { name, email, specialty, consultationFee } = req.body;
    const clinicId = req.clinic.id;
    let doctor = await Doctor.findOne({ where: { email } });
    const clinicEntry = { clinic: clinicId, consultationFee: consultationFee || 0, availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], availableHours: { start: '09:00', end: '17:00' }, isActive: true, isAvailable: false, patientsServed: 0 };
    if (doctor) {
      const hasClinic = doctor.clinics.some(c => c.clinic === clinicId);
      if (!hasClinic) { doctor.clinics = [...doctor.clinics, clinicEntry]; await doctor.save(); }
    } else {
      doctor = await Doctor.create({ name, email, specialties: [specialty], clinics: [clinicEntry], emailVerified: false });
    }
    res.status(201).json({ message: 'Doctor linked successfully', doctorId: doctor.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const updatedDoctor = await doctorService.updateDoctorClinicData(req.params.id, req.clinic.id, req.body);
    if (req.query.t) doctorService.invalidateDoctorCache(req.params.id, req.clinic.id).catch(console.error);
    res.json({ success: true, message: 'Doctor updated successfully', data: updatedDoctor });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  }
};

export const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    await doctor.destroy();
    res.json({ message: 'Doctor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleDoctorAvailability = async (req, res) => {
  try {
    let doctorId, clinicId;
    const { isAvailable } = req.body;
    if (req.doctor) {
      doctorId = req.doctor.id; clinicId = req.body.clinicId;
      if (!clinicId) return res.status(400).json({ error: 'Clinic ID required' });
    } else if (req.clinic) {
      doctorId = req.params.id; clinicId = req.clinic.id;
      if (!doctorId) return res.status(400).json({ error: 'Doctor ID required' });
    } else {
      return res.status(401).json({ error: 'Unauthorized context' });
    }
    const status = await doctorService.updateAvailabilityStatus(doctorId, clinicId, isAvailable);
    res.json({ success: true, message: `Doctor is now ${status ? 'available' : 'unavailable'}`, isAvailable: status });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ success: false, message: err.message });
  }
};

export const getDoctorQueueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    if (req.doctor && String(req.doctor.id) !== String(id)) {
      return res.status(403).json({ error: 'Doctors can only view their own queues' });
    }

    // A clinic token is always scoped to its own clinic, regardless of query input.
    const clinicId = req.clinic?.id || req.query.clinicId;
    if (req.query.t) await doctorService.invalidateDoctorCache(id, clinicId);
    const data = await queueService.getDoctorQueueState(id, clinicId);
    res.json(data);
  } catch (err) {
    res.status(err.message === 'Doctor not found' ? 404 : 400).json({ error: err.message });
  }
};

export const getDoctorsPublic = async (req, res) => {
  try {
    const doctors = await queueService.getPublicClinicDoctors(req.params.clinicId);
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    if (req.query.t) await doctorService.invalidateDoctorCache(doctorId);
    const doctor = await doctorService.fetchDoctorProfile(doctorId);
    res.json({ doctor });
  } catch (err) {
    res.status(err.message === 'Doctor not found' ? 404 : 500).json({ error: err.message });
  }
};

export const getDoctorStats = async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    if (req.query.t) await doctorService.invalidateDoctorCache(doctorId);
    const stats = await doctorService.calculateDoctorStats(doctorId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateDoctorProfile = async (req, res) => {
  try {
    const { name, phone, specialties, qualifications } = req.body;
    const doctor = await Doctor.findByPk(req.doctor.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    await doctor.update({ name, phone, specialties, qualifications });
    const result = doctor.toJSON();
    delete result.password;
    res.json({ message: 'Profile updated successfully', doctor: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAvailableDoctors = async (req, res) => {
  try {
    const available = await doctorService.fetchDoctorsAvailableForClinic(req.clinic.id);
    res.json(available);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addDoctorToClinic = async (req, res) => {
  try {
    const { doctorId, ...clinicData } = req.body;
    const doctor = await doctorService.linkDoctorToClinic(doctorId, req.clinic.id, clinicData);
    res.json({ message: 'Doctor linked successfully', doctor: { id: doctor.id, name: doctor.name } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const doctor = await Doctor.findByPk(req.doctor.id);
    if (!doctor) throw new Error('Doctor not found');
    const previousPhoto = doctor.profilePhoto;
    const photoUrl = await persistProfilePhoto(req.file, 'doctor', doctor.id);
    await doctorService.handleProfilePhotoUpdate(doctor, photoUrl);
    await deleteProfilePhotoAsset(previousPhoto).catch(console.error);
    res.json({ message: 'Photo uploaded', profilePhoto: photoUrl });
  } catch (err) {
    await cleanupFailedUpload(req.file);
    res.status(500).json({ error: err.message });
  }
};

export const deleteProfilePhoto = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.doctor.id);
    if (!doctor?.profilePhoto) return res.status(400).json({ error: 'No photo to delete' });
    const previousPhoto = doctor.profilePhoto;
    await doctorService.handleProfilePhotoUpdate(doctor, null);
    await deleteProfilePhotoAsset(previousPhoto).catch(console.error);
    res.json({ message: 'Photo deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
