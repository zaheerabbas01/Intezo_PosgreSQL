import { Doctor, Queue, Patient } from '../../models/index.js';
import sequelize from '../../config/database.js';
import redisClient from '../../config/redis.js';
import { emitToClinic } from '../../config/pusher.js';
import { Op } from 'sequelize';
import fs from 'fs';
import path from 'path';

export const triggerQueueUpdate = async (clinicId, doctorId, manualData = null) => {
  try {
    const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
    const current = parseInt((redisClient.isOpen ? await redisClient.get(redisKey) : 0) || 0);
    const updateData = manualData || await (async () => {
      const waitingList = await Queue.findAll({ where: { doctor: doctorId, clinic: clinicId, status: 'waiting' }, order: [['number', 'ASC']], limit: 10, include: [{ association: 'patient', attributes: ['name'] }], raw: true, nest: true });
      const upcoming = waitingList.filter(q => q.number > current);
      return { currentNumber: current, upcoming: upcoming.map(u => ({ number: u.number, name: u.patientName || u.patient?.name || 'Walk-in Patient', isManual: !u.patient })), totalWaiting: upcoming.length, hasNextPatient: upcoming.length > 0 };
    })();
    emitToClinic(clinicId, 'queue_updated', { doctorId, ...updateData });
  } catch (error) { console.error('Real-time sync error:', error); }
};

export const updateDoctorClinicData = async (doctorId, clinicId, updates) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  const clinicIndex = doctor.clinics.findIndex(c => c.clinic.toString() === clinicId.toString());
  if (clinicIndex === -1) throw new Error('Doctor is not associated with this clinic');
  if (updates.name) doctor.name = updates.name;
  if (updates.specialty) doctor.specialties = [updates.specialty];
  const currentData = doctor.clinics[clinicIndex];
  doctor.clinics[clinicIndex] = { ...currentData, consultationFee: updates.consultationFee ?? currentData.consultationFee, availableDays: updates.availableDays ?? currentData.availableDays, availableHours: updates.availableHours ?? currentData.availableHours, isActive: updates.isActive ?? currentData.isActive, isAvailable: updates.isAvailable ?? currentData.isAvailable };
  doctor.changed('clinics', true);
  await doctor.save();
  return doctor;
};

export const invalidateDoctorCache = async (doctorId, clinicId) => {
  if (!redisClient.isOpen) return;
  await Promise.all([`doctor:${doctorId}:profile`, `clinic:${clinicId}:complete:${doctorId}`, `clinic:${clinicId}:doctors`].map(key => redisClient.del(key)));
};

export const updateAvailabilityStatus = async (doctorId, clinicId, isAvailable) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  const clinicIndex = doctor.clinics.findIndex(c => c.clinic.toString() === clinicId.toString());
  if (clinicIndex === -1) throw new Error('Doctor is not associated with this clinic');
  doctor.clinics[clinicIndex].isAvailable = isAvailable;
  doctor.clinics[clinicIndex].lastStatusChange = new Date();
  doctor.changed('clinics', true);
  await doctor.save();
  if (redisClient.isOpen) await redisClient.del(`doctors:clinic:${clinicId}:public`);
  emitToClinic(clinicId, 'doctor_status_changed', { doctorId, isAvailable, lastStatusChange: doctor.clinics[clinicIndex].lastStatusChange });
  return isAvailable;
};

export const getDoctorQueueState = async (doctorId, clinicId = null) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  const assoc = clinicId ? doctor.clinics.find(c => c.clinic.toString() === clinicId.toString()) : doctor.clinics.find(c => c.isActive) || doctor.clinics[0];
  if (!assoc) throw new Error('Doctor not associated with any clinic');
  const targetClinicId = assoc.clinic;
  const redisKey = `doctor:${doctorId}:clinic:${targetClinicId}:current`;
  const [currentNumberRaw, waitingPatients] = await Promise.all([
    redisClient.isOpen ? redisClient.get(redisKey) : '0',
    Queue.findAll({ where: { doctorId, clinicId: targetClinicId, status: 'waiting' }, order: [['number', 'ASC']], limit: 10, include: [{ association: 'patient', attributes: ['name', 'phone'] }] })
  ]);
  const current = parseInt(currentNumberRaw || 0);
  const upcoming = waitingPatients.filter(q => q.number > current);
  return { doctor: { name: doctor.name, specialty: doctor.specialties?.[0] || 'General Practitioner', isAvailable: assoc.isAvailable }, clinicId: targetClinicId, currentNumber: current, upcoming, totalWaiting: upcoming.length, hasNextPatient: upcoming.length > 0 };
};

