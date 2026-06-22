import express from 'express';
import { 
  createReport, 
  getPatientReports, 
  getClinicReports, 
  downloadReportPDF, 
  markReportAsRead,
  getReportOptions,
  getCustomTemplates,
  saveCustomTemplates
} from '../controllers/report/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = express.Router();

// Test route to verify reports routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Reports routes are working!' });
});

// Get custom templates for clinic - MUST BE BEFORE /:reportId routes
router.get('/custom-templates', authenticate, requireRole(['clinic', 'doctor']), getCustomTemplates);

// Save custom templates for clinic
router.post('/custom-templates', authenticate, requireRole(['clinic', 'doctor']), saveCustomTemplates);

// Get predefined options for report fields
router.get('/options', authenticate, requireRole(['clinic', 'doctor']), getReportOptions);

// Get reports for patient (mobile app)
router.get('/patient', authenticate, requireRole(['patient']), getPatientReports);

// Get reports for clinic/doctor (dashboard)
router.get('/clinic', authenticate, requireRole(['clinic', 'doctor']), getClinicReports);

// Create a new report (clinic/doctor only)
router.post('/', authenticate, requireRole(['clinic', 'doctor']), createReport);

// Download report PDF
router.get('/:reportId/download', authenticate, downloadReportPDF);

// Mark report as read (patient only)
router.patch('/:reportId/read', authenticate, requireRole(['patient']), markReportAsRead);

export default router;