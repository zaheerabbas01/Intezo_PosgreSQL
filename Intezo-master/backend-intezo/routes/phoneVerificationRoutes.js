import express from 'express';

import {
  start,
  status
} from '../controllers/phoneVerification/phoneVerification.controller.js';
import { authenticatePatient } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticatePatient);
router.get('/status', status);
router.post('/start', start);

export default router;
