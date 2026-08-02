import express from 'express';
import { nextJob, result } from '../controllers/smsGateway/smsGateway.controller.js';

const router = express.Router();

router.get('/jobs/next', nextJob);
router.post('/jobs/:jobId/result', result);

export default router;