export const getPublicClinicDoctors = async (clinicId) => {
  const cacheKey = `doctors:clinic:${clinicId}:public`;
  if (redisClient.isOpen) { const cached = await redisClient.get(cacheKey); if (cached) return JSON.parse(cached); }
  const doctors = await Doctor.findAll({ where: sequelize.literal(`clinics @> '[{"clinic": "${clinicId}", "isActive": true}]'`), attributes: ['id', 'name', 'specialties', 'qualifications', 'profilePhoto', 'clinics'], order: [['name', 'ASC']] });
  const transformed = doctors.map(doc => { const assoc = doc.clinics.find(c => c.clinic === clinicId); return { id: doc.id, name: doc.name, specialty: doc.specialties?.[0], consultationFee: assoc?.consultationFee || 0, availableHours: assoc?.availableHours, isAvailable: assoc?.isAvailable }; });
  if (redisClient.isOpen) await redisClient.setEx(cacheKey, 120, JSON.stringify(transformed));
  return transformed;
};

export const fetchDoctorProfile = async (doctorId) => {
  const doctor = await Doctor.findByPk(doctorId, { attributes: { exclude: ['password'] } });
  if (!doctor) throw new Error('Doctor not found');

  // Enrich clinics JSONB with actual clinic data
  if (doctor.clinics?.length) {
    const { Clinic } = await import('../../models/index.js');
    const clinicIds = doctor.clinics.map(c => c.clinic);
    const clinicRecords = await Clinic.findAll({
      where: { id: clinicIds },
      attributes: ['id', 'name', 'address', 'phone', 'email', 'isOpen', 'operatingHours']
    });
    const clinicMap = Object.fromEntries(clinicRecords.map(c => [c.id, c]));
    const enriched = doctor.toJSON();
    enriched.clinics = doctor.clinics.map(assoc => ({
      ...assoc,
      clinic: clinicMap[assoc.clinic] ? {
        id: assoc.clinic,
        name: clinicMap[assoc.clinic].name,
        address: clinicMap[assoc.clinic].address,
        phone: clinicMap[assoc.clinic].phone,
        email: clinicMap[assoc.clinic].email,
        isOpen: clinicMap[assoc.clinic].isOpen,
        operatingHours: clinicMap[assoc.clinic].operatingHours,
      } : { id: assoc.clinic }
    }));
    return enriched;
  }

  return doctor;
};

export const calculateDoctorStats = async (doctorId) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [totalServed, todayServed, activeWaiting, doctor] = await Promise.all([
    Queue.count({ where: { doctorId, status: 'served' } }),
    Queue.count({ where: { doctorId, status: 'served', servedAt: { [Op.gte]: today, [Op.lt]: tomorrow } } }),
    Queue.count({ where: { doctorId, status: 'waiting' } }),
    Doctor.findByPk(doctorId, { attributes: ['clinics'] })
  ]);
  return { totalPatientsServed: totalServed, todayPatients: todayServed, activeQueues: activeWaiting, clinicsCount: doctor?.clinics?.length || 0, recentActivity: [{ description: `Served ${todayServed} patients today`, time: 'Today' }, { description: `Total served: ${totalServed} patients`, time: 'All time' }, { description: `Active in ${doctor?.clinics?.length || 0} clinics`, time: 'Current' }] };
};

export const fetchDoctorsAvailableForClinic = async (clinicId) => {
  const allDoctors = await Doctor.findAll({ attributes: ['id', 'name', 'email', 'specialties', 'qualifications', 'licenseNumber', 'phone', 'clinics'] });
  return allDoctors.filter(doc => !doc.clinics?.some(c => c.clinic?.toString() === clinicId.toString())).map(doc => ({ id: doc.id, name: doc.name, email: doc.email, specialties: doc.specialties, qualifications: doc.qualifications, licenseNumber: doc.licenseNumber, phone: doc.phone }));
};

export const linkDoctorToClinic = async (doctorId, clinicId, data) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  if (doctor.clinics.some(c => c.clinic.toString() === clinicId.toString())) throw new Error('Doctor already associated with this clinic');
  doctor.clinics.push({ clinic: clinicId, consultationFee: data.consultationFee || 0, availableDays: data.availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], availableHours: data.availableHours || { start: '09:00', end: '17:00' }, isActive: true, isAvailable: false });
  doctor.changed('clinics', true);
  await doctor.save();
  return doctor;
};

export const handleProfilePhotoUpdate = async (doctor, newPhotoPath = null) => {
  const uploadDir = path.resolve('uploads/profiles');
  if (doctor.profilePhoto) { const oldPath = path.resolve(path.join(uploadDir, path.basename(doctor.profilePhoto))); if (oldPath.startsWith(uploadDir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath); }
  doctor.profilePhoto = newPhotoPath;
  await doctor.save();
  if (redisClient.isOpen) await Promise.all(doctor.clinics.map(c => redisClient.del(`doctors:clinic:${c.clinic}:public`)));
};
