import Doctor from '../models/Doctor.js';
import Clinic from '../models/Clinic.js';
import PendingUser from '../models/PendingUser.js';
import sequelize from '../config/database.js';

// Debug doctor login issues
export const debugDoctorLogin = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if doctor exists
    const doctor = await Doctor.findOne({ where: { email } });
    const clinic = await Clinic.findOne({ where: { email } });
    const pendingUser = await PendingUser.findOne({ 
      where: sequelize.literal(`user_data->>'email' = '${email}'`)
    });

    const debugInfo = {
      email,
      doctorExists: !!doctor,
      clinicExists: !!clinic,
      pendingUserExists: !!pendingUser,
      doctorInfo: doctor ? {
        id: doctor.id,
        name: doctor.name,
        emailVerified: doctor.emailVerified,
        hasVerificationCode: !!doctor.verificationCode,
        verificationExpires: doctor.verificationCodeExpires,
        clinicsCount: doctor.clinics?.length || 0,
        role: doctor.role
      } : null,
      clinicInfo: clinic ? {
        id: clinic.id,
        name: clinic.name,
        emailVerified: clinic.emailVerified,
        hasVerificationCode: !!clinic.verificationCode,
        role: clinic.role
      } : null,
      pendingUserInfo: pendingUser ? {
        id: pendingUser.id,
        userType: pendingUser.userType,
        status: pendingUser.status,
        hasVerificationCode: !!pendingUser.verificationCode
      } : null
    };

    res.json(debugInfo);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};

// Test doctor creation
export const testDoctorCreation = async (req, res) => {
  try {
    const { name, email, password, phone, specialties, licenseNumber } = req.body;

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ where: { email } });
    if (existingDoctor) {
      return res.status(400).json({ error: 'Doctor already exists' });
    }

    // Create test doctor
    const doctor = await Doctor.create({
      name,
      email,
      password,
      phone,
      specialties: specialties || ['General Medicine'],
      qualifications: [{
        degree: 'MBBS',
        institution: 'Test University',
        year: 2020
      }],
      licenseNumber,
      clinics: [],
      emailVerified: true // Skip verification for testing
    });

    res.json({
      message: 'Test doctor created successfully',
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialties: doctor.specialties,
        emailVerified: doctor.emailVerified
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Compare doctor vs clinic login flow
export const compareLoginFlows = async (req, res) => {
  try {
    const { doctorEmail, clinicEmail } = req.body;

    const doctor = doctorEmail ? await Doctor.findOne({ where: { email: doctorEmail } }) : null;
    const clinic = clinicEmail ? await Clinic.findOne({ where: { email: clinicEmail } }) : null;

    const comparison = {
      doctor: doctor ? {
        email: doctor.email,
        emailVerified: doctor.emailVerified,
        hasPassword: !!doctor.password,
        hasVerificationCode: !!doctor.verificationCode,
        verificationExpires: doctor.verificationCodeExpires,
        role: doctor.role,
        clinicsCount: doctor.clinics?.length || 0,
        structure: 'Complex (has clinics array)'
      } : null,
      clinic: clinic ? {
        email: clinic.email,
        emailVerified: clinic.emailVerified,
        hasPassword: !!clinic.password,
        hasVerificationCode: !!clinic.verificationCode,
        verificationExpires: clinic.verificationCodeExpires,
        role: clinic.role,
        structure: 'Simple (direct fields)'
      } : null,
      differences: {
        doctorHasClinicsArray: true,
        clinicIsSimpler: true,
        bothUseEmailVerification: true,
        bothHaveRoleField: true
      }
    };

    res.json(comparison);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
