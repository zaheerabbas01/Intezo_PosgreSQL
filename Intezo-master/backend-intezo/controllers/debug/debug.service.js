import { Doctor, Clinic, PendingUser } from '../../models/index.js';
import sequelize from '../../config/database.js';

export const getAccountStatus = async (email) => {
  // SQL Injection Fix: Use bind parameters for JSON extraction
  const doctor = await Doctor.findOne({ where: { email } });
  const clinic = await Clinic.findOne({ where: { email } });
  const pendingUser = await PendingUser.findOne({
    where: sequelize.literal(`user_data->>'email' = :email`),
    replacements: { email }
  });

  return {
    email,
    doctor,
    clinic,
    pendingUser
  };
};

export const createTestDoctorAccount = async (data) => {
  const { name, email, password, phone, licenseNumber, specialties } = data;

  return await Doctor.create({
    name,
    email,
    password, // Ensure your model hooks hash this if needed
    phone,
    specialties: specialties || ['General Medicine'],
    qualifications: [{
      degree: 'MBBS',
      institution: 'Debug University',
      year: 2024
    }],
    licenseNumber,
    clinics: [],
    emailVerified: true
  });
};