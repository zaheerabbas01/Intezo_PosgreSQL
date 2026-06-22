import * as premiumService from './premium.service.js';

export const submitPremiumPayment = async (req, res) => {
  try {
    const payment = await premiumService.requestPremiumUpgrade(
      req.patient.id, 
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Payment request submitted. Awaiting admin approval.',
      paymentId: payment.id
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getPremiumStatus = async (req, res) => {
  try {
    const status = await premiumService.getSubscriptionStatus(req.patient.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};