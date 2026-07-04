import express from 'express';
import clinicRoutes from './clinicRoutes.js';
import queueRoutes from './queueRoutes.js';
import patientRoutes from './patientRoutes.js';
import authRoutes from './authRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import adminRoutes from './adminRoutes.js';
import premiumRoutes from './premiumRoutes.js';
import debugRoutes from './debugRoutes.js';
import reportRoutes from './reportRoutes.js';
import sitemapRoutes from './sitemapRoutes.js';
import phoneVerificationRoutes from './phoneVerificationRoutes.js';
import whatsappWebhookRoutes from './whatsappWebhookRoutes.js';

const router = express.Router();

router.use('/clinics', clinicRoutes);
router.use('/queues', queueRoutes);
router.use('/patients', patientRoutes);
router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/doctor', doctorRoutes);
router.use('/admin', adminRoutes);
router.use('/premium', premiumRoutes);
router.use('/debug', debugRoutes);
router.use('/reports', reportRoutes);
router.use('/phone-verification', phoneVerificationRoutes);
router.use('/webhooks/whatsapp', whatsappWebhookRoutes);
router.use('/', sitemapRoutes);

export default router;
