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
router.use('/', sitemapRoutes);

// Test route for FCM token registration
router.post('/test/fcm-token', async (req, res) => {
  try {
    const { patientId, fcmToken } = req.body;
    
    if (!patientId || !fcmToken) {
      return res.status(400).json({ error: 'patientId and fcmToken are required' });
    }

    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findByPk(patientId);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    await patient.update({ fcmToken });
    
    // Return only selected fields
    const result = {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      fcmToken: patient.fcmToken
    };

    res.json({ 
      success: true, 
      message: `FCM token registered for ${result.name}`,
      tokenPreview: `${fcmToken.substring(0, 20)}...`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;