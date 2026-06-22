import * as debugService from './debug.service.js';

export const debugDoctorLogin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const data = await debugService.getAccountStatus(email);

    res.json({
      exists: {
        doctor: !!data.doctor,
        clinic: !!data.clinic,
        pending: !!data.pendingUser
      },
      doctorInfo: data.doctor ? {
        id: data.doctor.id,
        emailVerified: data.doctor.emailVerified,
        hasVerificationCode: !!data.doctor.verificationCode,
        clinicsCount: data.doctor.clinics?.length || 0,
        role: data.doctor.role
      } : null,
      clinicInfo: data.clinic ? {
        id: data.clinic.id,
        emailVerified: data.clinic.emailVerified,
        role: data.clinic.role
      } : null,
      pendingUserInfo: data.pendingUser ? {
        userType: data.pendingUser.userType,
        status: data.pendingUser.status
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
};

export const testDoctorCreation = async (req, res) => {
  try {
    const doctor = await debugService.createTestDoctorAccount(req.body);
    res.status(201).json({
      message: 'Test doctor created successfully',
      doctor: { id: doctor.id, email: doctor.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const compareLoginFlows = async (req, res) => {
  try {
    const { doctorEmail, clinicEmail } = req.body;
    
    const [doctorData, clinicData] = await Promise.all([
      doctorEmail ? debugService.getAccountStatus(doctorEmail) : null,
      clinicEmail ? debugService.getAccountStatus(clinicEmail) : null
    ]);

    res.json({
      doctor: doctorData?.doctor ? {
        email: doctorData.doctor.email,
        structure: 'Complex (Clinics Array)',
        role: doctorData.doctor.role
      } : null,
      clinic: clinicData?.clinic ? {
        email: clinicData.clinic.email,
        structure: 'Simple (Direct)',
        role: clinicData.clinic.role
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};