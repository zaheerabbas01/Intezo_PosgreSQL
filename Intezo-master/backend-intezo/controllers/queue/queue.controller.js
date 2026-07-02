import * as queueService from './queue.service.js';
import * as doctorService from '../doctor/doctor.service.js';
import FCMService from '../../services/fcmService.js';
import { emitToClinic, emitToDoctor } from '../../config/pusher.js';
import { Queue, Clinic, Patient } from '../../models/index.js';
import sequelize from '../../config/database.js';
import redisClient from '../../config/redis.js';
import { Op } from 'sequelize';

export const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && uuidRegex.test(id);
};

export const validateNumeric = (value, min = 0) => {
  const num = parseInt(value, 10);
  return (isNaN(num) || num < min) ? null : num;
};

const createHttpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const getAssociationClinicId = (association) => {
  const clinic = association?.clinic;
  return clinic && typeof clinic === 'object' ? clinic.id || clinic._id : clinic;
};

const resolveQueueClinicId = (req, doctorId) => {
  if (!doctorId) throw createHttpError('Doctor ID is required', 400);

  if (req.clinic) return req.clinic.id;
  if (!req.doctor) throw createHttpError('Authenticated clinic or doctor is required', 401);
  if (String(req.doctor.id) !== String(doctorId)) {
    throw createHttpError('Doctors can only manage their own queues', 403);
  }

  const requestedClinicId = req.body?.clinicId || req.query?.clinicId;
  const associations = Array.isArray(req.doctor.clinics) ? req.doctor.clinics : [];
  const association = requestedClinicId
    ? associations.find(item => String(getAssociationClinicId(item)) === String(requestedClinicId) && item.isActive !== false)
    : associations.find(item => item.isActive) || associations[0];

  if (!association) {
    throw createHttpError('Doctor is not active in the selected clinic', 403);
  }
  return getAssociationClinicId(association);
};

const authorizeQueueMutation = async (req, queueId) => {
  const queue = await Queue.findByPk(queueId);
  if (!queue) throw createHttpError('Queue entry not found', 404);

  if (req.clinic && String(queue.clinicId) !== String(req.clinic.id)) {
    throw createHttpError('Queue entry does not belong to this clinic', 403);
  }
  if (req.doctor && String(queue.doctorId) !== String(req.doctor.id)) {
    throw createHttpError('Queue entry does not belong to this doctor', 403);
  }

  const requestedClinicId = req.body?.clinicId || req.query?.clinicId;
  if (requestedClinicId && String(queue.clinicId) !== String(requestedClinicId)) {
    throw createHttpError('Queue entry does not belong to the selected clinic', 403);
  }
  return queue;
};

export const triggerQueueUpdate = async (clinicId, doctorId = null, manualData = null) => {
  try {
    const broadcastData = manualData || await queueService.getQueueBroadcastPayload(clinicId, doctorId);
    emitToClinic(clinicId, 'queue_updated', { ...broadcastData, doctorId });
    if (doctorId) emitToDoctor(doctorId, 'queue_updated', { ...broadcastData, doctorId });
    return broadcastData;
  } catch (err) {
    console.error('Queue broadcast failed:', err);
    return null;
  }
};

