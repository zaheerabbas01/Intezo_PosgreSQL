import express from 'express';
import {
  getClinic,
  updateClinic,
  deleteClinic,
  getQueueAnalytics,
  toggleClinicStatus,
  getClinicStatus,
  debugQueueStatus,
  getClinicsPublic,
  getRecentClinics,
  resetAllQueues,
  getClinicComplete,
  getDoctorQueueFast,
  getBatchDoctorQueues,
  getClinicSummary,
  uploadProfilePhoto,
  deleteProfilePhoto,
  checkOperationHours,
  verifyRedisCounters,
  addPatientToQueue,
  getPatientHistoryForClinic
} from '../controllers/clinicController.js';
import { authenticate, authorizeClinic } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { loginClinic, registerClinic } from '../controllers/authController.js';
import Clinic from '../models/Clinic.js';
import Queue from '../models/Queue.js';
import Patient from '../models/Patient.js';
import { Op } from 'sequelize';

const router = express.Router();

// Public routes
router.post('/register', registerClinic);
router.post('/login', loginClinic);
router.get('/public', getClinicsPublic);
router.post('/recent', getRecentClinics);

// OPTIMIZED: New fast loading endpoints
router.get('/:clinicId/complete', getClinicComplete); // Get clinic + doctors + queues in one call
router.get('/:clinicId/summary', getClinicSummary); // Quick clinic overview
router.get('/:clinicId/doctors/:doctorId/queue-fast', getDoctorQueueFast); // Fast doctor queue
router.post('/:clinicId/batch-queues', getBatchDoctorQueues); // Batch queue data

// In clinicRoutes.js - Add public status route
router.get('/:clinicId/status', async (req, res) => {
  try {
    const { clinicId } = req.params;
    const clinic = await Clinic.findByPk(clinicId, {
      attributes: ['isOpen', 'operatingHours', 'lastStatusChange', 'name']
    });

    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json({
      isOpen: clinic.isOpen,
      operatingHours: clinic.operatingHours,
      lastStatusChange: clinic.lastStatusChange,
      name: clinic.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Protected routes
router.use(authenticate, authorizeClinic);
// Authenticated clinic status endpoint
router.get('/status', getClinicStatus);
router.get('/profile', getClinic);
router.put('/profile', updateClinic);
router.delete('/profile', deleteClinic);
router.get('/analytics', getQueueAnalytics);
router.post('/toggle-status', toggleClinicStatus);
router.post('/reset-all-queues', resetAllQueues);
router.post('/verify-redis-counters', verifyRedisCounters);
router.post('/check-operation-hours', checkOperationHours);
router.get('/debug-queue', debugQueueStatus);
router.post('/upload-photo', upload.single('profilePhoto'), uploadProfilePhoto);
router.delete('/delete-photo', deleteProfilePhoto);
router.post('/add-patient-to-queue', addPatientToQueue);
router.get('/patients/:patientId/history', getPatientHistoryForClinic);

// Debug endpoint to test patient history
router.get('/debug/patient-history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.clinic.id;
    
    console.log('DEBUG: Getting patient history for:', { patientId, clinicId });
    
    // Get all queue entries for this clinic to see what data exists
    const allQueues = await Queue.findAll({
      where: { clinicId: clinicId },
      include: [
        { association: 'patient', attributes: ['name', 'phone'] },
        { association: 'doctor', attributes: ['name'] }
      ],
      attributes: ['number', 'status', 'bookedAt', 'servedAt', 'cancelledAt', 'patientName', 'manualEntry', 'patientId', 'doctorId', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 20,
      raw: false
    });
    
    // Filter for history entries
    const historyEntries = allQueues.filter(q => ['served', 'cancelled'].includes(q.status));
    
    // Search attempts
    const searchResults = {
      byId: [],
      byPhone: [],
      byName: [],
      byPatientPhone: []
    };
    
    // Try ID search
    const parsedId = parseInt(patientId, 10);
    if (!isNaN(parsedId)) {
      searchResults.byId = await Queue.findAll({
        where: {
          clinicId: clinicId,
          status: { [Op.in]: ['served', 'cancelled'] },
          patientId: parsedId
        },
        raw: true
      });
    }
    
    // Try phone search
    if (/^[\d\+\-\s\(\)]+$/.test(patientId)) {
      searchResults.byPhone = await Queue.findAll({
        where: {
          clinicId: clinicId,
          status: { [Op.in]: ['served', 'cancelled'] },
          'manualEntry.phone': patientId
        },
        raw: true
      });
      
      // Also search registered patients
      const patientsWithPhone = await Patient.findAll({ 
        where: { phone: patientId },
        attributes: ['id']
      });
      if (patientsWithPhone.length > 0) {
        searchResults.byPatientPhone = await Queue.findAll({
          where: {
            clinicId: clinicId,
            status: { [Op.in]: ['served', 'cancelled'] },
            patientId: { [Op.in]: patientsWithPhone.map(p => p.id) }
          },
          raw: true
        });
      }
    }
    
    // Try name search
    searchResults.byName = await Queue.findAll({
      where: {
        clinicId: clinicId,
        status: { [Op.in]: ['served', 'cancelled'] },
        patientName: { [Op.iLike]: `%${patientId}%` }
      },
      raw: true
    });
    
    res.json({
      searchTerm: patientId,
      clinicId: clinicId,
      totalQueueEntries: allQueues.length,
      totalHistoryEntries: historyEntries.length,
      searchResults: {
        byId: searchResults.byId.length,
        byPhone: searchResults.byPhone.length,
        byName: searchResults.byName.length,
        byPatientPhone: searchResults.byPatientPhone.length
      },
      sampleData: {
        allQueues: allQueues.slice(0, 5).map(q => ({
          id: q.id,
          number: q.number,
          status: q.status,
          patientName: q.patientName,
          patientAccount: q.patient?.name,
          phone: q.manualEntry?.phone || q.patient?.phone
        })),
        historyEntries: historyEntries.slice(0, 5).map(q => ({
          id: q.id,
          number: q.number,
          status: q.status,
          patientName: q.patientName,
          patientAccount: q.patient?.name,
          phone: q.manualEntry?.phone || q.patient?.phone
        }))
      }
    });
  } catch (err) {
    console.error('DEBUG ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;