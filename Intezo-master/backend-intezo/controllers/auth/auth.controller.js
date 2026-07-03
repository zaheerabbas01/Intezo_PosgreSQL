import * as authService from './auth.service.js';

export const registerPatient = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email and phone are required' });
    }

    const pendingId = await authService.initiatePatientRegistration({ name, email, phone });

    res.status(201).json({
      message: 'Verification code sent to your email. Please verify to complete registration.',
      tip: "If you don't see the email, please check your spam/junk folder.",
      pendingId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message.includes('already exists') || err.message.includes('pending admin approval') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const patientLogin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await authService.handlePatientLogin(email);

    if (result.isDemo) {
      return res.json({
        message: 'Demo patient login successful',
        token: result.token,
        patient: result.patient
      });
    }

    // Standard flow requires verification
    return res.status(403).json({ 
      error: 'Verification code sent to your email.',
      tip: "If you don't see the email, please check your spam/junk folder.",
      patientId: result.patientId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message === 'Patient not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const registerClinic = async (req, res) => {
  try {
    const pendingId = await authService.initiateClinicRegistration(req.body);

    res.status(201).json({
      message: 'Verification code sent to your email. Please verify to complete registration.',
      tip: "If you don't see the email, please check your spam/junk folder.",
      pendingId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message.includes('already exists') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const loginClinic = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const clinicId = await authService.handleClinicLogin(email, password);

    return res.status(200).json({ 
      message: 'Verification code sent to your email.',
      tip: "If you don't see the email, please check your spam/junk folder.",
      clinicId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message === 'Invalid credentials' ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const logoutFromAllDevices = async (req, res) => {
  try {
    const user = req.patient || req.clinic || req.doctor;
    const type = req.patient ? 'patient' : req.clinic ? 'clinic' : 'doctor';

    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    await authService.logoutUserFromAll(user, type);
    res.json({ success: true, message: 'Logged out from all devices successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

export const registerDoctor = async (req, res) => {
  try {
    const { name, email, password, phone, licenseNumber } = req.body;
    if (!name || !email || !password || !phone || !licenseNumber) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    const pendingId = await authService.initiateDoctorRegistration(req.body);

    res.status(201).json({
      message: 'Verification code sent to your email. Please verify to complete registration.',
      tip: "If you don't see the email, please check your spam/junk folder.",
      pendingId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message.includes('already exists') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const doctorId = await authService.handleDoctorLogin(email, password);

    return res.status(200).json({ 
      success: true,
      message: 'Verification code sent to your email.',
      tip: "If you don't see the email, please check your spam/junk folder.",
      doctorId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message === 'Invalid credentials' ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const verifyDoctorEmail = async (req, res) => {
  try {
    const { doctorId, verificationCode } = req.body;
    
    if (!doctorId || !verificationCode) {
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    const result = await authService.verifyDoctorStatus(doctorId, verificationCode);

    if (result.type === 'PENDING_APPROVAL') {
      return res.json({
        message: 'Email verified successfully. Your registration is now pending admin approval.',
        status: 'pending_approval'
      });
    }

    // Success login path
    res.json({
      message: 'Login successful',
      token: result.token,
      doctor: {
        _id: result.doctor.id,
        name: result.doctor.name,
        email: result.doctor.email,
        phone: result.doctor.phone,
        specialties: result.doctor.specialties,
        qualifications: result.doctor.qualifications,
        licenseNumber: result.doctor.licenseNumber,
        clinics: result.doctor.clinics,
        role: result.doctor.role
      }
    });

  } catch (err) {
    const status = err.message === 'Doctor not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
};

export const verifyClinicEmail = async (req, res) => {
  try {
    const { clinicId, verificationCode } = req.body;
    
    if (!clinicId || !verificationCode) {
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    const result = await authService.verifyClinicStatus(clinicId, verificationCode);

    if (result.type === 'PENDING_APPROVAL') {
      return res.json({
        message: 'Email verified successfully. Your registration is now pending admin approval.',
        status: 'pending_approval'
      });
    }

    // Success login path
    res.json({
      message: 'Login successful',
      token: result.token,
      clinic: {
        id: result.clinic.id,
        name: result.clinic.name,
        email: result.clinic.email,
        phone: result.clinic.phone,
        address: result.clinic.address,
        services: result.clinic.services,
        operatingHours: result.clinic.operatingHours,
        isOpen: result.clinic.isOpen,
        role: result.clinic.role,
        profilePhoto: result.clinic.profilePhoto,
        latitude: result.clinic.latitude,
        longitude: result.clinic.longitude,
        locationUpdatedAt: result.clinic.locationUpdatedAt
      }
    });

  } catch (err) {
    const status = err.message === 'Clinic not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
};

export const resendDoctorVerification = async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ error: 'Doctor ID is required' });

    await authService.resendVerification(doctorId, 'Doctor');

    res.json({ 
      message: 'Verification code sent successfully',
      tip: "If you don't see the email, please check your spam/junk folder."
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const resendClinicVerification = async (req, res) => {
  try {
    const { clinicId } = req.body;
    if (!clinicId) return res.status(400).json({ error: 'Clinic ID is required' });

    await authService.resendVerification(clinicId, 'Clinic');

    res.json({ message: 'Verification code sent successfully' });
  } catch (err) {
    const status = err.message === 'Email already verified' ? 400 : 
                   err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const verifyPatientEmail = async (req, res) => {
  try {
    const { patientId, verificationCode } = req.body;
    
    if (!patientId || !verificationCode) {
      return res.status(400).json({ error: 'ID and verification code are required' });
    }

    const result = await authService.verifyPatientStatus(patientId, verificationCode);

    const isNew = result.type === 'REGISTRATION_SUCCESS';
    
    res.json({
      message: isNew ? 'Registration completed successfully' : 'Email verified successfully',
      token: result.token,
      patient: {
        _id: result.patient.id,
        name: result.patient.name,
        email: result.patient.email,
        phone: result.patient.phone
      }
    });

  } catch (err) {
    const status = err.message === 'Patient not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
};

// Uses the generic resend helper we built in the previous step
export const resendPatientVerification = async (req, res) => {
  try {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

    await authService.resendVerification(patientId, 'Patient');

    res.json({ message: 'Verification code sent successfully' });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
};

export const loginAdmin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const adminId = await authService.handleAdminLogin(email);

    res.json({ 
      message: 'Verification code sent to your email.',
      adminId,
      requiresVerification: true
    });
  } catch (err) {
    const status = err.message === 'Admin not found' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const verifyAdminEmail = async (req, res) => {
  try {
    const { adminId, verificationCode } = req.body;
    const result = await authService.verifyAdminStatus(adminId, verificationCode);

    res.json({
      message: 'Admin login successful',
      token: result.token,
      admin: {
        _id: result.admin.id,
        name: result.admin.name,
        email: result.admin.email,
        role: result.admin.role
      }
    });
  } catch (err) {
    const status = err.message === 'Admin not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await authService.handleUserLogout(decoded.id);

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
