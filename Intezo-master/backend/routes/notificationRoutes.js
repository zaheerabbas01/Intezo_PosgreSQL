import express from 'express';
import { 
  subscribeToQueue 
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/subscribe', authenticate, subscribeToQueue);

export default router;