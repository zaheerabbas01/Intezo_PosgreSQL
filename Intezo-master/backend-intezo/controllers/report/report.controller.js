import * as reportService from './report.service.js';
import { Doctor, Report } from '../../models/index.js';

const clinicIdsForDoctor = (doctor) => (doctor?.clinics || [])
  .filter((association) => association.isActive !== false)
  .map((association) => association.clinicId || association.clinic)
  .filter(Boolean)
  .map(String);

const resolveAuthorizedClinicId = (req, requestedClinicId) => {
  if (req.user.role === 'clinic') return String(req.user.id);
  if (req.user.role !== 'doctor') throw new Error('CLINIC_ACCESS_DENIED');

  const allowedClinicIds = clinicIdsForDoctor(req.user);
  const clinicId = requestedClinicId ? String(requestedClinicId) : allowedClinicIds[0];
  if (!clinicId || !allowedClinicIds.includes(clinicId)) throw new Error('CLINIC_ACCESS_DENIED');
  return clinicId;
};

const doctorIsLinkedToClinic = (doctor, clinicId) => clinicIdsForDoctor(doctor).includes(String(clinicId));

const paginationFrom = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
};

const publicReportShape = (report) => {
  const value = report.toJSON ? report.toJSON() : { ...report };
  value.pdfUrl = `/api/reports/${value.id}/download`;
  return value;
};

const clinicAccessError = (error, fallback) => ({
  status: error.message === 'CLINIC_ACCESS_DENIED' ? 403 : 500,
  message: error.message === 'CLINIC_ACCESS_DENIED' ? 'Clinic access denied' : fallback
});

export const createReport = async (req, res) => {
  try {
    const clinicId = resolveAuthorizedClinicId(req, req.body.clinicId);
    const doctorId = req.user.role === 'doctor' ? req.user.id : req.body.doctorId;
    if (!doctorId) return res.status(400).json({ error: 'Doctor ID is required' });
    const doctor = req.user.role === 'doctor' ? req.user : await Doctor.findByPk(doctorId, { attributes: ['clinics'] });
    if (!doctor || !doctorIsLinkedToClinic(doctor, clinicId)) {
      return res.status(403).json({ error: 'Doctor is not associated with this clinic' });
    }
    const report = await reportService.createMedicalReport(req.body, clinicId, doctorId);
    res.status(201).json({ success: true, report: publicReportShape(report), message: 'Medical report generated successfully' });
  } catch (error) {
    const status = error.message === 'PATIENT_NOT_FOUND' ? 404
      : ['CLINIC_ACCESS_DENIED', 'PATIENT_NOT_ASSOCIATED'].includes(error.message) ? 403
        : 500;
    res.status(status).json({ error: error.message });
  }
};

export const getPatientReports = async (req, res) => {
  try {
    const { page, limit, offset } = paginationFrom(req.query);
    const { rows: reports, count: total } = await Report.findAndCountAll({
      where: { patientId: req.user.id },
      include: [{ association: 'clinic', attributes: ['name', 'profilePhoto'] }, { association: 'doctor', attributes: ['name', 'specialties'] }],
      order: [['createdAt', 'DESC']], limit, offset
    });
    res.json({ reports: reports.map(publicReportShape), totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch patient reports' }); }
};

export const getClinicReports = async (req, res) => {
  try {
    const { page, limit, offset } = paginationFrom(req.query);
    const clinicId = resolveAuthorizedClinicId(req, req.query.clinicId);
    const { rows: reports, count: total } = await Report.findAndCountAll({
      where: { clinicId },
      include: [{ association: 'patient', attributes: ['name', 'phone'] }, { association: 'doctor', attributes: ['name', 'specialties'] }],
      order: [['createdAt', 'DESC']], limit, offset
    });
    res.json({ reports: reports.map(publicReportShape), totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) {
    const response = clinicAccessError(error, 'Failed to fetch clinic reports');
    res.status(response.status).json({ error: response.message });
  }
};

export const downloadReportPDF = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = String(req.user.id);
    const report = await Report.findByPk(reportId, { include: ['patient', 'clinic', 'doctor'] });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isOwner = userId === String(report.patientId);
    const isClinic = userId === String(report.clinicId);
    const isDoctor = userId === String(report.doctorId);
    if (!isOwner && !isClinic && !isDoctor) return res.status(403).json({ error: 'Unauthorized to view this medical record' });

    const { stream, contentLength } = await reportService.getReportFile(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="MedicalReport-${reportId}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    stream.on('error', (err) => { if (!res.headersSent) res.status(500).send('Error streaming PDF'); });
    stream.pipe(res);
    if (isOwner && !report.isRead) report.update({ isRead: true }).catch(console.error);
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
};

export const markReportAsRead = async (req, res) => {
  try {
    const [updated] = await Report.update({ isRead: true }, { where: { id: req.params.reportId, patientId: req.user.id } });
    if (!updated) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Update failed' }); }
};

export const getReportOptions = async (req, res) => {
  try {
    const clinicId = resolveAuthorizedClinicId(req, req.query.clinicId);
    const options = await reportService.fetchReportOptions(clinicId);
    res.json({ success: true, options });
  } catch (error) {
    const response = clinicAccessError(error, 'Failed to fetch options');
    res.status(response.status).json({ error: response.message });
  }
};

export const getCustomTemplates = async (req, res) => {
  try {
    const clinicId = resolveAuthorizedClinicId(req, req.query.clinicId);
    const templates = await reportService.getTemplatesForClinic(clinicId);
    res.json({ success: true, templates });
  } catch (error) {
    const response = clinicAccessError(error, 'Failed to fetch templates');
    res.status(response.status).json({ error: response.message });
  }
};

export const saveCustomTemplates = async (req, res) => {
  try {
    const clinicId = resolveAuthorizedClinicId(req, req.body.clinicId);
    await reportService.updateClinicTemplates(clinicId, req.body.templates);
    res.json({ success: true, message: 'Templates saved successfully' });
  } catch (error) {
    const status = error.message === 'CLINIC_NOT_FOUND' ? 404
      : error.message === 'CLINIC_ACCESS_DENIED' ? 403
        : 500;
    res.status(status).json({ error: error.message });
  }
};
