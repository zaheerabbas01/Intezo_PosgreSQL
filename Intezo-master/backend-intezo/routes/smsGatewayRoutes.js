import express from 'express';
import {
  claimJob,
  register,
  result
} from '../controllers/smsGateway/smsGateway.controller.js';

const router = express.Router();

router.get('/jobs/:jobId/claim', claimJob);
router.post('/jobs/:jobId/result', result);
router.post('/register', register);

export default router;
