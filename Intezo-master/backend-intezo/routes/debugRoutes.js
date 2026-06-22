import express from 'express';
import { 
  debugDoctorLogin, 
  testDoctorCreation, 
  compareLoginFlows 
} from '../controllers/debug/debug.controller.js';

const router = express.Router();

// Debug routes (only for development)
if (process.env.NODE_ENV !== 'production') {
  router.post('/doctor-login', debugDoctorLogin);
  router.post('/test-doctor', testDoctorCreation);
  router.post('/compare-logins', compareLoginFlows);
}

export default router;