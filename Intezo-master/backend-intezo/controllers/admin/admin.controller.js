import * as adminService from './admin.service.js';
import { Patient, Doctor } from '../../models/index.js';

export const getDashboardStats = async (req, res) => {
  try { res.json(await adminService.getStats()); } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getAllPatients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 10;
    const { data, pagination } = await adminService.getPaginatedRecords(Patient, page, limit);
    res.json({ patients: data, pagination });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getAllDoctors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 10;
    const { data, pagination } = await adminService.getPaginatedRecords(Doctor, page, limit);
    res.json({ doctors: data, pagination });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getAllClinics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 10;
    res.json(await adminService.getClinicsWithDetails(page, limit));
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const deletePatient = async (req, res) => {
  try { await adminService.destroyPatient(req.params.id, req.user?.id); res.json({ message: 'Patient deleted successfully' }); }
  catch (error) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
};

export const deleteDoctor = async (req, res) => {
  try { await adminService.destroyDoctor(req.params.id); res.json({ message: 'Doctor deleted successfully' }); }
  catch (error) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
};

export const updatePatient = async (req, res) => {
  try { res.json({ message: 'Patient updated successfully', patient: await adminService.updatePatientData(req.params.id, req.body) }); }
  catch (error) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
};

export const updateDoctor = async (req, res) => {
  try { res.json({ message: 'Doctor updated successfully', doctor: await adminService.updateDoctorData(req.params.id, req.body) }); }
  catch (error) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
};

export const updateClinic = async (req, res) => {
  try { res.json({ message: 'Clinic updated successfully', clinic: await adminService.updateClinicData(req.params.id, req.body) }); }
  catch (error) { res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message }); }
};

export const removeDoctorFromClinic = async (req, res) => {
  try { await adminService.dissociateDoctorFromClinic(req.params.doctorId, req.params.clinicId); res.json({ message: 'Doctor removed from clinic successfully' }); }
  catch (error) { res.status(error.message === 'Doctor not found' ? 404 : 500).json({ error: error.message }); }
};

export const getPendingApprovals = async (req, res) => {
  try { res.json({ pendingUsers: await adminService.fetchPendingApprovals() }); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

export const approveRegistration = async (req, res) => {
  try {
    const result = await adminService.processRegistrationApproval(req.params.id, req.user?.id);
    res.json({ message: `${result.userType} approved successfully` });
  } catch (error) { res.status(error.message === 'Pending user not found' ? 404 : 500).json({ error: error.message }); }
};

export const rejectRegistration = async (req, res) => {
  try {
    const userType = await adminService.processRegistrationRejection(req.params.id);
    res.json({ message: `${userType} registration rejected` });
  } catch (error) { res.status(error.message === 'Pending user not found' ? 404 : 500).json({ error: error.message }); }
};

export const deleteClinic = async (req, res) => {
  try { await adminService.destroyClinic(req.params.id); res.json({ message: 'Clinic deleted successfully' }); }
  catch (error) { res.status(error.message === 'Clinic not found' ? 404 : 500).json({ error: error.message }); }
};

export const getOnlineUsers = async (req, res) => {
  const onlineUsers = await adminService.fetchOnlineUsers();
  res.json({ onlineUsers });
};

export const logoutUser = async (req, res) => {
  try { await adminService.processUserLogout(req.user?.id); res.json({ message: 'Logged out successfully' }); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

export const getPendingPremiumPayments = async (req, res) => {
  try { res.json({ payments: await adminService.fetchPendingPayments() }); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

export const getPremiumUsers = async (req, res) => {
  try { res.json(await adminService.fetchPremiumUsers()); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

export const approvePremiumPayment = async (req, res) => {
  try { await adminService.handlePremiumApproval(req.params.id, req.user.id); res.json({ message: 'Premium payment approved successfully' }); }
  catch (error) { res.status(error.message === 'Payment not found' ? 404 : error.message === 'Payment already processed' ? 400 : 500).json({ error: error.message }); }
};

export const rejectPremiumPayment = async (req, res) => {
  try { await adminService.handlePremiumRejection(req.params.id, req.body.reason, req.user.id); res.json({ message: 'Premium payment rejected successfully' }); }
  catch (error) { res.status(error.message === 'Payment not found' ? 404 : error.message === 'Payment already processed' ? 400 : 500).json({ error: error.message }); }
};
