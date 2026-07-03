import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdmin } from '../middleware/roles.js';
import {
  getDashboardStats,
  getAllPatients,
  getAllDoctors,
  getAllClinics,
  updatePatient,
  updateDoctor,
  updateClinic,
  deletePatient,
  deleteDoctor,
  deleteClinic,
  removeDoctorFromClinic,
  getPendingApprovals,
  approveRegistration,
  rejectRegistration,
  getOnlineUsers,
  logoutUser,
  getPendingPremiumPayments,
  getPremiumUsers,
  approvePremiumPayment,
  rejectPremiumPayment
} from '../controllers/admin/admin.controller.js';
import { getSystemActivity, publishAdminUpdate } from '../services/realtime.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorizeAdmin);

// Dashboard stats
router.get('/stats', getDashboardStats);

// Patients management
router.get('/patients', getAllPatients);
router.delete('/patients/:id', deletePatient);

// Doctors management
router.get('/doctors', getAllDoctors);
router.delete('/doctors/:id', deleteDoctor);

// Clinics management
router.get('/clinics', getAllClinics);
router.put('/clinics/:id', updateClinic);
router.delete('/clinics/:id', deleteClinic);

// Approval management
router.get('/pending-approvals', getPendingApprovals);
router.post('/approve/:id', approveRegistration);
router.post('/reject/:id', rejectRegistration);

// Patients management
router.put('/patients/:id', updatePatient);

// Doctors management
router.put('/doctors/:id', updateDoctor);
router.delete('/doctors/:doctorId/clinics/:clinicId', removeDoctorFromClinic);

// Real-time endpoints
router.get('/activity', async (req, res) => {
  try {
    const activities = await getSystemActivity();
    res.json({ activities });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/broadcast', async (req, res) => {
  try {
    const { type, message } = req.body;
    await publishAdminUpdate('admin_broadcast', { type, message, admin: req.user.name });
    res.json({ message: 'Broadcast sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/online-users', getOnlineUsers);
router.post('/logout', logoutUser);

// Premium payment management
router.get('/premium-users', getPremiumUsers);
router.get('/premium-payments', getPendingPremiumPayments);
router.post('/premium-payments/:id/approve', approvePremiumPayment);
router.post('/premium-payments/:id/reject', rejectPremiumPayment);

export default router;
