import { Patient, Clinic, Doctor, PendingUser, User } from '../../models/index.js';
import redisClient from '../../config/redis.js';
import { json, Op, where as sequelizeWhere } from 'sequelize';
import jwt from 'jsonwebtoken';
import emailService from '../../services/emailService.js';
import { logActivity, publishAdminUpdate } from '../../utils/helpers.js';

export const createToken = (user, role) => jwt.sign({ id: user.id, email: user.email, role: role || user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// TESTING ONLY: when SKIP_EMAIL_VERIFICATION=true, patient email verification is
// bypassed (no email is sent and any code is accepted). Leave unset in production.
const skipPatientEmailVerification = () => process.env.SKIP_EMAIL_VERIFICATION === 'true';

const validateCode = (record, code) => {
  const storedCode = String(record.verificationCode || '').trim();
  const submittedCode = String(code || '').trim();

  if (!storedCode || storedCode !== submittedCode) throw new Error('Invalid verification code');
  if (new Date() > record.verificationCodeExpires) throw new Error('Verification code expired');
};

async function handleUserOnlineTracking(user, role) {
  try { await redisClient.setEx(`user:${user.id}:online`, 86400, JSON.stringify({ id: user.id, name: user.name, role, loginTime: new Date() })); } catch (err) { console.warn('Redis offline, skipping status tracking'); }
  await logActivity('user_login', `${role.charAt(0).toUpperCase() + role.slice(1)} ${user.name} logged in`);
  await publishAdminUpdate('user_online', { userId: user.id, name: user.name, role, status: 'online' });
}

export const initiatePatientRegistration = async (userData) => {
  const { name, email, phone } = userData;
  const existingPatient = await Patient.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
  if (existingPatient) throw new Error(`Patient already exists with this ${existingPatient.email === email ? 'email' : 'phone number'}`);
  const verificationCode = emailService.generateVerificationCode();
  const pendingUser = await PendingUser.create({ userData: { name, email, phone }, userType: 'patient', verificationCode, verificationCodeExpires: new Date(Date.now() + 60 * 1000) });
  if (!skipPatientEmailVerification()) {
    if (!await emailService.sendVerificationEmail(email, verificationCode, 'Patient')) throw new Error('Failed to send verification email');
  }
  return pendingUser.id;
};

export const handlePatientLogin = async (email) => {
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_DEMO_LOGIN === 'true' &&
    email === 'demo.patient@intezo.com'
  ) {
    let patient = await Patient.findOne({ where: { email } });
    if (!patient) patient = await Patient.create({ name: 'Demo Patient', email, phone: '+974-5555-0002', emailVerified: true });
    return { isDemo: true, token: createToken(patient, 'patient'), patient };
  }
  const patient = await Patient.findOne({ where: { email } });
  if (!patient) throw new Error('Patient not found');
  if (skipPatientEmailVerification()) {
    return { isDemo: true, token: createToken(patient, 'patient'), patient };
  }
  const verificationCode = emailService.generateVerificationCode();
  await patient.update({ verificationCode, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
  await emailService.sendVerificationEmail(email, verificationCode, 'Patient');
  return { isDemo: false, patientId: patient.id };
};

export const initiateClinicRegistration = async (clinicData) => {
  const { email, phone, services, operatingHours } = clinicData;
  const existingClinic = await Clinic.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
  if (existingClinic) throw new Error(`Clinic already exists with this ${existingClinic.email === email ? 'email' : 'phone'}`);
  const verificationCode = emailService.generateVerificationCode();
  const pendingUser = await PendingUser.create({ userData: { ...clinicData, services: services || ['General Consultation'], operatingHours: operatingHours || { opening: '09:00', closing: '17:00' } }, userType: 'clinic', verificationCode, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
  if (!await emailService.sendVerificationEmail(email, verificationCode, 'Clinic')) throw new Error('Failed to send verification email');
  return pendingUser.id;
};

export const handleClinicLogin = async (email, password) => {
  const clinic = await Clinic.findOne({ where: { email } });
  if (!clinic || !(await clinic.comparePassword(password))) throw new Error('Invalid credentials');
  const verificationCode = emailService.generateVerificationCode();
  await clinic.update({ verificationCode, verificationCodeExpires: new Date(Date.now() + 60 * 1000) });
  if (!await emailService.sendVerificationEmail(email, verificationCode, 'Clinic')) throw new Error('Failed to send verification email');
  return clinic.id;
};

export const initiateDoctorRegistration = async (doctorData) => {
  const { email, licenseNumber, specialties, qualifications } = doctorData;
  const existingDoctor = await Doctor.findOne({ where: { [Op.or]: [{ email }, { licenseNumber }] } });
  if (existingDoctor) throw new Error(`Doctor already exists with this ${existingDoctor.email === email ? 'email' : 'license number'}`);

  const existingPending = await PendingUser.findOne({
    where: {
      userType: 'doctor',
      [Op.or]: [
        sequelizeWhere(json('user_data.email'), email),
        sequelizeWhere(json('user_data.licenseNumber'), licenseNumber)
      ]
    },
    order: [['createdAt', 'DESC']]
  });

  if (existingPending?.status === 'pending_approval') {
    throw new Error('This doctor registration is already verified and pending admin approval');
  }

  const verificationCode = emailService.generateVerificationCode();
  const pendingData = {
    ...doctorData,
    specialties: specialties || ['General Medicine'],
    qualifications: qualifications || [{ degree: 'MBBS', institution: 'Medical University', year: new Date().getFullYear() - 5 }],
    clinics: []
  };
  const pendingUser = existingPending || await PendingUser.create({ userData: pendingData, userType: 'doctor' });

  await pendingUser.update({
    userData: pendingData,
    status: 'pending_verification',
    verificationCode,
    verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000)
  });

  if (!await emailService.sendVerificationEmail(email, verificationCode, 'Doctor')) throw new Error('Failed to send verification email');
  return pendingUser.id;
};

export const handleDoctorLogin = async (email, password) => {
  const doctor = await Doctor.findOne({ where: { email } });
  if (!doctor || !(await doctor.comparePassword(password))) throw new Error('Invalid credentials');
  const verificationCode = emailService.generateVerificationCode();
  await doctor.update({ verificationCode, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
  if (!await emailService.sendVerificationEmail(email, verificationCode, 'Doctor')) throw new Error('Failed to send verification email');
  return doctor.id;
};

export const verifyDoctorStatus = async (doctorId, verificationCode) => {
  const pendingUser = await PendingUser.findByPk(doctorId);
  if (pendingUser) {
    if (pendingUser.userType !== 'doctor') throw new Error('Doctor not found');
    if (pendingUser.status === 'pending_approval') return { type: 'PENDING_APPROVAL' };
    if (pendingUser.status !== 'pending_verification') throw new Error('Doctor registration cannot be verified');
    validateCode(pendingUser, verificationCode);
    await pendingUser.update({ status: 'pending_approval', verificationCode: null, verificationCodeExpires: null });
    return { type: 'PENDING_APPROVAL' };
  }
  const doctor = await Doctor.findByPk(doctorId);
  if (!doctor) throw new Error('Doctor not found');
  validateCode(doctor, verificationCode);
  await doctor.update({ emailVerified: true, verificationCode: null, verificationCodeExpires: null });
  const token = createToken(doctor, 'doctor');
  await handleUserOnlineTracking(doctor, 'doctor');
  return { type: 'LOGIN_SUCCESS', token, doctor };
};

export const verifyClinicStatus = async (clinicId, verificationCode) => {
  const pendingUser = await PendingUser.findByPk(clinicId);
  if (pendingUser) { validateCode(pendingUser, verificationCode); await pendingUser.update({ status: 'pending_approval', verificationCode: null, verificationCodeExpires: null }); return { type: 'PENDING_APPROVAL' }; }
  const clinic = await Clinic.findByPk(clinicId);
  if (!clinic) throw new Error('Clinic not found');
  validateCode(clinic, verificationCode);
  await clinic.update({ emailVerified: true, verificationCode: null, verificationCodeExpires: null });
  const token = createToken(clinic, 'clinic');
  await handleUserOnlineTracking(clinic, 'clinic');
  return { type: 'LOGIN_SUCCESS', token, clinic };
};

export const verifyPatientStatus = async (patientId, verificationCode) => {
  const skipVerification = skipPatientEmailVerification();
  const pendingUser = await PendingUser.findByPk(patientId);
  if (pendingUser) { if (!skipVerification) validateCode(pendingUser, verificationCode); const patient = await Patient.create({ ...pendingUser.userData, emailVerified: true }); await pendingUser.destroy(); return { type: 'REGISTRATION_SUCCESS', token: createToken(patient, 'patient'), patient }; }
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new Error('Patient not found');
  if (!skipVerification) { if (patient.compareVerificationCode) { if (!(await patient.compareVerificationCode(verificationCode))) throw new Error('Invalid verification code'); } else { validateCode(patient, verificationCode); } }
  await patient.update({ emailVerified: true, verificationCode: null, verificationCodeExpires: null });
  const token = createToken(patient, 'patient');
  await handleUserOnlineTracking(patient, 'patient');
  return { type: 'LOGIN_SUCCESS', token, patient };
};

export const resendVerification = async (userId, userType) => {
  const Model = userType === 'Doctor' ? Doctor : Clinic;
  const pendingUser = await PendingUser.findByPk(userId);
  if (pendingUser) {
    const code = emailService.generateVerificationCode();
    await pendingUser.update({ verificationCode: code, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
    if (!await emailService.sendVerificationEmail(pendingUser.userData.email, code, userType)) throw new Error('Email failed');
    return true;
  }
  const user = await Model.findByPk(userId);
  if (!user) throw new Error(`${userType} not found`);
  if (userType === 'Clinic' && user.emailVerified) throw new Error('Email already verified');
  const code = emailService.generateVerificationCode();
  await user.update({ verificationCode: code, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
  if (!await emailService.sendVerificationEmail(user.email, code, userType)) throw new Error('Email failed');
  return true;
};

export const handleAdminLogin = async (email) => {
  const admin = await User.findOne({ where: { email, role: 'admin' } });
  if (!admin) throw new Error('Admin not found');
  const code = emailService.generateVerificationCode();
  await admin.update({ verificationCode: code, verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
  if (!await emailService.sendVerificationEmail(email, code, 'Admin')) throw new Error('Email failed');
  return admin.id;
};

export const verifyAdminStatus = async (adminId, verificationCode) => {
  const admin = await User.findByPk(adminId);
  if (!admin || admin.role !== 'admin') throw new Error('Admin not found');
  validateCode(admin, verificationCode);
  await admin.update({ verificationCode: null, verificationCodeExpires: null });
  const token = createToken(admin, 'admin');
  await handleUserOnlineTracking(admin, 'admin');
  return { token, admin };
};

export const logoutUserFromAll = async (user, type) => { if (type === 'patient') await Patient.update({ fcmToken: null }, { where: { id: user.id } }); return true; };

export const handleUserLogout = async (userId) => {
  try { await redisClient.del(`user:${userId}:online`); } catch (err) { console.warn('Redis offline during logout'); }
  await logActivity('user_logout', `User logged out`);
  await publishAdminUpdate('user_offline', { userId, status: 'offline' });
};