export const refreshQueueStatus = async (req, res) => {
  try {
    const data = await triggerQueueUpdate(req.query.clinicId, req.query.doctorId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const bookNumber = async (req, res) => {
  try {
    const { clinicId, patientId, doctorId, patientName } = req.body;
    const result = await queueService.processBooking({ clinicId, patientId, doctorId, patientName });

    setImmediate(async () => {
      await triggerQueueUpdate(clinicId, doctorId);
      const waitTimePayload = { currentNumber: result.metrics.currentlyServing, avgProcessTimeMinutes: result.metrics.avgProcessTimeMinutes, newBooking: true, timestamp: new Date().toISOString() };
      emitToDoctor(doctorId, 'wait_time_updated', waitTimePayload);
      emitToClinic(clinicId, 'wait_time_updated', waitTimePayload);
    });

    res.status(201).json({
      queueNumber: result.queueEntry.number, estimatedWait: result.metrics.estimatedWaitMinutes,
      estimatedWaitTime: result.metrics.estimatedWaitTime, patientsAhead: result.metrics.patientsAhead,
      currentlyServing: result.metrics.currentlyServing,
      doctor: { name: result.doctor.name, specialty: result.doctor.specialty },
      patientName: result.patientName
    });
  } catch (err) {
    console.error('Booking failed:', err.message);
    res.status(400).json({ error: err.message });
  }
};

export const cancelNumber = async (req, res) => {
  try {
    const { queueId } = req.params;
    const patientId = req.patient?.id || req.body.patientId;
    const queue = await updateQueueStatus(queueId, 'cancelled', patientId);
    setImmediate(() => triggerQueueUpdate(queue.clinicId, queue.doctorId));
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

export const getCurrentQueue = async (req, res) => {
  try {
    const data = await getPublicQueueStatus(req.query.clinicId, req.query.doctorId);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getQueueDataForPublic = async (clinicId, doctorId) => {
  return getPublicQueueStatus(clinicId, doctorId);
};

export const getWaitTime = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;
    const { calculateEstimatedWaitTime } = await import('../../utils/waitTimeCalculator.js');
    res.json(await calculateEstimatedWaitTime(clinicId, doctorId));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getPatientSpecificWaitTime = async (req, res) => {
  try {
    const { getPatientWaitTime } = await import('../../utils/waitTimeCalculator.js');
    res.json(await getPatientWaitTime(req.params.queueId));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getDetailedQueueWithWaitTimes = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;
    const { getQueueWithWaitTimes } = await import('../../utils/waitTimeCalculator.js');
    res.json(await getQueueWithWaitTimes(clinicId, doctorId));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const skipPatient = async (req, res) => {
  try {
    const { doctorId } = req.body;
    const clinicId = resolveQueueClinicId(req, doctorId);
    const { newNumber, hasNextPatient, hasCurrentPatient, queueCompleted } = await queueService.advanceQueue({ doctorId, clinicId, action: 'skip' });
    setImmediate(() => triggerQueueUpdate(clinicId, doctorId));
    res.json({ success: true, currentNumber: newNumber, hasNextPatient, hasCurrentPatient, queueCompleted });
  } catch (err) {
    const status = err.statusCode || (['NO_MORE_PATIENTS', 'NO_CURRENT_PATIENT'].includes(err.message) ? 400 : 500);
    res.status(status).json({ error: err.message });
  }
};

export const getSkippedPatients = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const clinicId = resolveQueueClinicId(req, doctorId);

    const skipped = await Queue.findAll({
      where: { clinicId, doctorId, status: 'skipped' },
      include: [{ association: 'patient', attributes: ['name', 'phone'] }],
      order: [['updatedAt', 'ASC']]
    });
    const result = skipped.map(q => ({
      id: q.id,
      number: q.number,
      name: q.patientName || q.patient?.name || 'Unknown',
      phone: q.manualEntry?.phone || q.patient?.phone || null,
      skippedAt: q.skippedAt
    }));
    res.json(result);
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
};

export const serveSkippedPatient = async (req, res) => {
  try {
    await authorizeQueueMutation(req, req.params.queueId);
    const queue = await updateQueueStatus(req.params.queueId, 'served');
    setImmediate(() => triggerQueueUpdate(queue.clinicId, queue.doctorId));
    res.json({ success: true, message: 'Patient served' });
  } catch (err) { res.status(err.statusCode || 400).json({ error: err.message }); }
};

export const callSkippedPatient = async (req, res) => {
  try {
    await authorizeQueueMutation(req, req.params.queueId);
    const queue = await updateQueueStatus(req.params.queueId, 'waiting');
    setImmediate(() => triggerQueueUpdate(queue.clinicId, queue.doctorId));
    res.json({ success: true, message: 'Patient called back' });
  } catch (err) { res.status(err.statusCode || 400).json({ error: err.message }); }
};

export const toggleDoctorStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { isAvailable } = req.body;
    if (!isValidUUID(doctorId)) return res.status(400).json({ error: 'Invalid Doctor ID' });
    if (typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'isAvailable must be boolean' });
    const doctor = await doctorService.updateDoctorAvailability(doctorId, isAvailable);
    setImmediate(() => triggerQueueUpdate(doctor.clinicId, doctor.id));
    res.json({ success: true, doctor: { id: doctor.id, name: doctor.name, isAvailable: doctor.isAvailable } });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const updateCurrentNumber = async (req, res) => {
  try {
    const { doctorId, action, newNumber: specificNumber } = req.body;
    const clinicId = resolveQueueClinicId(req, doctorId);
    const { newNumber, servedQueue, doctor, hasNextPatient, hasCurrentPatient, queueCompleted } = await queueService.advanceQueue({ doctorId, clinicId, action, specificNumber });
    const clinic = req.clinic || await Clinic.findByPk(clinicId, { attributes: ['id', 'name'] });
    const clinicName = clinic?.name || 'Clinic';

    setImmediate(async () => {
      await triggerQueueUpdate(clinicId, doctorId);
      if (servedQueue?.patient) {
        FCMService.sendPatientServedNotification(servedQueue.patient.id, clinicName, doctor.name, servedQueue.id).catch(e => console.error('FCM Served Error:', e));
      }
      const upcoming = await Queue.findAll({ where: { clinicId, doctorId, number: { [Op.gt]: newNumber }, status: 'waiting' }, order: [['number', 'ASC']], limit: 3, include: ['patient'] });
      upcoming.forEach((u, index) => {
        if (u.patient) setTimeout(() => FCMService.sendQueueNotification(u.patient.id, newNumber, u.number, clinicName, doctor.name).catch(e => console.error('FCM Queue Error:', e)), index * 1000);
      });
    });

    res.json({ success: true, currentNumber: newNumber, hasNextPatient, hasCurrentPatient, queueCompleted, servedPatient: !!servedQueue });
  } catch (err) {
    res.status(err.statusCode || (err.message === 'NO_MORE_PATIENTS' ? 400 : 500)).json({ error: err.message });
  }
};

export const getPublicQueueStatus = async (clinicId, doctorId) => {
  const current = parseInt((await redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`)) || '0');
  const [queueData, clinic] = await Promise.all([
    Queue.findAll({ where: { clinicId, ...(doctorId && doctorId !== 'null' ? { doctorId } : {}), status: 'waiting' }, order: [['number', 'ASC']], attributes: ['number', 'patientName', 'id'], include: [{ association: 'patient', attributes: ['name'] }] }),
    Clinic.findByPk(clinicId, { attributes: ['averageProcessTime'] })
  ]);
  const upcoming = queueData.filter(q => q.number > current).map(q => ({ id: q.id, number: q.number, patientName: q.patientName || q.patient?.name || 'Unknown' }));
  const currentQueueEntry = current > 0 ? queueData.find(q => q.number === current) : null;
  return {
    current,
    currentQueueId: currentQueueEntry?.id || null,
    upcoming,
    avgWaitTime: clinic?.averageProcessTime || 15,
    totalWaiting: upcoming.length,
    hasNext: upcoming.length > 0,
    hasNextPatient: upcoming.length > 0,
    hasCurrentPatient: !!currentQueueEntry,
    canCallNext: !!currentQueueEntry || upcoming.length > 0
  };
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
