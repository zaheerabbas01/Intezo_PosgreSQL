// routes/doctorRoutes.js - Add new routes
import express from 'express';
import {
  getDoctors,
  getDoctor,
  addDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorQueueStatus,
  getDoctorsPublic,
  toggleDoctorAvailability,
  getDoctorProfile,
  getDoctorStats,
  updateDoctorProfile,
  getAvailableDoctors,
  addDoctorToClinic,
  uploadProfilePhoto,
  deleteProfilePhoto
} from '../controllers/doctor/doctor.controller.js';
import {
  skipPatient,
  getSkippedPatients,
  callSkippedPatient,
  serveSkippedPatient,
  updateCurrentNumber
} from '../controllers/queue/queue.controller.js';
import { authenticate, authorizeClinic, authenticateDoctor } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Public routes
router.get('/public/:clinicId', getDoctorsPublic);

// Protected routes (clinic admin only) - moved before doctor-specific routes
router.get('/', authenticate, authorizeClinic, getDoctors);
router.get('/available', authenticate, authorizeClinic, getAvailableDoctors);
router.post('/add-to-clinic', authenticate, authorizeClinic, addDoctorToClinic);
router.post('/', authenticate, authorizeClinic, addDoctor);

// Doctor-specific routes
router.get('/profile', authenticateDoctor, getDoctorProfile);
router.get('/stats', authenticateDoctor, getDoctorStats);
router.put('/profile', authenticateDoctor, updateDoctorProfile);
router.post('/upload-photo', authenticateDoctor, upload.single('profilePhoto'), uploadProfilePhoto);
router.delete('/delete-photo', authenticateDoctor, deleteProfilePhoto);
router.post('/toggle-availability', authenticateDoctor, toggleDoctorAvailability);
router.get('/:id/queue-status', authenticate, getDoctorQueueStatus);

// Doctor queue management routes
router.post('/queue/skip', authenticateDoctor, skipPatient);
router.get('/queue/skipped/:doctorId', authenticateDoctor, getSkippedPatients);
router.post('/queue/call-back/:queueId', authenticateDoctor, callSkippedPatient);
router.post('/queue/serve-skipped/:queueId', authenticateDoctor, serveSkippedPatient);
router.post('/queue/next', authenticateDoctor, updateCurrentNumber);

// Protected routes with ID parameter (must be after specific routes)
router.get('/:id', authenticate, authorizeClinic, getDoctor);
router.put('/:id', authenticate, authorizeClinic, updateDoctor);
router.delete('/:id', authenticate, authorizeClinic, deleteDoctor);
router.patch('/:id/availability', authenticate, authorizeClinic, toggleDoctorAvailability);


export default router;
