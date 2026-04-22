import Clinic from '../models/Clinic.js';
import Doctor from '../models/Doctor.js';
import PendingUser from '../models/PendingUser.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Patient from '../models/Patient.js';
import emailService from '../services/emailService.js';
import { logActivity, publishAdminUpdate } from '../services/realtime.js';
import redisClient from '../config/redis.js';
import { Op } from 'sequelize';


// Patient registration with email verification
export const registerPatient = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email and phone are required' });
    }

    // Check if patient already exists
    const existingPatient = await Patient.findOne({ 
      where: {
        [Op.or]: [{ email }, { phone }]
      }
    });
    if (existingPatient) {
      const field = existingPatient.email === email ? 'email' : 'phone number';
      return res.status(400).json({ error: `Patient already exists with this ${field}` });
    }

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 60 * 1000);

    // Store in pending collection instead of creating patient
    const pendingUser = new PendingUser({
      userData: {
        name,
        email,
        phone
      },
      userType: 'patient',
      verificationCode,
      verificationCodeExpires: verificationExpires
    });

    await pendingUser.save();

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, 'Patient');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.status(201).json({
      message: 'Verification code sent to your email. Please verify to complete registration.',
      tip: 'If you don\'t see the email, please check your spam/junk folder.',
      pendingId: pendingUser._id,
      requiresVerification: true
    });
  } catch (err) {
    console.error('Patient registration error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Patient login with email verification check
export const patientLogin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check for demo account - bypass verification
    if (email === 'demo.patient@intezo.com') {
      let patient = await Patient.findOne({ where: { email } });
      
      // Create demo patient if doesn't exist
      if (!patient) {
        patient = new Patient({
          name: 'Demo Patient',
          email: 'demo.patient@intezo.com',
          phone: '+974-5555-0002',
          emailVerified: true
        });
        await patient.save();
      }

      const token = jwt.sign(
        { id: patient._id, role: 'patient' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Demo patient login successful',
        token,
        patient: {
          _id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone
        }
      });
    }

    // Find patient by email
    const patient = await Patient.findOne({ where: { email } });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Always require email verification on login for non-demo accounts
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    patient.verificationCode = verificationCode;
    patient.verificationCodeExpires = verificationExpires;
    await patient.save();
    
    // Send verification email
    await emailService.sendVerificationEmail(email, verificationCode, 'Patient');
    
    return res.status(403).json({ 
      error: 'Verification code sent to your email.',
      tip: 'If you don\'t see the email, please check your spam/junk folder.',
      patientId: patient._id,
      requiresVerification: true
    });
  } catch (err) {
    console.error('Patient login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};
// Enhanced error handling and validation
const generateToken = (clinic) => {
  return jwt.sign(
    { 
      id: clinic.id, 
      email: clinic.email,
      role: clinic.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// In authController.js - Update the registerClinic function
export const registerClinic = async (req, res) => {
  try {
    const { name, email, password, phone, address, services, operatingHours } = req.body;

    // Check if clinic already exists
    const existingClinic = await Clinic.findOne({
      where: {
        [Op.or]: [{ email }, { phone }]
      }
    });

    if (existingClinic) {
      const conflictField = existingClinic.email === email ? 'email' : 'phone';
      return res.status(400).json({ error: `Clinic already exists with this ${conflictField}` });
    }

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Store in pending collection instead of creating clinic
    const pendingUser = new PendingUser({
      userData: {
        name,
        email,
        password,
        phone,
        address,
        services: services || ['General Consultation'],
        operatingHours: operatingHours || {
          opening: '09:00',
          closing: '17:00'
        }
      },
      userType: 'clinic',
      verificationCode,
      verificationCodeExpires: verificationExpires
    });

    await pendingUser.save();

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, 'Clinic');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.status(201).json({
      message: 'Verification code sent to your email. Please verify to complete registration.',
      tip: 'If you don\'t see the email, please check your spam/junk folder.',
      pendingId: pendingUser._id,
      requiresVerification: true
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const loginClinic = async (req, res) => {
  try {
    console.log('Login request received:', { body: req.body, headers: req.headers['content-type'] });
    const { email, password } = req.body;
    if (!email || !password) {
      console.log('Missing credentials:', { email: !!email, password: !!password });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const clinic = await Clinic.findOne({ where: { email } });
    if (!clinic) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await clinic.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Always require email verification on every login
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = Date.now() + 60 * 1000; // 60 seconds from now
    
    clinic.verificationCode = verificationCode;
    clinic.verificationCodeExpires = verificationExpires;
    await clinic.save();
    
    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, 'Clinic');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
    
    console.log('Verification email sent, returning clinicId:', clinic.id);
    return res.status(200).json({ 
      message: 'Verification code sent to your email.',
      tip: 'If you don\'t see the email, please check your spam/junk folder.',
      clinicId: clinic.id,
      requiresVerification: true
    });
  } catch (err) {
    console.error('Login controller error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};

// Add to authController.js
export const logoutFromAllDevices = async (req, res) => {
  try {
    // For patients
    if (req.patient) {
      // Clear any device-specific tokens or sessions
      await Patient.update(
        { fcmToken: null },
        { where: { id: req.patient._id } }
      );
      
      return res.json({ 
        success: true, 
        message: 'Logged out from all devices successfully' 
      });
    }
    
    // For clinics
    if (req.clinic) {
      // Implement clinic logout logic if needed
      return res.json({ 
        success: true, 
        message: 'Logged out from all devices successfully' 
      });
    }
    
    res.status(401).json({ error: 'Not authenticated' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Doctor authentication
export const registerDoctor = async (req, res) => {
  try {
    const { name, email, password, phone, specialties, qualifications, licenseNumber } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !licenseNumber) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const existingDoctor = await Doctor.findOne({
      where: {
        [Op.or]: [{ email }, { licenseNumber }]
      }
    });

    if (existingDoctor) {
      const conflictField = existingDoctor.email === email ? 'email' : 'license number';
      return res.status(400).json({ error: `Doctor already exists with this ${conflictField}` });
    }

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Store in pending collection instead of creating doctor
    const pendingUser = new PendingUser({
      userData: {
        name,
        email,
        password,
        phone,
        specialties: specialties || ['General Medicine'],
        qualifications: qualifications || [{
          degree: 'MBBS',
          institution: 'Medical University',
          year: new Date().getFullYear() - 5
        }],
        licenseNumber,
        clinics: []
      },
      userType: 'doctor',
      verificationCode,
      verificationCodeExpires: verificationExpires
    });

    await pendingUser.save();

    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, 'Doctor');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.status(201).json({
      message: 'Verification code sent to your email. Please verify to complete registration.',
      tip: 'If you don\'t see the email, please check your spam/junk folder.',
      pendingId: pendingUser._id,
      requiresVerification: true
    });
  } catch (err) {
    console.error('Doctor registration error:', err);
    res.status(400).json({ error: err.message });
  }
};

export const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find doctor without population to avoid potential issues
    const doctor = await Doctor.findOne({ where: { email } });
    if (!doctor) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Always require email verification on every login
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    doctor.verificationCode = verificationCode;
    doctor.verificationCodeExpires = verificationExpires;
    await doctor.save();
    
    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, 'Doctor');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
    
    return res.status(202).json({ 
      success: true,
      message: 'Verification code sent to your email.',
      tip: 'If you don\'t see the email, please check your spam/junk folder.',
      doctorId: doctor._id,
      requiresVerification: true
    });
  } catch (err) {
    console.error('Doctor login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
};

// Email verification endpoints
export const verifyDoctorEmail = async (req, res) => {
  try {
    const { doctorId, verificationCode } = req.body;
    
    if (!doctorId || !verificationCode) {
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    // Check if it's a pending user or existing doctor
    let pendingUser = await PendingUser.findByPk(doctorId);
    
    if (pendingUser) {
      // Handle pending registration
      if (pendingUser.verificationCode !== verificationCode) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      if (new Date() > pendingUser.verificationCodeExpires) {
        return res.status(400).json({ error: 'Verification code expired' });
      }

      // Move to pending approval instead of creating doctor
      pendingUser.status = 'pending_approval';
      pendingUser.verificationCode = undefined;
      pendingUser.verificationCodeExpires = undefined;
      await pendingUser.save();

      return res.json({
        message: 'Email verified successfully. Your registration is now pending admin approval.',
        status: 'pending_approval'
      });
    }

    // Handle existing doctor verification - find without population first
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (!doctor.verificationCode || doctor.verificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > doctor.verificationCodeExpires) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    doctor.emailVerified = true;
    doctor.verificationCode = undefined;
    doctor.verificationCodeExpires = undefined;
    await doctor.save();

    // Now populate clinics after saving
    const populatedDoctor = await Doctor.findByPk(doctor.id, {
      include: [{ association: 'clinics', attributes: ['name', 'address'] }],
      attributes: { exclude: ['password'] }
    });

    const token = jwt.sign(
      { id: doctor._id, role: 'doctor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Track online status
    try {
      await redisClient.setEx(`user:${doctor._id}:online`, 86400, JSON.stringify({
        id: doctor._id,
        name: doctor.name,
        role: 'doctor',
        loginTime: new Date()
      }));
    } catch (redisError) {
      console.log('Redis not available, skipping online tracking');
    }
    
    await logActivity('user_login', `Doctor ${doctor.name} logged in`);
    await publishAdminUpdate('user_online', {
      userId: doctor._id,
      name: doctor.name,
      role: 'doctor',
      status: 'online'
    });

    res.json({
      message: 'Login successful',
      token,
      doctor: {
        _id: populatedDoctor._id,
        name: populatedDoctor.name,
        email: populatedDoctor.email,
        phone: populatedDoctor.phone,
        specialties: populatedDoctor.specialties,
        qualifications: populatedDoctor.qualifications,
        licenseNumber: populatedDoctor.licenseNumber,
        clinics: populatedDoctor.clinics,
        role: populatedDoctor.role
      }
    });
  } catch (err) {
    console.error('Doctor email verification error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
};

export const verifyClinicEmail = async (req, res) => {
  try {
    console.log('Verify clinic request received:', { body: req.body });
    const { clinicId, verificationCode } = req.body;
    
    if (!clinicId || !verificationCode) {
      console.log('Missing parameters:', { clinicId: !!clinicId, verificationCode: !!verificationCode });
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    // Check if it's a pending user or existing clinic
    let pendingUser = await PendingUser.findByPk(clinicId);
    console.log('Pending user found:', !!pendingUser);
    
    if (pendingUser) {
      console.log('Pending user verification code:', pendingUser.verificationCode);
      console.log('Provided verification code:', verificationCode);
      console.log('Code expires at:', pendingUser.verificationCodeExpires);
      console.log('Current time:', new Date());
      
      // Handle pending registration
      if (pendingUser.verificationCode !== verificationCode) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      if (new Date() > pendingUser.verificationCodeExpires) {
        return res.status(400).json({ error: 'Verification code expired' });
      }

      // Move to pending approval instead of creating clinic
      pendingUser.status = 'pending_approval';
      pendingUser.verificationCode = undefined;
      pendingUser.verificationCodeExpires = undefined;
      await pendingUser.save();

      return res.json({
        message: 'Email verified successfully. Your registration is now pending admin approval.',
        status: 'pending_approval'
      });
    }

    // Handle existing clinic verification
    const clinic = await Clinic.findByPk(clinicId);
    console.log('Existing clinic found:', !!clinic);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    if (!clinic.verificationCode || clinic.verificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Compare Unix timestamps
    const now = Date.now();
    const expiresAt = parseInt(clinic.verificationCodeExpires);
    
    if (now > expiresAt) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    clinic.emailVerified = true;
    clinic.verificationCode = undefined;
    clinic.verificationCodeExpires = undefined;
    await clinic.save();

    const token = generateToken(clinic);

    // Track online status
    try {
      await redisClient.setEx(`user:${clinic.id}:online`, 86400, JSON.stringify({
        id: clinic.id,
        name: clinic.name,
        role: 'clinic',
        loginTime: new Date()
      }));
    } catch (redisError) {
      console.log('Redis not available, skipping online tracking');
    }
    
    await logActivity('user_login', `Clinic ${clinic.name} logged in`);
    await publishAdminUpdate('user_online', {
      userId: clinic.id,
      name: clinic.name,
      role: 'clinic',
      status: 'online'
    });

    res.json({
      message: 'Login successful',
      token,
      clinic: {
        _id: clinic.id,
        name: clinic.name,
        email: clinic.email,
        phone: clinic.phone,
        address: clinic.address,
        services: clinic.services,
        operatingHours: clinic.operatingHours,
        isOpen: clinic.isOpen,
        role: clinic.role
      }
    });
  } catch (err) {
    console.error('Clinic email verification error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
};

// Resend verification code endpoints
export const resendDoctorVerification = async (req, res) => {
  try {
    const { doctorId } = req.body;
    
    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }
    
    // Check pending users first
    let pendingUser = await PendingUser.findByPk(doctorId);
    if (pendingUser) {
      const verificationCode = emailService.generateVerificationCode();
      const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
      
      pendingUser.verificationCode = verificationCode;
      pendingUser.verificationCodeExpires = verificationExpires;
      await pendingUser.save();
      
      const emailSent = await emailService.sendVerificationEmail(pendingUser.userData.email, verificationCode, 'Doctor');
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }
      return res.json({ 
        message: 'Verification code sent successfully',
        tip: 'If you don\'t see the email, please check your spam/junk folder.'
      });
    }

    // Check existing doctors
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Allow resending even if already verified for login flow
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    doctor.verificationCode = verificationCode;
    doctor.verificationCodeExpires = verificationExpires;
    await doctor.save();
    
    const emailSent = await emailService.sendVerificationEmail(doctor.email, verificationCode, 'Doctor');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({ 
      message: 'Verification code sent successfully',
      tip: 'If you don\'t see the email, please check your spam/junk folder.'
    });
  } catch (err) {
    console.error('Resend doctor verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code', details: err.message });
  }
};

export const resendClinicVerification = async (req, res) => {
  try {
    const { clinicId } = req.body;
    
    // Check pending users first
    let pendingUser = await PendingUser.findByPk(clinicId);
    if (pendingUser) {
      const verificationCode = emailService.generateVerificationCode();
      const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
      
      pendingUser.verificationCode = verificationCode;
      pendingUser.verificationCodeExpires = verificationExpires;
      await pendingUser.save();
      
      const emailSent = await emailService.sendVerificationEmail(pendingUser.userData.email, verificationCode, 'Clinic');
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }
      return res.json({ message: 'Verification code sent successfully' });
    }

    // Check existing clinics
    const clinic = await Clinic.findByPk(clinicId);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    if (clinic.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    clinic.verificationCode = verificationCode;
    clinic.verificationCodeExpires = verificationExpires;
    await clinic.save();
    
    const emailSent = await emailService.sendVerificationEmail(clinic.email, verificationCode, 'Clinic');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({ message: 'Verification code sent successfully' });
  } catch (err) {
    console.error('Resend clinic verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
};

// Patient email verification
export const verifyPatientEmail = async (req, res) => {
  try {
    const { patientId, verificationCode } = req.body;
    
    if (!patientId || !verificationCode) {
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    // Check if it's a pending user or existing patient
    let pendingUser = await PendingUser.findByPk(patientId);
    
    if (pendingUser) {
      // Handle pending registration
      if (pendingUser.verificationCode !== verificationCode) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      if (new Date() > pendingUser.verificationCodeExpires) {
        return res.status(400).json({ error: 'Verification code expired' });
      }

      // Create actual patient from pending data
      const patient = new Patient({
        ...pendingUser.userData,
        emailVerified: true
      });

      await patient.save();
      await PendingUser.destroy({ where: { id: patientId } });

      const token = jwt.sign(
        { id: patient._id, role: 'patient' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Registration completed successfully',
        token,
        patient: {
          _id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone
        }
      });
    }

    // Handle existing patient verification
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Allow verification for login flow even if already verified
    // if (patient.emailVerified) {
    //   return res.status(400).json({ error: 'Email already verified' });
    // }

    if (!patient.verificationCode) {
      return res.status(400).json({ error: 'No verification code found' });
    }

    const isValidCode = await patient.compareVerificationCode(verificationCode);
    if (!isValidCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > patient.verificationCodeExpires) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    patient.emailVerified = true;
    patient.verificationCode = undefined;
    patient.verificationCodeExpires = undefined;
    await patient.save();

    const token = jwt.sign(
      { id: patient._id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Track online status
    try {
      await redisClient.setEx(`user:${patient._id}:online`, 86400, JSON.stringify({
        id: patient._id,
        name: patient.name,
        role: 'patient',
        loginTime: new Date()
      }));
    } catch (redisError) {
      console.log('Redis not available, skipping online tracking');
    }
    
    await logActivity('user_login', `Patient ${patient.name} logged in`);
    await publishAdminUpdate('user_online', {
      userId: patient._id,
      name: patient.name,
      role: 'patient',
      status: 'online'
    });

    res.json({
      message: 'Email verified successfully',
      token,
      patient: {
        _id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone
      }
    });
  } catch (err) {
    console.error('Patient email verification error:', err);
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
};

// Resend patient verification code
export const resendPatientVerification = async (req, res) => {
  try {
    const { patientId } = req.body;
    
    // Check pending users first
    let pendingUser = await PendingUser.findByPk(patientId);
    if (pendingUser) {
      const verificationCode = emailService.generateVerificationCode();
      const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
      
      pendingUser.verificationCode = verificationCode;
      pendingUser.verificationCodeExpires = verificationExpires;
      await pendingUser.save();
      
      const emailSent = await emailService.sendVerificationEmail(pendingUser.userData.email, verificationCode, 'Patient');
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }
      return res.json({ message: 'Verification code sent successfully' });
    }

    // Check existing patients
    const patient = await Patient.findByPk(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (patient.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    patient.verificationCode = verificationCode;
    patient.verificationCodeExpires = verificationExpires;
    await patient.save();
    
    const emailSent = await emailService.sendVerificationEmail(patient.email, verificationCode, 'Patient');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({ message: 'Verification code sent successfully' });
  } catch (err) {
    console.error('Resend patient verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
};

// Admin login with email verification
export const loginAdmin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }



    // Find admin user
    const admin = await User.findOne({ where: { email, role: 'admin' } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    
    admin.verificationCode = verificationCode;
    admin.verificationCodeExpires = verificationExpires;
    await admin.save();
    
    // Send verification email
    const emailSent = await emailService.sendVerificationEmail(email, verificationCode, 'Admin');
    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
    
    res.json({ 
      message: 'Verification code sent to your email.',
      adminId: admin._id,
      requiresVerification: true
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Admin email verification
export const verifyAdminEmail = async (req, res) => {
  try {
    const { adminId, verificationCode } = req.body;
    
    if (!adminId || !verificationCode) {
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    const admin = await User.findByPk(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (!admin.verificationCode || admin.verificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > admin.verificationCodeExpires) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    admin.verificationCode = undefined;
    admin.verificationCodeExpires = undefined;
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, role: 'admin', email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Track online status
    try {
      await redisClient.setEx(`user:${admin._id}:online`, 86400, JSON.stringify({
        id: admin._id,
        name: admin.name,
        role: 'admin',
        loginTime: new Date()
      }));
    } catch (redisError) {
      console.log('Redis not available, skipping online tracking');
    }
    
    await logActivity('user_login', `Admin ${admin.name} logged in`);
    await publishAdminUpdate('user_online', {
      userId: admin._id,
      name: admin.name,
      role: 'admin',
      status: 'online'
    });

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Admin email verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// Explicit logout
export const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    try {
      await redisClient.del(`user:${decoded.id}:online`);
    } catch (redisError) {
      console.log('Redis not available for logout');
    }
    
    await logActivity('user_logout', `User logged out`);
    await publishAdminUpdate('user_offline', { userId: decoded.id, status: 'offline' });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};