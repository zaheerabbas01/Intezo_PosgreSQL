import { Queue, Clinic, Doctor, Patient } from '../../models/index.js';
import sequelize from '../../config/database.js';
import redisClient from '../../config/redis.js';
import { Op } from 'sequelize';
import FCMService from '../../services/fcmService.js';
import { calculateEstimatedWaitTime } from '../../utils/waitTimeCalculator.js';
import { resolveAdvanceNumber, shouldServeCurrentPatient } from './queue.transitions.js';

export const getQueueBroadcastPayload = async (clinicId, doctorId = null) => {
  const redisKey = doctorId ? `doctor:${doctorId}:clinic:${clinicId}:current` : `clinic:${clinicId}:current`;
  const [currentVal, queueEntries, clinic] = await Promise.all([
    redisClient.isOpen ? redisClient.get(redisKey) : '0',
    Queue.findAll({ where: { clinicId, doctorId: doctorId || null, status: 'waiting' }, order: [['number', 'ASC']], limit: 10, include: [{ association: 'patient', attributes: ['name'] }], raw: true, nest: true }),
    Clinic.findByPk(clinicId, { attributes: ['isOpen', 'operatingHours', 'averageProcessTime'] })
  ]);
  const currentNumber = parseInt(currentVal || 0);
  const upcoming = queueEntries.filter(q => q.number > currentNumber).map(q => ({ number: q.number, patientName: q.patientName || q.patient?.name || 'Unknown', isManualEntry: !!q.manualEntry }));
  const currentQueueEntry = currentNumber > 0 ? queueEntries.find(q => q.number === currentNumber) : null;
  return { currentNumber, currentQueueId: currentQueueEntry?.id || null, upcoming, totalWaiting: upcoming.length, avgWaitTime: clinic?.averageProcessTime || 15, hasNextPatient: upcoming.length > 0, hasCurrentPatient: !!currentQueueEntry, canCallNext: !!currentQueueEntry || upcoming.length > 0, clinicStatus: { isOpen: clinic?.isOpen || false, operatingHours: clinic?.operatingHours || {} }, isDoctorQueue: !!doctorId, timestamp: new Date().toISOString() };
};

export const generateNextNumber = async (clinicId, doctorId) => {
  const lastQueue = await Queue.findOne({ where: { clinicId, doctorId, bookedAt: { [Op.gte]: new Date().setHours(0, 0, 0, 0) } }, order: [['number', 'DESC']], attributes: ['number'] });
  return lastQueue ? lastQueue.number + 1 : 1;
};

export const processBooking = async ({ clinicId, patientId, doctorId, patientName }) => {
  const [doctor, clinic, patient] = await Promise.all([Doctor.findByPk(doctorId), Clinic.findByPk(clinicId), Patient.findByPk(patientId)]);
  if (!doctor) throw new Error('Doctor not found');
  if (!clinic || !clinic.isOpen) throw new Error('Clinic is closed or not found');
  if (!patient) throw new Error('Patient not found');
  const association = doctor.clinics.find(c => c.clinic.toString() === clinicId.toString());
  if (!association || !association.isActive) throw new Error('Doctor not active in this clinic');
  if (association.isAvailable === false) throw new Error('Doctor currently unavailable');
  const isPremium = patient.isPremium && patient.premiumExpiresAt > new Date();
  const activeWaiting = await Queue.count({ where: { patientId, status: 'waiting' } });
  if (activeWaiting > 0 && !isPremium) throw new Error('Active booking exists. Upgrade to Premium to book multiple queues.');
  const nextNumber = await Queue.getNextQueueNumber(clinicId, doctorId);
  const queueEntry = await Queue.create({ clinicId, doctorId, patientId, patientName: patientName?.trim() || patient.name, number: nextNumber, status: 'waiting', bookedAt: new Date() });
  const patientUpdates = { activeQueues: [...new Set([...(patient.activeQueues || []), queueEntry.id])] };
  if (!patient.currentQueue) patientUpdates.currentQueue = queueEntry.id;
  await patient.update(patientUpdates);
  const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
  if (redisClient.isOpen && !(await redisClient.get(redisKey))) await redisClient.set(redisKey, 0);
  const metrics = await calculateEstimatedWaitTime(clinicId, doctorId, nextNumber);
  return { queueEntry, doctor, metrics, patientName: patientName || patient.name };
};

