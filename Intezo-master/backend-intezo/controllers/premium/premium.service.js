import { PremiumPayment, Patient } from '../../models/index.js';
import { Op } from 'sequelize';

/**
 * Validates eligibility and creates a new payment record.
 */
export const requestPremiumUpgrade = async (patientId, paymentData) => {
  const [patient, existingPending] = await Promise.all([
    Patient.findByPk(patientId),
    PremiumPayment.findOne({
      where: { patientId, status: 'pending' }
    })
  ]);

  if (!patient) throw new Error('Patient not found');
  
  // Rule 1: No double-dipping on pending requests
  if (existingPending) {
    throw new Error('You already have a pending payment request');
  }

  // Rule 2: Check if already premium
  if (patient.isPremium && patient.premiumExpiresAt > new Date()) {
    throw new Error('You already have an active premium subscription');
  }

  return await PremiumPayment.create({
    patientId,
    paymentMethod: paymentData.paymentMethod,
    paymentImage: paymentData.paymentImage,
    amount: 100 // Hardcoded or pulled from config
  });
};

/**
 * Aggregates patient subscription and payment status.
 */
export const getSubscriptionStatus = async (patientId) => {
  const [patient, pendingPayment] = await Promise.all([
    Patient.findByPk(patientId, {
      attributes: ['isPremium', 'premiumExpiresAt']
    }),
    PremiumPayment.findOne({
      where: { patientId, status: 'pending' },
      attributes: ['id']
    })
  ]);

  return {
    isPremium: patient?.isPremium || false,
    premiumExpiresAt: patient?.premiumExpiresAt || null,
    hasPendingPayment: !!pendingPayment,
    pendingPaymentId: pendingPayment?.id || null
  };
};