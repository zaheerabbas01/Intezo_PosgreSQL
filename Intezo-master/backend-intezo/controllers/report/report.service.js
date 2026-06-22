import { Report, Patient, Clinic } from '../../models/index.js';
import { generateReportPDF } from './report.utils.js';
import { openStoredReportPDF, storeReportPDF } from '../../services/reportStorage.js';
import { notifyPatientReportReady } from '../notification/notification.service.js';
import { DEFAULT_REPORT_TEMPLATES } from '../confg/reportDefault.js';

export const createMedicalReport = async (reportData, clinicId, doctorId) => {
  let { patientId } = reportData;
  let patientName = reportData.patientName || null;
  let patient = await Patient.findByPk(patientId);
  if (!patient) {
    const { Queue } = await import('../../models/index.js');
    const queueEntry = await Queue.findByPk(patientId);
    if (queueEntry) { patientName = patientName || queueEntry.patientName; patientId = queueEntry.patientId || queueEntry.id; } else { throw new Error('PATIENT_NOT_FOUND'); }
    patient = await Patient.findByPk(patientId);
  }
  // If patientName not provided, look up from queue entry by patientId
  if (!patientName) {
    const { Queue } = await import('../../models/index.js');
    const queueEntry = await Queue.findOne({ where: { patientId, clinicId, doctorId }, order: [['createdAt', 'DESC']] });
    patientName = queueEntry?.patientName || patient?.name || null;
  }
  const { Queue } = await import('../../models/index.js');
  const patientClinicRelationship = await Queue.findOne({
    where: { patientId, clinicId, doctorId },
    attributes: ['id']
  });
  if (!patientClinicRelationship) throw new Error('PATIENT_NOT_ASSOCIATED');
  const report = await Report.create({ ...reportData, patientId, patientName, clinicId, doctorId, medications: reportData.medications || [], labTests: reportData.labTests || [], followUpDate: reportData.followUpDate ? new Date(reportData.followUpDate) : null });
  await report.reload({ include: [{ association: 'patient', attributes: ['name', 'phone', 'email'] }, { association: 'clinic', attributes: ['name', 'address', 'phone', 'profilePhoto'] }, { association: 'doctor', attributes: ['name', 'specialties'] }] });
  const pdfBuffer = await generateReportPDF(report);
  report.pdfUrl = await storeReportPDF(report.id, pdfBuffer);
  await report.save();
  notifyPatientReportReady(report).catch(console.error);
  return report;
};

export const getReportFile = async (report) => {
  const stored = await openStoredReportPDF(report.pdfUrl, report.id);
  if (stored) return stored;

  console.log(`PDF missing for Report ${report.id}, regenerating...`);
  const pdfBuffer = await generateReportPDF(report);
  const pdfUrl = await storeReportPDF(report.id, pdfBuffer);
  await report.update({ pdfUrl });
  return openStoredReportPDF(pdfUrl, report.id);
};

export const fetchReportOptions = async (clinicId) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (clinic?.customReportTemplates) { const hasData = Object.values(clinic.customReportTemplates).some(arr => arr?.length > 0); if (hasData) return clinic.customReportTemplates; }
  return { titles: ['General Consultation', 'Follow-up Visit', 'Routine Check-up', 'Diagnostic Report'], labTestTitles: ['Blood Test Report', 'X-Ray Report', 'CT Scan Report', 'MRI Report'], labTestNames: ['Hemoglobin', 'Blood Sugar', 'Cholesterol', 'Creatinine'], symptoms: ['Fever', 'Headache', 'Cough', 'Fatigue', 'Nausea'], diagnoses: ['Normal examination', 'Hypertension', 'Diabetes mellitus', 'Viral infection'], treatments: ['Rest and hydration', 'Medication as prescribed', 'Follow-up in 1 week'], medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours' }, { name: 'Amoxicillin', dosage: '500mg', frequency: 'Every 8 hours' }] };
};

export const getTemplatesForClinic = async (clinicId) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (clinic?.customReportTemplates) { const hasData = Object.values(clinic.customReportTemplates).some(arr => arr?.length > 0); if (hasData) return clinic.customReportTemplates; }
  return DEFAULT_REPORT_TEMPLATES;
};

export const updateClinicTemplates = async (clinicId, templates) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (!clinic) throw new Error('CLINIC_NOT_FOUND');
  return await clinic.update({ customReportTemplates: templates });
};
