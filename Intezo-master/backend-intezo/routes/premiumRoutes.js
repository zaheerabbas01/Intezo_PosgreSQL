import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { submitPremiumPayment, getPremiumStatus } from '../controllers/premium/premium.controller.js';

const router = express.Router();

// All routes require patient authentication
router.use(authenticate);

// Submit premium payment
router.post('/submit-payment', submitPremiumPayment);

// Get premium status
router.get('/status', getPremiumStatus);

export default router;