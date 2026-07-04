import express from 'express';

import {
  receiveWebhook,
  verifyWebhook
} from '../controllers/phoneVerification/whatsappWebhook.controller.js';

const router = express.Router();

router.get('/', verifyWebhook);
router.post('/', receiveWebhook);

export default router;
