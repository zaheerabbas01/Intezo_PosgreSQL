import express from 'express';
import { 
  registerPatient, 
  patientLogin, 
  registerClinic, 
  loginClinic, 
  registerDoctor, 
  loginDoctor,
  verifyPatientEmail,
  verifyClinicEmail,
  verifyDoctorEmail,
  resendPatientVerification,
  resendClinicVerification,
  resendDoctorVerification,
  loginAdmin,
  verifyAdminEmail,
  logoutUser,
  patientPhoneAuthStatus
} from '../controllers/auth/auth.controller.js';

const router = express.Router();

// Patient routes
router.post('/register/patient', registerPatient);
router.post('/login/patient', patientLogin);
router.post('/patient/phone/status', patientPhoneAuthStatus);
router.post('/verify/patient', verifyPatientEmail);
router.post('/resend/patient', resendPatientVerification);

// Clinic routes
router.post('/register/clinic', registerClinic);
router.post('/login/clinic', loginClinic);
router.post('/verify/clinic', verifyClinicEmail);
router.post('/resend/clinic', resendClinicVerification);

// Doctor routes
router.post('/register/doctor', registerDoctor);
router.post('/login/doctor', loginDoctor);
router.post('/verify/doctor', verifyDoctorEmail);
router.post('/resend/doctor', resendDoctorVerification);

// Admin routes
router.post('/admin/login', loginAdmin);
router.post('/verify/admin', verifyAdminEmail);

// Logout route
router.post('/logout', logoutUser);

export default router;
