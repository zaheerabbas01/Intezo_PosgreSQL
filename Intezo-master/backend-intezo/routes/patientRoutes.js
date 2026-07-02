import express from 'express';
import {
  registerPatient,
  getPatientProfile,
  updateFCMToken,
  getCurrentQueueStatus,
  cancelBooking,
  registerPatientAndAddToQueue,
  updatePatientInfo,
  getPatientQueueHistory
} from '../controllers/patient/patient.controller.js';
import { authenticatePatient } from '../middleware/auth.js';
import Patient from '../models/Patient.js';
import redisClient from '../config/redis.js';
import Clinic from '../models/Clinic.js';
import Queue from '../models/Queue.js';
import Doctor from '../models/Doctor.js'; // Add this import

const router = express.Router();

// FCM token routes (must be before parameterized routes)
router.post('/fcm-token', authenticatePatient, updateFCMToken);
router.put('/fcm-token', authenticatePatient, updateFCMToken);

// Public routes
router.post('/register', registerPatient);
router.post('/register-and-queue', registerPatientAndAddToQueue);

// Add doctor-specific booking route
router.post('/book-doctor', authenticatePatient, async (req, res) => {
  try {
    const { clinicId, doctorId, patientName } = req.body;
    
    // Import bookNumber function
    const { bookNumber } = await import('../controllers/queue/queue.controller.js');
    
    // Call bookNumber with proper request structure
    await bookNumber({
      body: {
        clinicId,
        patientId: req.patient.id,
        doctorId,
        patientName
      }
    }, res);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A patient may only read or update their own record. The controller repeats
// this check as defense in depth, rather than trusting a URL parameter.
const authorizePatientSelf = (req, res, next) => {
  if (String(req.patient.id) !== String(req.params.patientId)) {
    return res.status(403).json({ error: 'You can only access your own patient record' });
  }
  next();
};

// Parameterized routes (must be after specific routes)
router.put('/:patientId', authenticatePatient, authorizePatientSelf, updatePatientInfo);
router.get('/:patientId/history', authenticatePatient, authorizePatientSelf, getPatientQueueHistory);

// Protected routes
router.use(authenticatePatient);
router.get('/profile', getPatientProfile);

router.get('/queue-status', getCurrentQueueStatus);

router.delete('/cancel-booking', cancelBooking);

// Notification preference routes
router.post('/notifications/clinic/:clinicId', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient.id);
    let clinicNotifications = patient.clinicNotifications || [];
    if (!clinicNotifications.includes(req.params.clinicId)) {
      clinicNotifications.push(req.params.clinicId);
      await patient.update({ clinicNotifications });
    }
    res.json({ success: true, message: 'Clinic notification enabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notifications/clinic/:clinicId', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient.id);
    let clinicNotifications = patient.clinicNotifications || [];
    clinicNotifications = clinicNotifications.filter(id => id !== req.params.clinicId);
    await patient.update({ clinicNotifications });
    res.json({ success: true, message: 'Clinic notification disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/doctor/:doctorId', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient.id);
    let doctorNotifications = patient.doctorNotifications || [];
    if (!doctorNotifications.includes(req.params.doctorId)) {
      doctorNotifications.push(req.params.doctorId);
      await patient.update({ doctorNotifications });
    }
    res.json({ success: true, message: 'Doctor notification enabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notifications/doctor/:doctorId', async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.patient.id);
    let doctorNotifications = patient.doctorNotifications || [];
    doctorNotifications = doctorNotifications.filter(id => id !== req.params.doctorId);
    await patient.update({ doctorNotifications });
    res.json({ success: true, message: 'Doctor notification disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications/preferences', async (req, res) => {
  try {
    // clinicNotifications / doctorNotifications are plain UUID[] columns, not
    // associations, so return them directly (no include).
    const patient = await Patient.findByPk(req.patient.id, {
      attributes: ['clinicNotifications', 'doctorNotifications']
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    res.json({
      clinicNotifications: patient.clinicNotifications || [],
      doctorNotifications: patient.doctorNotifications || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
