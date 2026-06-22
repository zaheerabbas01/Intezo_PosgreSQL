import { Patient, Doctor, Clinic, Queue, PendingUser, PremiumPayment } from '../../models/index.js';
import redisClient from '../../config/redis.js';
import emailService from '../../services/emailService.js';
import { logActivity, publishAdminUpdate } from '../../utils/helpers.js';

export const getStats = async () => {
  const [totalPatients, totalDoctors, totalClinics, totalQueues, activeQueues, pendingApprovals] = await Promise.all([Patient.count(), Doctor.count(), Clinic.count(), Queue.count(), Queue.count({ where: { status: ['waiting', 'in_progress'] } }), PendingUser.count({ where: { status: 'pending_approval' } })]);
  return { totalPatients, totalDoctors, totalClinics, totalQueues, activeQueues, pendingApprovals, lastUpdated: new Date() };
};

export const getPaginatedRecords = async (Model, page, limit) => {
  const { rows, count } = await Model.findAndCountAll({ offset: (page - 1) * limit, limit, order: [['createdAt', 'DESC']] });
  return { data: rows, pagination: { current: page, pages: Math.ceil(count / limit), total: count } };
};

export const getClinicsWithDetails = async (page, limit) => {
  const result = await getPaginatedRecords(Clinic, page, limit);
  const enrichedData = await Promise.all(result.data.map(async (clinic) => { const doctors = await Doctor.findAll({ where: { 'clinics.clinic': clinic.id }, attributes: ['name', 'email', 'specialties'] }); return { ...clinic.toJSON(), doctors }; }));
  return { clinics: enrichedData, pagination: result.pagination };
};

export const destroyPatient = async (id, adminId) => {
  const patient = await Patient.findByPk(id);
  if (!patient) throw new Error('Patient not found');
  await patient.destroy();
  await logActivity('patient_deleted', `Patient ${patient.name} deleted`, adminId);
  await publishAdminUpdate('patient_deleted', { patientId: id, patientName: patient.name });
  return true;
};

export const destroyDoctor = async (id) => { const doctor = await Doctor.findByPk(id); if (!doctor) throw new Error('Doctor not found'); await doctor.destroy(); return true; };

const updateRecord = async (Model, id, data) => { const record = await Model.findByPk(id); if (!record) throw new Error(`${Model.name} not found`); return await record.update(data); };
export const updatePatientData = async (id, data) => updateRecord(Patient, id, data);
export const updateDoctorData = async (id, data) => updateRecord(Doctor, id, data);
export const updateClinicData = async (id, data) => updateRecord(Clinic, id, data);

export const dissociateDoctorFromClinic = async (doctorId, clinicId) => {
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  doctor.clinics = doctor.clinics.filter(c => c.clinic.toString() !== clinicId);
  await doctor.save();
  return true;
};

export const fetchPendingApprovals = async () => PendingUser.findAll({ where: { status: 'pending_approval' }, order: [['createdAt', 'DESC']] });

export const processRegistrationApproval = async (pendingId, adminId) => {
  const pendingUser = await PendingUser.findByPk(pendingId);
  if (!pendingUser) throw new Error('Pending user not found');
  const { userData, userType } = pendingUser;
  let newUser;
  const commonData = { ...userData, emailVerified: true };
  if (userType === 'clinic') newUser = await Clinic.create(commonData);
  else if (userType === 'doctor') newUser = await Doctor.create(commonData);
  if (newUser) {
    await emailService.sendApprovalEmail(userData.email, userType, true);
    await logActivity('registration_approved', `${userType} ${userData.name} approved`, adminId);
    await publishAdminUpdate('registration_approved', { userType, email: userData.email, name: userData.name });
    await pendingUser.destroy();
  }
  return { userType, name: userData.name };
};

export const processRegistrationRejection = async (pendingId) => {
  const pendingUser = await PendingUser.findByPk(pendingId);
  if (!pendingUser) throw new Error('Pending user not found');
  await emailService.sendApprovalEmail(pendingUser.userData.email, pendingUser.userType, false);
  const type = pendingUser.userType;
  await pendingUser.destroy();
  return type;
};

export const destroyClinic = async (id) => {
  const clinic = await Clinic.findByPk(id);
  if (!clinic) throw new Error('Clinic not found');
  await clinic.destroy();
  await Doctor.update({ clinics: [] }, { where: { 'clinics.clinic': id } });
  return true;
};

export const fetchOnlineUsers = async () => {
  try {
    const keys = await redisClient.keys('user:*:online');
    const onlineUsers = [];
    for (const key of keys) { const userData = await redisClient.get(key); if (userData) onlineUsers.push(JSON.parse(userData)); }
    return onlineUsers;
  } catch (error) { console.error('Redis error fetching online users:', error.message); return []; }
};

export const processUserLogout = async (userId) => {
  if (!userId) return;
  try { await redisClient.del(`user:${userId}:online`); } catch (error) { console.warn('Redis not available for logout session removal'); }
  await logActivity('user_logout', `User logged out`, userId);
  await publishAdminUpdate('user_offline', { userId, status: 'offline' });
};

export const fetchPendingPayments = async () => PremiumPayment.findAll({ where: { status: 'pending' }, include: [{ model: Patient, as: 'patient', attributes: ['name', 'email', 'phone'] }], order: [['submittedAt', 'DESC']] });

export const handlePremiumApproval = async (paymentId, adminId) => {
  const payment = await PremiumPayment.findByPk(paymentId, { include: [{ model: Patient, as: 'patient' }] });
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'pending') throw new Error('Payment already processed');
  await payment.update({ status: 'approved', reviewedAt: new Date(), reviewedBy: adminId });
  const expirationDate = new Date(); expirationDate.setDate(expirationDate.getDate() + 30);
  await payment.patient.update({ isPremium: true, premiumExpiresAt: expirationDate });
  await logActivity('premium_approved', `Premium approved for ${payment.patient.name}`, adminId);
  await emailService.sendPremiumStatusEmail(payment.patient, 'approved');
  return payment;
};

export const handlePremiumRejection = async (paymentId, reason, adminId) => {
  const payment = await PremiumPayment.findByPk(paymentId, { include: [{ model: Patient, as: 'patient' }] });
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'pending') throw new Error('Payment already processed');
  await payment.update({ status: 'rejected', reviewedAt: new Date(), reviewedBy: adminId, rejectionReason: reason });
  await logActivity('premium_rejected', `Premium rejected for ${payment.patient.name}`, adminId);
  await emailService.sendPremiumStatusEmail(payment.patient, 'rejected', reason);
  return payment;
};
