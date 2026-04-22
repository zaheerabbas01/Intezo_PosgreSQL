import Report from '../models/Report.js';
import Patient from '../models/Patient.js';
import Clinic from '../models/Clinic.js';
import Doctor from '../models/Doctor.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FCMService from '../services/fcmService.js';
import EmailService from '../services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new report
export const createReport = async (req, res) => {
  console.log('📝 Create report endpoint hit');
  console.log('Request body:', req.body);
  console.log('User:', req.user);
  
  try {
    let { 
      patientId, 
      reportType,
      title, 
      diagnosis, 
      symptoms, 
      treatment, 
      medications, 
      notes, 
      recommendations, 
      followUpDate,
      labTests
    } = req.body;

    // Get clinic and doctor info from authenticated user
    const clinicId = req.user.clinic?._id || req.user._id;
    let doctorId = req.user.role === 'doctor' ? req.user._id : req.body.doctorId;
    
    // If no doctorId provided, try to get from patient or find available doctor
    if (!doctorId) {
      if (patient.doctor) {
        doctorId = patient.doctor.id || patient.doctor;
        console.log('Using patient assigned doctor:', doctorId);
      } else if (req.user.role === 'clinic') {
        const firstDoctor = await Doctor.findOne({ where: { isActive: true } });
        if (firstDoctor) {
          doctorId = firstDoctor.id;
          console.log('Using first available doctor:', doctorId);
        } else {
          return res.status(400).json({ error: 'No active doctors available' });
        }
      } else {
        return res.status(400).json({ error: 'Doctor ID is required' });
      }
    }
    
    console.log('Clinic ID:', clinicId);
    console.log('Doctor ID:', doctorId);
    console.log('Patient ID:', patientId);

    // Validate that patientId is provided
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // Try to find the patient
    console.log('Looking for patient with ID:', patientId);
    let patient = await Patient.findByPk(patientId);
    console.log('Patient found:', patient ? 'Yes' : 'No');
    
    if (!patient) {
      console.log('Patient not found in database, checking queue entries...');
      // Try to find patient in queue entries (they might not be registered patients)
      const Queue = (await import('../models/Queue.js')).default;
      const queueEntry = await Queue.findByPk(patientId);
      
      if (queueEntry && queueEntry.patient) {
        patient = queueEntry.patient;
        patientId = patient.id;
        console.log('Found patient through queue entry');
      } else if (queueEntry) {
        // Use queue entry data as patient info
        patient = {
          id: queueEntry.id,
          name: queueEntry.patientName || queueEntry.name,
          phone: queueEntry.phone || queueEntry.manualEntry?.phone,
          email: queueEntry.email
        };
        console.log('Using queue entry as patient data');
      } else {
        console.log('Patient not found anywhere');
        return res.status(404).json({ error: 'Patient not found' });
      }
    }

    // Create report
    const report = await Report.create({
      patientId: patientId,
      clinicId: clinicId,
      doctorId: doctorId,
      reportType: reportType || 'medical',
      title,
      diagnosis,
      symptoms,
      treatment,
      medications: medications || [],
      labTests: labTests || [],
      notes,
      recommendations,
      followUpDate: followUpDate ? new Date(followUpDate) : null
    });

    // Populate the report with related data
    await report.reload({
      include: [
        { association: 'patient', attributes: ['name', 'phone', 'email'] },
        { association: 'clinic', attributes: ['name', 'address', 'phone', 'profilePhoto'] },
        { association: 'doctor', attributes: ['name', 'specialties'] }
      ]
    });

    // Generate PDF
    const absolutePdfPath = await generateReportPDF(report);
    const relativePdfPath = `/uploads/reports/report-${report._id}.pdf`;
    report.pdfUrl = relativePdfPath;
    await report.save();

    // Send notifications to patient
    await notifyPatientReportReady(report);

    res.status(201).json({
      success: true,
      report,
      message: 'Report created successfully'
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
};

// Get reports for a patient (mobile app)
export const getPatientReports = async (req, res) => {
  try {
    const patientId = parseInt(req.user.id, 10);
    if (!patientId || isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }
    const { page = 1, limit = 10 } = req.query;

    const reports = await Report.findAll({
      where: { patientId: patientId },
      include: [
        { association: 'clinic', attributes: ['name', 'profilePhoto'] },
        { association: 'doctor', attributes: ['name', 'specialties'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: limit * 1,
      offset: (page - 1) * limit
    });

    const total = await Report.count({ where: { patientId: patientId } });

    res.json({
      reports,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching patient reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Get reports for clinic/doctor (dashboard)
export const getClinicReports = async (req, res) => {
  try {
    const clinicId = parseInt(req.user.clinic?.id || req.user.id, 10);
    if (!clinicId || isNaN(clinicId)) {
      return res.status(400).json({ error: 'Invalid clinic ID' });
    }
    const { page = 1, limit = 20, patientId, doctorId } = req.query;

    const where = { clinicId: clinicId };
    if (patientId) {
      const pid = parseInt(patientId, 10);
      if (isNaN(pid)) return res.status(400).json({ error: 'Invalid patient ID' });
      where.patientId = pid;
    }
    if (doctorId) {
      const did = parseInt(doctorId, 10);
      if (isNaN(did)) return res.status(400).json({ error: 'Invalid doctor ID' });
      where.doctorId = did;
    }

    const reports = await Report.findAll({
      where: where,
      include: [
        { association: 'patient', attributes: ['name', 'phone'] },
        { association: 'doctor', attributes: ['name', 'specialties'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: limit * 1,
      offset: (page - 1) * limit
    });

    const total = await Report.count({ where: where });

    res.json({
      reports,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching clinic reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Download report PDF
export const downloadReportPDF = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findByPk(reportId, {
      include: [
        { association: 'patient', attributes: ['name', 'phone', 'email'] },
        { association: 'clinic', attributes: ['name', 'address', 'phone', 'profilePhoto'] },
        { association: 'doctor', attributes: ['name', 'specialties'] }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if user has access to this report
    const userId = req.user.id.toString();
    const patientId = report.patient.id.toString();
    const clinicId = report.clinic.id.toString();
    const doctorId = report.doctor.id.toString();

    if (userId !== patientId && userId !== clinicId && userId !== doctorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get the absolute path for the PDF file
    const sanitizedReportId = String(report.id).replace(/[^a-zA-Z0-9-]/g, '');
    const fileName = `report-${sanitizedReportId}.pdf`;
    const absolutePdfPath = path.join(__dirname, '../uploads/reports', fileName);
    
    // Check if file exists, if not regenerate
    if (!fs.existsSync(absolutePdfPath)) {
      console.log('PDF file not found, regenerating...');
      await generateReportPDF(report);
    }
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.pdf"`);
    
    // Stream the PDF file
    const pdfStream = fs.createReadStream(absolutePdfPath);
    pdfStream.pipe(res);

    // Mark as read if patient is downloading
    if (userId === patientId && !report.isRead) {
      await report.update({ isRead: true });
    }
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
};

// Mark report as read
export const markReportAsRead = async (req, res) => {
  try {
    const { reportId } = req.params;
    const patientId = req.user.id;

    const report = await Report.findOne({
      where: { id: reportId, patientId: patientId }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await report.update({ isRead: true });

    res.json({ success: true, message: 'Report marked as read' });
  } catch (error) {
    console.error('Error marking report as read:', error);
    res.status(500).json({ error: 'Failed to mark report as read' });
  }
};

// Get predefined options for report fields
export const getReportOptions = async (req, res) => {
  try {
    const clinicId = req.user.clinic?.id || req.user.id;
    const clinic = await Clinic.findByPk(clinicId);
    
    // If clinic has custom templates, use them directly
    if (clinic?.customReportTemplates) {
      const hasData = Object.values(clinic.customReportTemplates).some(arr => arr && arr.length > 0);
      if (hasData) {
        return res.json({ success: true, options: clinic.customReportTemplates });
      }
    }
    
    // Otherwise return default options
    const defaultOptions = {
      titles: [
        'General Consultation',
        'Follow-up Visit',
        'Routine Check-up',
        'Emergency Visit',
        'Specialist Consultation',
        'Lab Results Review',
        'Vaccination Record',
        'Physical Examination',
        'Diagnostic Report',
        'Treatment Plan'
      ],
      labTestTitles: [
        'Blood Test Report',
        'Urine Test Report',
        'X-Ray Report',
        'CT Scan Report',
        'MRI Report',
        'ECG Report',
        'Ultrasound Report'
      ],
      labTestNames: [
        'Hemoglobin',
        'Blood Sugar',
        'Cholesterol',
        'Blood Pressure',
        'White Blood Cells',
        'Red Blood Cells',
        'Platelets',
        'Creatinine',
        'Urea',
        'Liver Enzymes'
      ],
      labTestSummaries: [
        'Normal results',
        'Abnormal results - requires follow-up',
        'Critical values detected',
        'Inconclusive results',
        'Test completed successfully'
      ],
      symptoms: [
        'Fever',
        'Headache',
        'Cough',
        'Sore throat',
        'Fatigue',
        'Nausea',
        'Vomiting',
        'Diarrhea',
        'Abdominal pain',
        'Chest pain',
        'Shortness of breath',
        'Dizziness',
        'Joint pain',
        'Muscle pain',
        'Skin rash',
        'Back pain',
        'Loss of appetite',
        'Sleep problems',
        'Anxiety',
        'Depression'
      ],
      diagnoses: [
        'Normal examination',
        'Upper respiratory infection',
        'Hypertension',
        'Diabetes mellitus',
        'Gastroenteritis',
        'Migraine',
        'Allergic reaction',
        'Bronchitis',
        'Urinary tract infection',
        'Viral infection',
        'Bacterial infection',
        'Anxiety disorder',
        'Depression',
        'Arthritis',
        'Asthma',
        'Dermatitis',
        'Gastritis',
        'Sinusitis',
        'Pneumonia',
        'Influenza'
      ],
      treatments: [
        'Rest and hydration',
        'Medication as prescribed',
        'Follow-up in 1 week',
        'Follow-up in 2 weeks',
        'Follow-up in 1 month',
        'Physical therapy',
        'Dietary modifications',
        'Lifestyle changes',
        'Regular exercise',
        'Stress management',
        'Blood pressure monitoring',
        'Blood sugar monitoring',
        'Wound care',
        'Hot/cold compress',
        'Avoid allergens',
        'Increase fluid intake',
        'Bed rest',
        'Gradual activity increase',
        'Specialist referral',
        'Laboratory tests'
      ],
      medications: [
        { name: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours' },
        { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 8 hours' },
        { name: 'Amoxicillin', dosage: '500mg', frequency: 'Every 8 hours' },
        { name: 'Omeprazole', dosage: '20mg', frequency: 'Once daily' },
        { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily' },
        { name: 'Salbutamol', dosage: '100mcg', frequency: 'As needed' },
        { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily' },
        { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily' },
        { name: 'Prednisolone', dosage: '5mg', frequency: 'Once daily' }
      ],
      recommendations: [
        'Maintain adequate rest',
        'Stay well hydrated',
        'Follow prescribed medication schedule',
        'Return if symptoms worsen',
        'Avoid strenuous activities',
        'Maintain healthy diet',
        'Regular exercise as tolerated',
        'Monitor blood pressure regularly',
        'Monitor blood sugar levels',
        'Avoid smoking and alcohol',
        'Practice stress management',
        'Get adequate sleep',
        'Follow up as scheduled',
        'Complete full course of antibiotics',
        'Avoid known allergens'
      ]
    };

    res.json({ success: true, options: defaultOptions });
  } catch (error) {
    console.error('Error fetching report options:', error);
    res.status(500).json({ error: 'Failed to fetch report options' });
  }
};

// Generate PDF report
const generateReportPDF = async (report) => {
  return new Promise(async (resolve, reject) => {
    const fetch = (await import('node-fetch')).default;
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads/reports');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `report-${report.id}.pdf`;
      const filePath = path.join(uploadsDir, fileName);

      // Create PDF document with A4 size
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 60,
        bufferPages: true
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Colors
      const primaryColor = '#4A90A4'; // Teal color
      const textColor = '#333333';
      const lightGray = '#666666';

      let yPos = 60;

      // Header - Clinic Logo
      if (report.clinic?.profilePhoto) {
        try {
          const logoUrl = new URL(report.clinic.profilePhoto);
          const allowedHosts = ['s3.amazonaws.com', 'cloudfront.net', 'localhost'];
          if (!allowedHosts.some(host => logoUrl.hostname.includes(host))) {
            throw new Error('Untrusted image source');
          }
          const response = await fetch(logoUrl.href, { timeout: 5000 });
          const imageBuffer = await response.buffer();
          doc.image(imageBuffer, 250, yPos, { width: 80, height: 80 });
          yPos += 90;
        } catch (err) {
          console.log('Could not load clinic logo:', err.message);
          yPos += 20;
        }
      } else {
        yPos += 20;
      }

      // Clinic Name
      doc.fontSize(18)
         .fillColor(primaryColor)
         .text(report.clinic?.name || 'Medical Center', 0, yPos, { align: 'center' });
      yPos += 20;

      // Clinic Address
      doc.fontSize(10)
         .fillColor(lightGray)
         .text(report.clinic?.address || 'Address not available', 0, yPos, { align: 'center' });
      yPos += 40;

      // Title
      const reportTitle = report.reportType === 'lab_test' ? 'LAB TEST REPORT' : 'MEDICAL REPORT';
      doc.fontSize(20)
         .fillColor(textColor)
         .text(reportTitle, 0, yPos, { align: 'center' });
      yPos += 40;

      // Visit Info Section
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Visit Info', 60, yPos);
      yPos += 25;

      // Two column layout for visit info
      const leftCol = 60;
      const rightCol = 320;
      
      doc.fontSize(10).fillColor(textColor);
      doc.text("Doctor's Name:", leftCol, yPos);
      doc.text(`Dr. ${report.doctor?.name || 'Unknown'}`, leftCol + 80, yPos);
      doc.text('Visit Date:', rightCol, yPos);
      doc.text(new Date(report.visitDate || report.createdAt).toLocaleDateString(), rightCol + 60, yPos);
      yPos += 18;

      doc.text('Specialization:', leftCol, yPos);
      doc.text(report.doctor?.specialties?.[0] || 'General Medicine', leftCol + 80, yPos);
      yPos += 35;

      // Patient Info Section
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Patient Info', leftCol, yPos);
      yPos += 25;

      doc.fontSize(10).fillColor(textColor);
      doc.text('Full Name:', leftCol, yPos);
      doc.text(report.patient?.name || 'Unknown Patient', leftCol + 80, yPos);
      doc.text('Phone:', rightCol, yPos);
      doc.text(report.patient?.phone || 'N/A', rightCol + 40, yPos);
      yPos += 18;

      if (report.patient?.email) {
        doc.text('Email:', rightCol, yPos);
        doc.text(report.patient.email, rightCol + 40, yPos);
        yPos += 18;
      }
      yPos += 20;

      // Assessment Section (if symptoms exist and it's a medical report)
      if (report.reportType === 'medical' && report.symptoms && report.symptoms.trim()) {
        doc.fontSize(14)
           .fillColor(primaryColor)
           .text('Assessment', leftCol, yPos);
        yPos += 20;

        doc.fontSize(10)
           .fillColor(textColor)
           .text(report.symptoms, leftCol, yPos, { width: 480, align: 'justify' });
        yPos += doc.heightOfString(report.symptoms, { width: 480 }) + 20;
      }

      // Diagnosis/Summary Section
      const diagnosisTitle = report.reportType === 'lab_test' ? 'Test Summary' : 'Diagnosis';
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text(diagnosisTitle, leftCol, yPos);
      yPos += 20;

      doc.fontSize(10)
         .fillColor(textColor)
         .text(report.diagnosis || `No ${diagnosisTitle.toLowerCase()} provided`, leftCol, yPos, { width: 480, align: 'justify' });
      yPos += doc.heightOfString(report.diagnosis || `No ${diagnosisTitle.toLowerCase()} provided`, { width: 480 }) + 20;

      // Lab Test Results Section (for lab reports)
      if (report.reportType === 'lab_test' && report.labTests && report.labTests.length > 0) {
        doc.fontSize(14)
           .fillColor(primaryColor)
           .text('Test Results', leftCol, yPos);
        yPos += 20;

        // Table headers
        doc.fontSize(9)
           .fillColor(textColor)
           .text('Test Name', leftCol, yPos, { width: 120 })
           .text('Result', leftCol + 125, yPos, { width: 80 })
           .text('Normal Range', leftCol + 210, yPos, { width: 100 })
           .text('Unit', leftCol + 315, yPos, { width: 60 })
           .text('Status', leftCol + 380, yPos, { width: 80 });
        yPos += 15;

        // Draw header line
        doc.moveTo(leftCol, yPos)
           .lineTo(leftCol + 460, yPos)
           .stroke();
        yPos += 10;

        // Test results
        report.labTests.forEach((test, index) => {
          const statusColor = test.status === 'critical' ? '#ef4444' : 
                             test.status === 'abnormal' ? '#f59e0b' : '#10b981';
          
          doc.fontSize(9)
             .fillColor(textColor)
             .text(test.testName || 'N/A', leftCol, yPos, { width: 120 })
             .text(test.result || 'N/A', leftCol + 125, yPos, { width: 80 })
             .text(test.normalRange || 'N/A', leftCol + 210, yPos, { width: 100 })
             .text(test.unit || 'N/A', leftCol + 315, yPos, { width: 60 })
             .fillColor(statusColor)
             .text(test.status || 'normal', leftCol + 380, yPos, { width: 80 })
             .fillColor(textColor);
          yPos += 15;
        });
        yPos += 10;
      }

      // Treatment/Prescription Section (only for medical reports)
      if (report.reportType === 'medical') {
        if ((report.treatment && report.treatment.trim()) || (report.medications && report.medications.length > 0)) {
          doc.fontSize(14)
             .fillColor(primaryColor)
             .text('Prescription', leftCol, yPos);
          yPos += 20;

          // Treatment text
          if (report.treatment && report.treatment.trim()) {
            doc.fontSize(10)
               .fillColor(textColor)
               .text(report.treatment, leftCol, yPos, { width: 480, align: 'justify' });
            yPos += doc.heightOfString(report.treatment, { width: 480 }) + 15;
          }

          // Medications
          if (report.medications && report.medications.length > 0) {
            report.medications.forEach((med, index) => {
              let medText = `${index + 1}. ${med.name || 'Medication'}`;
              if (med.dosage) medText += ` - ${med.dosage}`;
              if (med.frequency) medText += ` (${med.frequency})`;
              if (med.duration) medText += ` for ${med.duration}`;
              
              doc.fontSize(10)
                 .fillColor(textColor)
                 .text(medText, leftCol, yPos, { width: 480 });
              yPos += 15;
            });
          }
          yPos += 10;
        } else {
          doc.fontSize(14)
             .fillColor(primaryColor)
             .text('Prescription', leftCol, yPos);
          yPos += 20;

          doc.fontSize(10)
             .fillColor(textColor)
             .text('No prescription is necessary at this time.', leftCol, yPos, { width: 480 });
          yPos += 30;
        }
      }

      // Recommendations/Notes
      if ((report.recommendations && report.recommendations.trim()) || (report.notes && report.notes.trim())) {
        doc.fontSize(14)
           .fillColor(primaryColor)
           .text('Additional Notes', leftCol, yPos);
        yPos += 20;

        const additionalText = [report.recommendations, report.notes].filter(Boolean).join(' ');
        doc.fontSize(10)
           .fillColor(textColor)
           .text(additionalText, leftCol, yPos, { width: 480, align: 'justify' });
        yPos += doc.heightOfString(additionalText, { width: 480 }) + 20;
      }

      // Footer - Contact Info
      const footerY = 720;
      doc.fontSize(9)
         .fillColor(lightGray)
         .text('For inquiries and appointments, feel free to contact us.', 0, footerY, { align: 'center' });
      doc.text(`phone: ${report.clinic?.phone || 'N/A'} email: ${report.clinic?.email || 'info@clinic.com'}`, 0, footerY + 12, { align: 'center' });
      doc.text(`www.${(report.clinic?.name || 'clinic').toLowerCase().replace(/\s+/g, '')}.com`, 0, footerY + 24, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Notify patient when report is ready
const notifyPatientReportReady = async (report) => {
  try {
    const clinicName = report.clinic?.name || 'Medical Center';
    const doctorName = report.doctor?.name || 'Doctor';
    const patientEmail = report.patient?.email;
    
    // Send app notification
    if (report.patient?.id) {
      await FCMService.sendReportNotification(
        report.patient.id,
        clinicName,
        doctorName,
        report.title || 'Medical Report'
      );
    }
    
    // Send email notification
    if (patientEmail) {
      await EmailService.sendReportNotification(
        patientEmail,
        report.patient?.name || 'Patient',
        clinicName,
        doctorName,
        report.title || 'Medical Report'
      );
    }
  } catch (error) {
    console.error('Error sending report notifications:', error);
  }
};

// Get custom templates for clinic
export const getCustomTemplates = async (req, res) => {
  try {
    const clinicId = req.user.clinic?.id || req.user.id;
    const clinic = await Clinic.findByPk(clinicId);
    
    // If clinic has custom templates, return them
    if (clinic?.customReportTemplates && Object.keys(clinic.customReportTemplates).length > 0) {
      const hasData = Object.values(clinic.customReportTemplates).some(arr => arr && arr.length > 0);
      if (hasData) {
        return res.json({ success: true, templates: clinic.customReportTemplates });
      }
    }
    
    // Otherwise return default templates
    const defaultTemplates = {
      titles: [
        'General Consultation',
        'Follow-up Visit',
        'Routine Check-up',
        'Emergency Visit',
        'Specialist Consultation',
        'Lab Results Review',
        'Vaccination Record',
        'Physical Examination',
        'Diagnostic Report',
        'Treatment Plan'
      ],
      labTestTitles: [
        'Blood Test Report',
        'Urine Test Report',
        'X-Ray Report',
        'CT Scan Report',
        'MRI Report',
        'ECG Report',
        'Ultrasound Report'
      ],
      labTestNames: [
        'Hemoglobin',
        'Blood Sugar',
        'Cholesterol',
        'Blood Pressure',
        'White Blood Cells',
        'Red Blood Cells',
        'Platelets',
        'Creatinine',
        'Urea',
        'Liver Enzymes'
      ],
      labTestSummaries: [
        'Normal results',
        'Abnormal results - requires follow-up',
        'Critical values detected',
        'Inconclusive results',
        'Test completed successfully'
      ],
      symptoms: [
        'Fever',
        'Headache',
        'Cough',
        'Sore throat',
        'Fatigue',
        'Nausea',
        'Vomiting',
        'Diarrhea',
        'Abdominal pain',
        'Chest pain',
        'Shortness of breath',
        'Dizziness',
        'Joint pain',
        'Muscle pain',
        'Skin rash',
        'Back pain',
        'Loss of appetite',
        'Sleep problems',
        'Anxiety',
        'Depression'
      ],
      diagnoses: [
        'Normal examination',
        'Upper respiratory infection',
        'Hypertension',
        'Diabetes mellitus',
        'Gastroenteritis',
        'Migraine',
        'Allergic reaction',
        'Bronchitis',
        'Urinary tract infection',
        'Viral infection',
        'Bacterial infection',
        'Anxiety disorder',
        'Depression',
        'Arthritis',
        'Asthma',
        'Dermatitis',
        'Gastritis',
        'Sinusitis',
        'Pneumonia',
        'Influenza'
      ],
      treatments: [
        'Rest and hydration',
        'Medication as prescribed',
        'Follow-up in 1 week',
        'Follow-up in 2 weeks',
        'Follow-up in 1 month',
        'Physical therapy',
        'Dietary modifications',
        'Lifestyle changes',
        'Regular exercise',
        'Stress management',
        'Blood pressure monitoring',
        'Blood sugar monitoring',
        'Wound care',
        'Hot/cold compress',
        'Avoid allergens',
        'Increase fluid intake',
        'Bed rest',
        'Gradual activity increase',
        'Specialist referral',
        'Laboratory tests'
      ],
      medications: [
        'Paracetamol',
        'Ibuprofen',
        'Amoxicillin',
        'Omeprazole',
        'Cetirizine',
        'Salbutamol',
        'Metformin',
        'Amlodipine',
        'Aspirin',
        'Prednisolone'
      ],
      recommendations: [
        'Maintain adequate rest',
        'Stay well hydrated',
        'Follow prescribed medication schedule',
        'Return if symptoms worsen',
        'Avoid strenuous activities',
        'Maintain healthy diet',
        'Regular exercise as tolerated',
        'Monitor blood pressure regularly',
        'Monitor blood sugar levels',
        'Avoid smoking and alcohol',
        'Practice stress management',
        'Get adequate sleep',
        'Follow up as scheduled',
        'Complete full course of antibiotics',
        'Avoid known allergens'
      ]
    };

    res.json({ success: true, templates: defaultTemplates });
  } catch (error) {
    console.error('Error fetching custom templates:', error);
    res.status(500).json({ error: 'Failed to fetch custom templates' });
  }
};

// Save custom templates for clinic
export const saveCustomTemplates = async (req, res) => {
  try {
    const clinicId = req.user.clinic?.id || req.user.id;
    const { templates } = req.body;
    
    console.log('Saving templates for clinic:', clinicId);
    console.log('Templates to save:', templates);

    const clinic = await Clinic.findByPk(clinicId);
    const updatedClinic = await clinic.update({
      customReportTemplates: templates
    });
    
    console.log('Updated clinic templates:', updatedClinic?.customReportTemplates);

    res.json({ success: true, message: 'Templates saved successfully' });
  } catch (error) {
    console.error('Error saving custom templates:', error);
    res.status(500).json({ error: 'Failed to save custom templates' });
  }
};

export default {
  createReport,
  getPatientReports,
  getClinicReports,
  downloadReportPDF,
  markReportAsRead,
  getReportOptions,
  getCustomTemplates,
  saveCustomTemplates
};