export const updateDoctorAvailability = async (doctorId, isAvailable) => {
  return await sequelize.transaction(async (t) => {
    const doctor = await Doctor.findByPk(doctorId, { transaction: t });
    if (!doctor) throw new Error('Doctor not found');
    await doctor.update({ isAvailable, lastStatusChange: new Date() }, { transaction: t });
    if (!isAvailable) {
      const redisKey = `doctor:${doctorId}:clinic:${doctor.clinicId}:current`;
      if (redisClient.isOpen) await redisClient.set(redisKey, 0);
      const waitingQueues = await Queue.findAll({ where: { doctorId, status: 'waiting' }, attributes: ['id', 'patientId'], transaction: t });
      if (waitingQueues.length > 0) {
        const queueIds = waitingQueues.map(q => q.id);
        const patientIds = [...new Set(waitingQueues.map(q => q.patientId))];
        await Queue.update({ status: 'cancelled', cancelledAt: new Date() }, { where: { id: queueIds }, transaction: t });
        for (const pId of patientIds) {
          const patient = await Patient.findByPk(pId, { transaction: t });
          if (patient) {
            const finishedInThisBatch = waitingQueues.filter(q => q.patientId === pId).map(q => q.id);
            await patient.update({ activeQueues: (patient.activeQueues || []).filter(id => !finishedInThisBatch.includes(id)), queueHistory: [...new Set([...(patient.queueHistory || []), ...finishedInThisBatch])], currentQueue: finishedInThisBatch.includes(patient.currentQueue) ? null : patient.currentQueue }, { transaction: t });
          }
        }
      }
    }
    return doctor;
  });
};

const markPatientServed = async (queue, t) => {
  await queue.update({ status: 'served', servedAt: new Date() }, { transaction: t });
  if (queue.patient) {
    const patient = await Patient.findByPk(queue.patient.id, { transaction: t });
    const isPremium = patient.isPremium && patient.premiumExpiresAt > new Date();
    const activeQueues = (patient.activeQueues || []).filter(id => id !== queue.id);
    const updates = { activeQueues, queueHistory: [...new Set([...(patient.queueHistory || []), queue.id])] };
    if (!isPremium || patient.currentQueue === queue.id || activeQueues.length === 0) updates.currentQueue = null;
    await patient.update(updates, { transaction: t });
  }
};

export const advanceQueue = async ({ doctorId, clinicId, action, specificNumber }) => {
  return await sequelize.transaction(async (t) => {
    const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
    const currentServing = parseInt((await redisClient.get(redisKey)) || 0);
    let newNumber;
    let servedCurrentPatient = false;
    let nextPatient = null;

    if (action === 'next' || action === 'skip') {
      if (action === 'skip' && currentServing === 0) {
        throw new Error('NO_CURRENT_PATIENT');
      }
      nextPatient = await Queue.findOne({ where: { clinicId, doctorId, number: { [Op.gt]: currentServing }, status: 'waiting' }, order: [['number', 'ASC']], transaction: t });
      newNumber = resolveAdvanceNumber({
        action,
        currentServing,
        nextPatientNumber: nextPatient?.number
      });
    } else {
      newNumber = specificNumber;
    }

    // Mark the previously serving patient as served or skipped
    if (currentServing > 0) {
      const previousQueue = await Queue.findOne({ where: { clinicId, doctorId, number: currentServing, status: 'waiting' }, include: [{ association: 'patient' }], transaction: t });
      if (!previousQueue && action === 'skip') {
        throw new Error('NO_CURRENT_PATIENT');
      }

      const shouldServeCurrent = shouldServeCurrentPatient({
        action,
        currentServing,
        newNumber,
        hasCurrentQueue: !!previousQueue,
        hasFollowingPatient: !!nextPatient
      });

      if (previousQueue && (action === 'skip' || shouldServeCurrent)) {
        if (action === 'skip') {
          await previousQueue.update({ status: 'skipped', skippedAt: new Date() }, { transaction: t });
          if (previousQueue.patient) {
            const patient = await Patient.findByPk(previousQueue.patient.id, { transaction: t });
            const activeQueues = (patient.activeQueues || []).filter(id => id !== previousQueue.id);
            await patient.update({ activeQueues }, { transaction: t });
          }
        } else {
          await markPatientServed(previousQueue, t);
          servedCurrentPatient = true;
        }
      }
    }

    // Determine whether another patient remains after the newly called patient.
    const hasMoreAfter = newNumber > 0
      ? await Queue.findOne({ where: { clinicId, doctorId, number: { [Op.gt]: newNumber }, status: 'waiting' }, transaction: t })
      : null;

    if (redisClient.isOpen) await redisClient.set(redisKey, newNumber);

    const doctor = await Doctor.findByPk(doctorId, { transaction: t });
    if (doctor && servedCurrentPatient) {
      const clinics = [...doctor.clinics];
      const idx = clinics.findIndex(c => c.clinic.toString() === clinicId.toString());
      if (idx !== -1) { clinics[idx].patientsServed = (clinics[idx].patientsServed || 0) + 1; await doctor.update({ clinics }, { transaction: t }); }
    }

    const servedQueue = currentServing > 0
      ? await Queue.findOne({ where: { clinicId, doctorId, number: currentServing }, include: [{ association: 'patient' }], transaction: t })
      : null;

    return {
      newNumber,
      servedQueue: servedCurrentPatient ? servedQueue : null,
      doctor,
      hasNextPatient: !!hasMoreAfter,
      hasCurrentPatient: action === 'next' || action === 'skip'
        ? !!nextPatient
        : newNumber > 0,
      queueCompleted: (action === 'next' || action === 'skip') &&
        currentServing > 0 &&
        !nextPatient
    };
  });
};

