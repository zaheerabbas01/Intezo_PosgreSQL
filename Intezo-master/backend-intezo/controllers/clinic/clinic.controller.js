import * as clinicService from './clinic.service.js';
import * as queueService from '../queue/queue.service.js';
import FCMService from '../../services/fcmService.js';
import { Clinic, Queue, Doctor } from '../../models/index.js';
import { Op } from 'sequelize';
import { cleanupFailedUpload, deleteProfilePhotoAsset, persistProfilePhoto } from '../../middleware/upload.js';

export const getClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic.id);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
    res.json(clinic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateClinic = async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone', 'address', 'services', 'operatingHours'];
    const updates = Object.keys(req.body);
    const isValid = updates.every(u => allowedUpdates.includes(u));
    if (!isValid) return res.status(400).json({ error: 'Invalid updates!' });

    const clinic = await Clinic.findByPk(req.clinic.id);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    await clinic.update(req.body);
    res.json(clinic);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic.id);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
    await clinic.destroy();
    res.json({ message: 'Clinic deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getQueueAnalytics = async (req, res) => {
  try {
    const clinicId = req.clinic.id;
    await clinicService.checkDailyReset(clinicId);

    const [waiting, served, cancelled] = await Promise.all([
      Queue.findAll({ where: { clinicId, status: 'waiting' }, include: [{ association: 'patient' }, { association: 'doctor' }], order: [['number', 'ASC']] }),
      Queue.findAll({ where: { clinicId, status: 'served' }, include: [{ association: 'patient' }, { association: 'doctor' }], order: [['servedAt', 'DESC']], limit: 50 }),
      Queue.findAll({ where: { clinicId, status: 'cancelled' }, include: [{ association: 'patient' }, { association: 'doctor' }], order: [['cancelledAt', 'DESC']], limit: 50 })
    ]);

    res.json({
      waiting: waiting.map(clinicService.formatQueueItem),
      served: served.map(clinicService.formatQueueItem),
      cancelled: cancelled.map(clinicService.formatQueueItem)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleClinicStatus = async (req, res) => {
  try {
    const { clinic, resetCount, wasOpen } = await clinicService.toggleClinicOperationalStatus(req.clinic.id);

    if (!wasOpen && clinic.isOpen) {
      await FCMService.sendClinicOpenNotification(clinic.id, clinic.name);
    }

    try {
      const { getIO } = await import('../../config/pusher.js');
      const io = getIO();
      if (io) io.emit('clinic_status_updated', { clinicId: clinic.id, isOpen: clinic.isOpen, lastStatusChange: clinic.lastStatusChange, resetCount });
    } catch (e) { console.error('Pusher error', e); }

    res.json({ success: true, isOpen: clinic.isOpen, message: clinic.isOpen ? 'Clinic is now open' : `Closed. ${resetCount} queues reset.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getClinicStatus = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic.id, { attributes: ['isOpen', 'operatingHours', 'lastStatusChange', 'name'] });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
    const isWithinOperatingHours = clinic.operatingHours ? clinicService.checkOperatingHours(clinic.operatingHours) : true;
    res.json({ ...clinic.toJSON(), isWithinOperatingHours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDoctorQueueFast = async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;
    const cacheKey = `doctor:queue:${doctorId}:${clinicId}`;
    const redisClient = (await import('../../config/redis.js')).default;

    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const [currentServing, waitingPatients, doctor] = await Promise.all([
      redisClient.isOpen ? redisClient.get(`doctor:${doctorId}:clinic:${clinicId}:current`) : 0,
      Queue.findAll({ where: { clinicId, doctor: doctorId, status: 'waiting' }, attributes: ['number', 'patientName'], include: [{ association: 'patient', attributes: ['name'] }], order: [['number', 'ASC']], limit: 5 }),
      Doctor.findByPk(doctorId, { attributes: ['name', 'specialties'] })
    ]);

    const response = {
      current: parseInt(currentServing || 0),
      nextNumber: parseInt(currentServing || 0) + 1,
      upcoming: waitingPatients.map(q => ({ number: q.number, patientName: q.patientName || q.patient?.name || 'Patient' })),
      doctor: { name: doctor?.name || 'Doctor', specialty: doctor?.specialties?.[0] || 'General Practitioner' }
    };

    if (redisClient.isOpen) await redisClient.setEx(cacheKey, 15, JSON.stringify(response));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getBatchDoctorQueues = async (req, res) => {
  try {
    const { doctorIds } = req.body;
    const { clinicId } = req.params;
    if (!doctorIds?.length) return res.json([]);
    const results = await Promise.all(doctorIds.map(doctorId => clinicService.getDoctorQueueSummary(clinicId, doctorId)));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getClinicSummary = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const summary = await clinicService.getClinicSummaryData(clinicId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getClinicsPublic = async (req, res) => {
  try {
    const cacheKey = 'clinics:public:list';
    const redisClient = (await import('../../config/redis.js')).default;

    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const clinics = await Clinic.findAll({ attributes: ['id', 'name', 'phone', 'address', 'services', 'operatingHours', 'isOpen', 'profilePhoto'], raw: true });

    if (redisClient.isOpen) await redisClient.setEx(cacheKey, 300, JSON.stringify(clinics));
    res.json(clinics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getClinicComplete = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const cacheKey = `clinic:complete:${clinicId}`;
    const redisClient = (await import('../../config/redis.js')).default;

    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const [clinic, doctors] = await Promise.all([
      Clinic.findByPk(clinicId, { raw: true }),
      Doctor.findAll({ where: { '$clinics.clinic$': clinicId, '$clinics.isActive$': true }, attributes: ['id', 'name', 'specialties', 'profilePhoto', 'clinics'], raw: true })
    ]);

    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    const doctorsWithQueue = await clinicService.getDoctorsWithLiveQueue(clinicId, doctors, clinic.averageProcessTime);
    const response = { clinic, doctors: doctorsWithQueue, timestamp: new Date() };

    if (redisClient.isOpen) await redisClient.setEx(cacheKey, 30, JSON.stringify(response));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRecentClinics = async (req, res) => {
  try {
    const { clinicIds } = req.body;
    if (!clinicIds?.length) return res.json([]);

    const cacheKey = `clinics:recent:${[...clinicIds].sort().join(',')}`;
    const redisClient = (await import('../../config/redis.js')).default;

    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const clinics = await Clinic.findAll({ where: { id: { [Op.in]: clinicIds } }, attributes: ['id', 'name', 'address', 'isOpen', 'operatingHours'], raw: true });
    const ordered = clinicIds.map(id => clinics.find(c => c.id.toString() === id.toString())).filter(Boolean);

    if (redisClient.isOpen) await redisClient.setEx(cacheKey, 120, JSON.stringify(ordered));
    res.json(ordered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resetAllQueues = async (req, res) => {
  try {
    const count = await clinicService.resetClinicQueues(req.clinic.id);
    res.json({ success: true, message: `${count} queues reset` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const debugQueueStatus = async (req, res) => {
  try {
    const data = await clinicService.getDebugQueueData(req.clinic.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const clinic = await Clinic.findByPk(req.clinic.id);
    const previousPhoto = clinic.profilePhoto;
    clinic.profilePhoto = await persistProfilePhoto(req.file, 'clinic', clinic.id);
    await clinic.save();
    await deleteProfilePhotoAsset(previousPhoto).catch(console.error);
    const redisClient = (await import('../../config/redis.js')).default;
    if (redisClient.isOpen) await redisClient.del('clinics:public:list');
    res.json({ success: true, profilePhoto: clinic.profilePhoto });
  } catch (err) {
    await cleanupFailedUpload(req.file);
    res.status(500).json({ error: err.message });
  }
};

export const deleteProfilePhoto = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic.id);
    if (!clinic?.profilePhoto) return res.status(400).json({ error: 'No photo to delete' });
    const previousPhoto = clinic.profilePhoto;
    clinic.profilePhoto = null;
    await clinic.save();
    await deleteProfilePhotoAsset(previousPhoto).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const checkOperationHours = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.clinic.id);
    const isWithinHours = clinicService.checkOperatingHours(clinic.operatingHours);
    let resetCount = 0;
    if (!isWithinHours && clinic.isOpen) {
      const update = await clinicService.toggleClinicOperationalStatus(clinic.id);
      resetCount = update.resetCount;
    }
    res.json({ success: true, isOpen: clinic.isOpen, isWithinHours, resetCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyRedisCounters = async (req, res) => {
  try {
    const result = await clinicService.verifyAndSyncRedisCounters(req.clinic.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPatientHistoryForClinic = async (req, res) => {
  try {
    const { patientId } = req.params;
    const history = await clinicService.findPatientHistory(req.clinic.id, patientId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addPatientToQueue = async (req, res) => {
  try {
    const { name, phone, doctorId } = req.body;
    const clinicId = req.clinic.id;

    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    const cleanPhone = phone.replace(/\D/g, '');
    if (!/^(\+92|92|0)?3\d{9}$/.test(cleanPhone)) return res.status(400).json({ error: 'Please enter a valid Pakistani phone number' });

    const { queueEntry, doctor, nextNumber } = await queueService.addManualPatientToQueue({ name, phone: cleanPhone, doctorId, clinicId });

    try {
      const { triggerQueueUpdate } = await import('../queue/queue.controller.js');
      await triggerQueueUpdate(clinicId, doctor.id);
    } catch (e) {
      console.warn('Real-time update failed, but patient was added to DB');
    }

    res.status(201).json({
      success: true, queueNumber: nextNumber, patientName: name,
      doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialties?.[0] || 'General Practitioner' },
      message: `Patient added! Queue number: ${nextNumber}`
    });
  } catch (err) {
    const status = err.message.includes('closed') || err.message.includes('not available') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};
