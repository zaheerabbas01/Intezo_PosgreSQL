import express from 'express';
import { authenticate } from '../middleware/auth.js';
import pusher from '../config/pusher.js';
import { validatePusherAuth } from '../middleware/validatePusherAuth.js';
import 'dotenv/config';

const router = express.Router();

router.post('/auth', 
  validatePusherAuth,
  authenticate,
  (req, res) => {
    console.log('Incoming pusher auth headers:', req.headers.authorization || req.headers);
    try {
      const { socketId, channelName } = req.pusherParams;

      console.log('Pusher config check:', {
        hasAppId: !!process.env.PUSHER_APP_ID,
        hasKey: !!process.env.PUSHER_KEY,
        hasSecret: !!process.env.PUSHER_SECRET
      });

      console.log('Authenticating for:', {
        socketId,
        channelName,
        userId: req.clinic.id.toString()
      });

      const authResponse = pusher.authenticate(socketId, channelName, {
        user_id: req.clinic.id.toString(),
        user_info: {
          name: req.clinic.name,
          role: 'clinic'
        }
      });

      console.log('Authentication successful');
      res.json(authResponse);
    } catch (err) {
      console.error('Pusher auth error:', err);
      res.status(403).json({ error: 'Authentication failed' });
    }
  }
);

export default router;