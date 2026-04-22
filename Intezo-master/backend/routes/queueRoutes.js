// queueRoutes.js - Fix the public routes
import express from 'express';
import {
  bookNumber,
  cancelNumber,
  getCurrentQueue,
  updateCurrentNumber,
  getQueueDataForPublic,
  getWaitTime,
  getPatientSpecificWaitTime,
  getDetailedQueueWithWaitTimes,
  skipPatient,
  getSkippedPatients,
  callSkippedPatient
} from '../controllers/queueController.js';
import { authenticate, authenticatePatient, authorizeClinic } from '../middleware/auth.js';
import Doctor from '../models/Doctor.js';

const router = express.Router();

// Public routes - these should NOT require authentication
router.get('/public/:clinicId/:doctorId', async (req, res) => {
  try {
    const { clinicId, doctorId } = req.params;
    
    // Basic validation for UUID or numeric IDs
    if (!clinicId || !doctorId) {
      return res.status(400).json({ error: 'Invalid clinic or doctor ID' });
    }

    const queueData = await getQueueDataForPublic(clinicId, doctorId);
    res.json(queueData);
  } catch (err) {
    console.error('Public queue endpoint error:', err);
    res.status(500).json({ 
      error: 'Failed to load queue info',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  }
});


// Protected routes - these require authentication
router.post('/book', authenticatePatient, bookNumber);
router.post('/cancel/:queueId', authenticate, cancelNumber);
router.post('/cancel/:queueId', authenticatePatient, cancelNumber);

// Add doctor-specific booking route
router.post('/book-doctor', authenticatePatient, async (req, res) => {
  try {
    const { clinicId, doctorId, patientName } = req.body;
    const patientId = req.patient.id;

    // Create a mock request object for bookNumber function
    const mockReq = {
      body: { clinicId, patientId, doctorId, patientName },
      app: { get: () => {} }
    };

    await bookNumber(mockReq, res);

  } catch (err) {
    console.error('Book doctor route error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clinic-admin routes
router.post('/next', authenticate, authorizeClinic, updateCurrentNumber);
router.post('/skip', authenticate, authorizeClinic, skipPatient);
router.get('/skipped/:doctorId', authenticate, authorizeClinic, getSkippedPatients);
router.post('/call-back/:queueId', authenticate, authorizeClinic, callSkippedPatient);

// Wait time calculation routes (place before other parameterized routes)
router.get('/patient/:queueId/wait-time', authenticatePatient, getPatientSpecificWaitTime);
router.get('/:clinicId/:doctorId/wait-time', getWaitTime);
router.get('/:clinicId/:doctorId/detailed', getDetailedQueueWithWaitTimes);

// Add this new route for doctor-specific next patient
router.post('/next-doctor', authenticate, authorizeClinic, async (req, res) => {
  try {
    const { doctorId, action, newNumber } = req.body;
    
    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    // Get the doctor to find their clinic
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Call the updateCurrentNumber function with doctor's clinic
    await updateCurrentNumber(req, res, {
      clinicId: doctor.clinic.toString(),
      doctorId,
      action,
      newNumber
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;