import { Clinic, Queue, Patient } from '../../models/index.js';
import redisClient from '../../config/redis.js';
import { Op } from 'sequelize';
import { resetAllDoctorQueuesForClinic, verifyAndFixRedisCounters } from '../../utils/queueReset.js';

export const checkDailyReset = async (clinicId) => {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  if (!redisClient.isOpen) return;
  const doctorIds = await Queue.findAll({
    where: { clinicId, bookedAt: { [Op.gte]: todayStart } },
    attributes: ['doctorId'],
    group: ['doctorId'],
    raw: true
  }).then(rows => rows.map(r => r.doctorId));
  for (const doctorId of doctorIds) {
    const todayBookings = await Queue.count({ where: { clinicId, doctorId, bookedAt: { [Op.gte]: todayStart } } });
    if (todayBookings === 0) {
      const currentServing = parseInt(await redisClient.get(`doctor:${doctorId}:current`) || 0);
      if (currentServing > 0) await redisClient.set(`doctor:${doctorId}:current`, 0);
    }
  }
};

export const formatQueueItem = (q) => ({ id: q.id, number: q.number, status: q.status, time: q.servedAt || q.cancelledAt || q.bookedAt, name: q.patientName || q.patient?.name || 'Anonymous', phone: q.manualEntry?.phone || q.patient?.phone || 'N/A', doctor: q.doctor ? { id: q.doctor.id, name: q.doctor.name, specialty: q.doctor.specialties?.[0] || 'General Practitioner' } : null, isManualEntry: !!q.manualEntry && !q.patient });

export const toggleClinicOperationalStatus = async (clinicId) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (!clinic) throw new Error('Clinic not found');
  const wasOpen = clinic.isOpen;
  clinic.isOpen = !clinic.isOpen;
  clinic.lastStatusChange = new Date();
  // Track manual close so the cron doesn't auto-reopen a deliberately closed clinic
  clinic.manuallyClosed = !clinic.isOpen; // true when closing, false when opening
  let resetCount = 0;
  if (wasOpen && !clinic.isOpen) resetCount = await resetAllDoctorQueuesForClinic(clinicId);
  await clinic.save();
  if (redisClient.isOpen) { await redisClient.del(`clinic:${clinicId}:status`); await redisClient.del('clinics:public:list'); }
  return { clinic, resetCount, wasOpen };
};

export const checkOperatingHours = (hours) => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = hours.opening.split(':').map(Number);
  const [closeH, closeM] = hours.closing.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  console.log(`checkOperatingHours: now=${nowMinutes}min, open=${openMinutes}min, close=${closeMinutes}min, result=${nowMinutes >= openMinutes && nowMinutes <= closeMinutes}`);
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
};

export const getDoctorsWithLiveQueue = async (clinicId, doctors, avgWaitTime = 15) => {
  return Promise.all(doctors.map(async (doctor) => {
    const association = doctor.clinics?.find(c => c.clinic?.toString() === clinicId.toString()) || doctor.clinics?.[0];
    const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
    const [currentServing, waitingCount] = await Promise.all([
      redisClient.isOpen ? redisClient.get(redisKey).then(val => parseInt(val || 0)) : 0,
      Queue.count({ where: { clinicId, doctorId: doctor.id, status: 'waiting' } })
    ]);
    return { id: doctor.id, name: doctor.name, specialty: doctor.specialties?.[0] || 'General Practitioner', profilePhoto: doctor.profilePhoto, consultationFee: association?.consultationFee || 0, availableDays: association?.availableDays || [], isActive: association?.isActive || false, queueInfo: { current: currentServing, nextNumber: currentServing + 1, totalWaiting: waitingCount, avgWaitTime } };
  }));
};

export const findPatientHistory = async (clinicId, identifier) => {
  const searchConditions = [{ patient: identifier }, { patientName: { [Op.like]: `%${identifier}%` } }];
  if (/^[\d\+\-\s\(\)]+$/.test(identifier)) {
    searchConditions.push({ 'manualEntry.phone': identifier });
    const patientIds = await Patient.findAll({ where: { phone: identifier }, attributes: ['id'], raw: true }).then(pts => pts.map(p => p.id));
    if (patientIds.length > 0) searchConditions.push({ patient: { [Op.in]: patientIds } });
  }
  return Queue.findAll({ where: { clinicId, status: { [Op.in]: ['served', 'cancelled'] }, [Op.or]: searchConditions }, include: [{ association: 'doctor', attributes: ['name', 'specialties'] }, { association: 'patient', attributes: ['name', 'phone'] }], order: [['updatedAt', 'DESC']], limit: 50, raw: true });
};

export const addManualPatientToQueue = async ({ name, phone, doctorId, clinicId }) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (!clinic || !clinic.isOpen) throw new Error('Clinic is currently closed');
  let doctor;
  if (doctorId) {
    doctor = await Doctor.findByPk(doctorId);
    if (!doctor) throw new Error('Doctor not found');
    const association = doctor.clinics.find(c => c.clinic.toString() === clinicId.toString());
    if (!association || !association.isActive) throw new Error('Doctor not active in this clinic');
    if (association.isAvailable === false) throw new Error('Doctor is not available');
  } else {
    doctor = await Doctor.findOne({ where: { '$clinics.clinic$': clinicId, '$clinics.isActive$': true, '$clinics.isAvailable$': { [Op.ne]: false } } });
    if (!doctor) throw new Error('No available doctors found');
  }
  const nextNumber = await Queue.getNextQueueNumber(clinicId, doctor.id);
  const queueEntry = await Queue.create({ clinicId, doctorId: doctor.id, patient: null, patientName: name, number: nextNumber, status: 'waiting', bookedAt: new Date(), manualEntry: { phone, addedBy: 'clinic' } });
  const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
  if (redisClient.isOpen) { const exists = await redisClient.get(redisKey); if (exists === null) await redisClient.set(redisKey, 0); }
  return { queueEntry, doctor, nextNumber };
};

export const resetClinicQueues = async (clinicId) => resetAllDoctorQueuesForClinic(clinicId);
export const verifyAndSyncRedisCounters = async (clinicId) => verifyAndFixRedisCounters(clinicId);
export const getDebugQueueData = async (clinicId) => Queue.findAll({ where: { clinicId }, include: [{ association: 'patient', attributes: ['name', 'phone'] }, { association: 'doctor', attributes: ['name'] }], order: [['updatedAt', 'DESC']], limit: 20 });
export const getDoctorQueueSummary = async (clinicId, doctorId) => { const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`; const [current, waiting] = await Promise.all([redisClient.isOpen ? redisClient.get(redisKey).then(v => parseInt(v || 0)) : 0, Queue.count({ where: { clinicId, doctor: doctorId, status: 'waiting' } })]); return { doctorId, current, waiting }; };
export const getClinicSummaryData = async (clinicId) => { const clinic = await Clinic.findByPk(clinicId, { attributes: ['id', 'name', 'isOpen', 'operatingHours', 'lastStatusChange'] }); if (!clinic) throw new Error('Clinic not found'); return clinic; };
