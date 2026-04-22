import PremiumPayment from '../models/PremiumPayment.js';
import Patient from '../models/Patient.js';

// Submit premium payment request
export const submitPremiumPayment = async (req, res) => {
  try {
    const { paymentMethod, paymentImage } = req.body;
    const patientId = req.patient._id;

    // Check if patient already has pending payment
    const existingPayment = await PremiumPayment.findOne({
      where: {
        patientId: patientId,
        status: 'pending'
      }
    });

    if (existingPayment) {
      return res.status(400).json({ error: 'You already have a pending payment request' });
    }

    // Check if patient is already premium
    const patient = await Patient.findByPk(patientId);
    if (patient.isPremium && patient.premiumExpiresAt > new Date()) {
      return res.status(400).json({ error: 'You already have an active premium subscription' });
    }

    // Create payment request
    const payment = await PremiumPayment.create({
      patientId: patientId,
      paymentMethod,
      paymentImage,
      amount: 100
    });

    res.status(201).json({
      message: 'Payment request submitted successfully. Please wait for admin approval.',
      paymentId: payment.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get premium payment status
export const getPremiumStatus = async (req, res) => {
  try {
    const patientId = req.patient._id;
    
    const patient = await Patient.findByPk(patientId);
    const pendingPayment = await PremiumPayment.findOne({
      where: {
        patientId: patientId,
        status: 'pending'
      }
    });

    res.json({
      isPremium: patient.isPremium,
      premiumExpiresAt: patient.premiumExpiresAt,
      hasPendingPayment: !!pendingPayment,
      pendingPaymentId: pendingPayment?.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