export const getPublicQueueStatus = async (clinicId, doctorId) => {
  const current = parseInt((await redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`)) || '0');
  const [queueData, clinic] = await Promise.all([
    Queue.findAll({ where: { clinicId, doctorId, status: 'waiting' }, order: [['number', 'ASC']], attributes: ['number', 'patientName', 'id'], include: [{ association: 'patient', attributes: ['name'] }] }),
    Clinic.findByPk(clinicId, { attributes: ['averageProcessTime'] })
  ]);
  const upcoming = queueData.filter(q => q.number > current).map(q => ({ id: q.id, number: q.number, patientName: q.patientName || q.patient?.name || 'Unknown' }));
  const currentQueueEntry = current > 0 ? queueData.find(q => q.number === current) : null;
  return { current, currentQueueId: currentQueueEntry?.id || null, upcoming, avgWaitTime: clinic?.averageProcessTime || 15, totalWaiting: upcoming.length, hasNext: upcoming.length > 0, hasNextPatient: upcoming.length > 0, hasCurrentPatient: !!currentQueueEntry, canCallNext: !!currentQueueEntry || upcoming.length > 0 };
};

export const updateQueueStatus = async (queueId, newStatus, patientId = null) => {
  return await sequelize.transaction(async (t) => {
    const whereClause = { id: queueId };
    if (patientId) whereClause.patientId = patientId;
    const queue = await Queue.findOne({ where: whereClause, transaction: t });
    if (!queue) throw new Error('QUEUE_NOT_FOUND');
    const oldStatus = queue.status;
    const updateData = { status: newStatus };
    if (newStatus === 'cancelled') updateData.cancelledAt = new Date();
    if (newStatus === 'skipped') updateData.skippedAt = new Date();
    if (newStatus === 'waiting' && oldStatus === 'skipped') updateData.skippedAt = null;
    await queue.update(updateData, { transaction: t });
    if (queue.patientId) {
      const patient = await Patient.findByPk(queue.patientId, { transaction: t });
      if (patient) {
        const active = new Set(patient.activeQueues || []);
        const history = new Set(patient.queueHistory || []);
        if (newStatus === 'cancelled' || newStatus === 'served') { active.delete(queueId); history.add(queueId); if (patient.currentQueue === queueId) patient.currentQueue = null; }
        else if (newStatus === 'skipped') { active.delete(queueId); }
        else if (newStatus === 'waiting' && oldStatus === 'skipped') { active.add(queueId); }
        await patient.update({ activeQueues: Array.from(active), queueHistory: Array.from(history), currentQueue: patient.currentQueue }, { transaction: t });
      }
    }
    return queue;
  });
};

export const joinQueue = async (patientId, clinicId, doctorId) => {
  const [clinic, doctor, patient] = await Promise.all([Clinic.findByPk(clinicId), Doctor.findByPk(doctorId), Patient.findByPk(patientId)]);
  if (!clinic?.isOpen) throw new Error('Clinic is currently closed');
  if (!doctor?.isActive || !doctor?.isAvailable) throw new Error('Doctor is not available');
  if (!patient.phoneVerified) throw new Error('Phone number not verified');
  const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();
  const activeQueues = await Queue.findAll({ where: { patientId, status: 'waiting' } });
  if (activeQueues.length > 0) {
    if (!isPremiumActive) throw new Error('Free users can only have one active booking');
  }
  const nextNumber = await Queue.getNextQueueNumber(clinicId, doctorId);
  const queueEntry = await Queue.create({ clinicId, doctorId, patientId, number: nextNumber, status: 'waiting', bookedAt: new Date() });
  const updateData = { activeQueues: [...new Set([...(patient.activeQueues || []), queueEntry.id])] };
  if (!patient.currentQueue) updateData.currentQueue = queueEntry.id;
  await patient.update(updateData);
  const redisKey = `doctor:${doctorId}:clinic:${clinicId}:current`;
  if (redisClient.isOpen && !(await redisClient.get(redisKey))) await redisClient.set(redisKey, 0);
  return { queueEntry, doctor, nextNumber };
};

export const processCancellation = async (patientId, queueId = null) => {
  const patient = await Patient.findByPk(patientId);
  const queueToCancel = queueId ? await Queue.findOne({ where: { id: queueId, patientId, status: 'waiting' } }) : await Queue.findByPk(patient.currentQueue);
  if (!queueToCancel) throw new Error('Active booking not found');
  await queueToCancel.update({ status: 'cancelled', cancelledAt: new Date() });
  const isPremium = patient.isPremium && patient.premiumExpiresAt > new Date();
  const updatedActive = (patient.activeQueues || []).filter(id => id !== queueToCancel.id);
  const updateData = { activeQueues: updatedActive, queueHistory: [...new Set([...(patient.queueHistory || []), queueToCancel.id])] };
  if (!isPremium || patient.currentQueue?.toString() === queueToCancel.id.toString()) updateData.currentQueue = null;
  await patient.update(updateData);
  return queueToCancel;
};

export const getDoctorQueueState = async (doctorId, clinicId = null) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  const assoc = clinicId
    ? doctor.clinics.find(c => c.clinic.toString() === clinicId.toString() && c.isActive !== false)
    : doctor.clinics.find(c => c.isActive) || doctor.clinics[0];
  if (!assoc) throw new Error('Doctor not associated with any clinic');
  const targetClinicId = assoc.clinic;
  const redisKey = `doctor:${doctorId}:clinic:${targetClinicId}:current`;
  const [currentNumberRaw, waitingPatients, clinic] = await Promise.all([
    redisClient.isOpen ? redisClient.get(redisKey) : '0',
    Queue.findAll({ where: { doctorId, clinicId: targetClinicId, status: 'waiting' }, order: [['number', 'ASC']], limit: 10, include: [{ association: 'patient', attributes: ['name', 'phone'] }] }),
    Clinic.findByPk(targetClinicId, { attributes: ['id', 'name'] })
  ]);
  const current = parseInt(currentNumberRaw || 0);
  const upcoming = waitingPatients.filter(q => q.number > current);
  const currentQueue = current > 0 ? waitingPatients.find(q => q.number === current) : null;
  return { doctor: { name: doctor.name, specialty: doctor.specialties?.[0] || 'General Practitioner', isAvailable: assoc.isAvailable }, clinic: clinic ? { id: clinic.id, name: clinic.name } : null, clinicId: targetClinicId, currentNumber: current, currentQueueId: currentQueue?.id || null, upcoming, totalWaiting: upcoming.length, hasNextPatient: upcoming.length > 0, hasCurrentPatient: !!currentQueue, canCallNext: !!currentQueue || upcoming.length > 0 };
};

export const getPublicClinicDoctors = async (clinicId) => {
  const cacheKey = `doctors:clinic:${clinicId}:public`;
  if (redisClient.isOpen) { const cached = await redisClient.get(cacheKey); if (cached) return JSON.parse(cached); }
  const doctors = await Doctor.findAll({ where: sequelize.literal(`clinics @> '[{"clinic": "${clinicId}", "isActive": true}]'`), attributes: ['id', 'name', 'specialties', 'qualifications', 'profilePhoto', 'clinics'], order: [['name', 'ASC']] });
  const transformed = doctors.map(doc => { const assoc = doc.clinics.find(c => c.clinic === clinicId); return { id: doc.id, name: doc.name, specialty: doc.specialties?.[0], consultationFee: assoc?.consultationFee || 0, availableHours: assoc?.availableHours, isAvailable: assoc?.isAvailable, isActive: assoc?.isActive || true, profilePhoto: doc.profilePhoto }; });
  if (redisClient.isOpen) await redisClient.setEx(cacheKey, 120, JSON.stringify(transformed));
  return transformed;
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
  const queueEntry = await Queue.create({ clinicId, doctorId: doctor.id, patientId: null, patientName: name, number: nextNumber, status: 'waiting', bookedAt: new Date(), manualEntry: { phone, addedBy: 'clinic' } });
  const redisKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
  if (redisClient.isOpen) { const exists = await redisClient.get(redisKey); if (exists === null) await redisClient.set(redisKey, 0); }
  return { queueEntry, doctor, nextNumber };
};
