import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Clinic from '../models/Clinic.js';
import Queue from '../models/Queue.js';
import PendingUser from '../models/PendingUser.js';
import PremiumPayment from '../models/PremiumPayment.js';
import emailService from '../services/emailService.js';
import { broadcastNotification, publishAdminUpdate, logActivity } from '../services/realtime.js';
import redisClient from '../config/redis.js';

// Get dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalPatients, totalDoctors, totalClinics, totalQueues, activeQueues, pendingApprovals] = await Promise.all([
      Patient.count(),
      Doctor.count(),
      Clinic.count(),
      Queue.count(),
      Queue.count({ where: { status: ['waiting', 'in_progress'] } }),
      PendingUser.count({ where: { status: 'pending_approval' } })
    ]);

    const stats = {
      totalPatients,
      totalDoctors,
      totalClinics,
      totalQueues,
      activeQueues,
      pendingApprovals,
      lastUpdated: new Date()
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all patients with pagination
export const getAllPatients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const patients = await Patient.findAll({
      offset: skip,
      limit: limit,
      order: [['createdAt', 'DESC']]
    });

    const total = await Patient.count();

    res.json({
      patients,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all doctors with pagination
export const getAllDoctors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const doctors = await Doctor.findAll({
      offset: skip,
      limit: limit,
      order: [['createdAt', 'DESC']]
    });

    const total = await Doctor.count();

    res.json({
      doctors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all clinics with pagination
export const getAllClinics = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const clinics = await Clinic.findAll({
      offset: skip,
      limit: limit,
      order: [['createdAt', 'DESC']]
    });

    // Get doctors for each clinic
    const clinicsWithDoctors = await Promise.all(
      clinics.map(async (clinic) => {
        const doctors = await Doctor.findAll({
          where: { 'clinics.clinic': clinic.id },
          attributes: ['name', 'email', 'specialties']
        });
        return {
          ...clinic.toJSON(),
          doctors
        };
      })
    );

    const total = await Clinic.count();

    res.json({
      clinics: clinicsWithDoctors,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete patient
export const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    await patient.destroy();
    
    await logActivity('patient_deleted', `Patient ${patient.name} deleted`, req.user?.id);
    await publishAdminUpdate('patient_deleted', { patientId: req.params.id, patientName: patient.name });
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete doctor
export const deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    await doctor.destroy();
    
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update patient
export const updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    await patient.update(req.body);
    res.json({ message: 'Patient updated successfully', patient });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update doctor
export const updateDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    await doctor.update(req.body);
    res.json({ message: 'Doctor updated successfully', doctor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update clinic
export const updateClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.params.id);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    await clinic.update(req.body);
    res.json({ message: 'Clinic updated successfully', clinic });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove doctor from clinic
export const removeDoctorFromClinic = async (req, res) => {
  try {
    const { doctorId, clinicId } = req.params;
    
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    
    doctor.clinics = doctor.clinics.filter(c => c.clinic.toString() !== clinicId);
    await doctor.save();
    
    res.json({ message: 'Doctor removed from clinic successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending approvals
export const getPendingApprovals = async (req, res) => {
  try {
    const pendingUsers = await PendingUser.findAll({ 
      where: { status: 'pending_approval' },
      order: [['createdAt', 'DESC']]
    });
    res.json({ pendingUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approve registration
export const approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const pendingUser = await PendingUser.findByPk(id);
    
    if (!pendingUser) {
      return res.status(404).json({ error: 'Pending user not found' });
    }

    if (pendingUser.userType === 'clinic') {
      const clinic = new Clinic({
        ...pendingUser.userData,
        emailVerified: true
      });
      await clinic.save();
    } else if (pendingUser.userType === 'doctor') {
      const doctor = new Doctor({
        ...pendingUser.userData,
        emailVerified: true
      });
      await doctor.save();
    }

    // Send approval email
    await emailService.sendApprovalEmail(pendingUser.userData.email, pendingUser.userType, true);
    
    await logActivity('registration_approved', `${pendingUser.userType} ${pendingUser.userData.name} approved`, req.user?.id);
    await PendingUser.destroy({ where: { id } });
    await publishAdminUpdate('registration_approved', { 
      userType: pendingUser.userType, 
      email: pendingUser.userData.email,
      name: pendingUser.userData.name 
    });
    
    res.json({ message: `${pendingUser.userType} approved successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reject registration
export const rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const pendingUser = await PendingUser.findByPk(id);
    
    if (!pendingUser) {
      return res.status(404).json({ error: 'Pending user not found' });
    }

    // Send rejection email
    await emailService.sendApprovalEmail(pendingUser.userData.email, pendingUser.userType, false);
    
    await PendingUser.destroy({ where: { id } });
    res.json({ message: `${pendingUser.userType} registration rejected` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete clinic
export const deleteClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findByPk(req.params.id);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    await clinic.destroy();
    
    // Remove clinic from all doctors
    await Doctor.update(
      { clinics: [] },
      { where: { 'clinics.clinic': req.params.id } }
    );
    
    res.json({ message: 'Clinic deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get online users
export const getOnlineUsers = async (req, res) => {
  try {
    const keys = await redisClient.keys('user:*:online');
    const onlineUsers = [];
    
    for (const key of keys) {
      const userData = await redisClient.get(key);
      if (userData) {
        onlineUsers.push(JSON.parse(userData));
      }
    }
    
    res.json({ onlineUsers });
  } catch (error) {
    console.log('Redis error, returning empty list:', error.message);
    res.json({ onlineUsers: [] });
  }
};

// Logout user
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      try {
        await redisClient.del(`user:${userId}:online`);
      } catch (redisError) {
        console.log('Redis not available for logout tracking');
      }
      await logActivity('user_logout', `User logged out`, userId);
      await publishAdminUpdate('user_offline', { userId, status: 'offline' });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending premium payments
export const getPendingPremiumPayments = async (req, res) => {
  try {
    const payments = await PremiumPayment.findAll({ 
      where: { status: 'pending' },
      include: [{ model: Patient, as: 'patient', attributes: ['name', 'email', 'phone'] }],
      order: [['submittedAt', 'DESC']]
    });
    
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approve premium payment
export const approvePremiumPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await PremiumPayment.findByPk(id, {
      include: [{ model: Patient, as: 'patient' }]
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    // Update payment status
    payment.status = 'approved';
    payment.reviewedAt = new Date();
    payment.reviewedBy = req.user.id;
    await payment.save();

    // Update patient premium status (30 days)
    const patient = payment.patient;
    patient.isPremium = true;
    patient.premiumExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await patient.save();

    await logActivity('premium_approved', `Premium payment approved for ${patient.name}`, req.user.id);
    
    // Send approval email
    try {
      const mailOptions = {
        from: `"Queue Management" <${process.env.EMAIL_USER}>`,
        to: patient.email,
        subject: '✅ Premium Subscription Approved',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background: #059669; color: white; padding: 20px; border-radius: 8px;">
              <h1>✅ Premium Subscription Approved</h1>
            </div>
            <div style="padding: 20px; background: #f9f9f9; margin-top: 20px; border-radius: 8px;">
              <p>Dear ${patient.name},</p>
              <p>Your premium subscription payment has been approved! You now have access to premium features for 30 days.</p>
              <h3>Premium Benefits:</h3>
              <ul><li>Book unlimited queues at the same time</li></ul>
              <p>Thank you for choosing our service!</p>
              <p>Best regards,<br>Queue Management Team</p>
            </div>
          </div>
        `
      };
      await emailService.transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
    }
    
    res.json({ message: 'Premium payment approved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reject premium payment
export const rejectPremiumPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const payment = await PremiumPayment.findByPk(id, {
      include: [{ model: Patient, as: 'patient' }]
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    // Update payment status
    payment.status = 'rejected';
    payment.reviewedAt = new Date();
    payment.reviewedBy = req.user.id;
    payment.rejectionReason = reason;
    await payment.save();

    await logActivity('premium_rejected', `Premium payment rejected for ${payment.patient.name}`, req.user.id);
    
    // Send rejection email
    try {
      const mailOptions = {
        from: `"Queue Management" <${process.env.EMAIL_USER}>`,
        to: payment.patient.email,
        subject: '❌ Premium Subscription Payment Rejected',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background: #dc2626; color: white; padding: 20px; border-radius: 8px;">
              <h1>❌ Payment Rejected</h1>
            </div>
            <div style="padding: 20px; background: #f9f9f9; margin-top: 20px; border-radius: 8px;">
              <p>Dear ${payment.patient.name},</p>
              <p>We regret to inform you that your premium subscription payment has been rejected.</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <p>If you believe this is an error, please contact our support team or submit a new payment request with a clear receipt.</p>
              <p>Best regards,<br>Queue Management Team</p>
            </div>
          </div>
        `
      };
      await emailService.transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError);
    }
    
    res.json({ message: 'Premium payment rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};