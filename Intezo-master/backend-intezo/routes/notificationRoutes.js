import express from 'express';
import { 
  subscribeToQueue 
} from '../controllers/notification/notification.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/subscribe', authenticate, subscribeToQueue);

export default router;