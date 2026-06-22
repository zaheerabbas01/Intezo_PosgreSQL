import { Patient, Queue } from '../../models/index.js';
import redisClient from '../../config/redis.js';
import { Op } from 'sequelize';

export const synchronizePatientQueues = async (patient) => {
  const servedOrCancelled = await Queue.findAll({ where: { patientId: patient.id, status: { [Op.in]: ['served', 'cancelled'] }, id: { [Op.in]: patient.activeQueues || [] } } });
  if (servedOrCancelled.length === 0) return patient;
  const finishedIds = servedOrCancelled.map(q => q.id);
  await patient.update({ activeQueues: (patient.activeQueues || []).filter(id => !finishedIds.includes(id)), queueHistory: [...new Set([...(patient.queueHistory || []), ...finishedIds])], currentQueue: finishedIds.includes(patient.currentQueue) ? null : patient.currentQueue });
  return patient;
};

export const getQueuePositionDetails = async (queue) => {
  const redisKey = queue.doctorId ? `doctor:${queue.doctorId}:clinic:${queue.clinicId}:current` : `clinic:${queue.clinicId}:current`;
  const currentServing = parseInt((await redisClient.get(redisKey)) || 0);
  const patientsAhead = await Queue.count({ where: { clinicId: queue.clinicId, doctorId: queue.doctorId || null, status: 'waiting', number: { [Op.gt]: currentServing, [Op.lt]: queue.number } } });
  const avgTime = queue.clinic?.averageProcessTime || 15;
  return { currentServing, positionInQueue: patientsAhead, estimatedWait: patientsAhead * avgTime };
};

export const updatePatientDetails = async (patientId, updateData) => {
  const [rowsUpdated, [updatedPatient]] = await Patient.update(updateData, { where: { id: patientId }, returning: true });
  if (rowsUpdated === 0) throw new Error('Patient not found');
  return updatedPatient;
};

export const getHistoryFromSource = async (patientId) => {
  const cacheKey = `patient:${patientId}:history`;
  if (redisClient.isOpen) {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Invalidate cache if entries are missing clinic.id
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].clinic && !parsed[0].clinic.id) {
          await redisClient.del(cacheKey);
        } else if (Array.isArray(parsed)) return parsed;
      } catch (e) { await redisClient.del(cacheKey); }
    }
  }
  const history = await Queue.findAll({ where: { patientId, status: { [Op.in]: ['served', 'cancelled'] } }, include: [{ association: 'clinic', attributes: ['id', 'name', 'address'] }, { association: 'doctor', attributes: ['name'] }], order: [['updatedAt', 'DESC']], attributes: ['number', 'status', 'bookedAt', 'servedAt', 'updatedAt', 'patientName'], limit: 50 });
  if (redisClient.isOpen && history.length > 0) await redisClient.setEx(cacheKey, 60, JSON.stringify(history));
  return history;
};

export const createPatient = async (data) => {
  return await Patient.create(data);
};
