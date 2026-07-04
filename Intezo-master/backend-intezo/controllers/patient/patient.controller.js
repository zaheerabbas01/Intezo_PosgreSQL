import * as patientService from './patient.service.js';
import * as queueService from '../queue/queue.service.js';
import { triggerQueueUpdate } from '../queue/queue.controller.js';
import { notifyNearbyPatients } from '../notification/notification.service.js';
import { Patient, Queue } from '../../models/index.js';
import { Op } from 'sequelize';

export const registerPatient = async (req, res) => {
  try {
    const patient = await patientService.createPatient(req.body);
    res.status(201).json({ message: 'Patient registered successfully', patient });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getPatientProfile = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient.id, {
      attributes: {
        exclude: [
          'password',
          'verificationCode',
          'verificationCodeExpires',
          'whatsappVerificationTokenHash'
        ]
      }
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await Patient.update({ fcmToken }, { where: { id: req.patient.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCurrentQueueStatus = async (req, res) => {
  try {
    let patient = await Patient.findByPk(req.patient.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    patient = await patientService.synchronizePatientQueues(patient);
    const isPremiumActive = patient.isPremium && patient.premiumExpiresAt > new Date();

    const activeQueues = await Queue.findAll({
      where: { patientId: patient.id, status: { [Op.in]: ['waiting', 'skipped'] } },
      include: [{ association: 'clinic' }, { association: 'doctor' }],
      order: [['bookedAt', 'ASC']]
    });

    if (activeQueues.length === 0) return res.status(404).json({ error: 'No active queue found' });

    const enrichedQueues = await Promise.all(activeQueues.map(async (q) => {
      const stats = await patientService.getQueuePositionDetails(q);
      return {
        queueId: q.id, number: q.number, status: q.status, bookedAt: q.bookedAt, ...stats,
        clinic: { id: q.clinic.id, name: q.clinic.name, address: q.clinic.address },
        doctor: q.doctor ? { id: q.doctor.id, name: q.doctor.name, specialty: q.doctor.specialty } : null
      };
    }));

    if (isPremiumActive) return res.json({ isPremium: true, activeBookings: enrichedQueues, totalActive: enrichedQueues.length });
    res.json({ isPremium: false, currentQueue: enrichedQueues[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { queueId } = req.body;
    const cancelled = await queueService.processCancellation(req.patient.id, queueId);

    setImmediate(async () => {
      await triggerQueueUpdate(cancelled.clinicId, cancelled.doctorId);
      const redisClient = (await import('../../config/redis.js')).default;
      const currentNum = parseInt(await redisClient.get(`doctor:${cancelled.doctorId}:clinic:${cancelled.clinicId}:current`)) || 0;
      await notifyNearbyPatients(cancelled.clinicId, cancelled.doctorId, currentNum);
    });

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const registerPatientAndAddToQueue = async (req, res) => {
  try {
    const { clinicId, doctorId, ...patientData } = req.body;
    if (!clinicId || !doctorId) return res.status(400).json({ error: 'clinicId and doctorId are required' });

    const patient = await patientService.createPatient(patientData);
    const result = await queueService.joinQueue(patient.id, clinicId, doctorId);
    setImmediate(() => triggerQueueUpdate(clinicId, doctorId));

    res.status(201).json({
      patientId: patient.id,
      queueNumber: result.nextNumber,
      doctor: { name: result.doctor.name, specialty: result.doctor.specialty }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updatePatientInfo = async (req, res) => {
  try {
    if (String(req.patient?.id) !== String(req.params.patientId)) {
      return res.status(403).json({ error: 'You can only update your own patient record' });
    }
    const { name, email } = req.body;
    const patient = await patientService.updatePatientDetails(req.patient.id, { name, email });
    res.json(patient);
  } catch (err) {
    res.status(err.message === 'Patient not found' ? 404 : 500).json({ error: err.message });
  }
};

export const getPatientQueueHistory = async (req, res) => {
  try {
    if (String(req.patient?.id) !== String(req.params.patientId)) {
      return res.status(403).json({ error: 'You can only access your own patient history' });
    }
    const history = await patientService.getHistoryFromSource(req.patient.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
