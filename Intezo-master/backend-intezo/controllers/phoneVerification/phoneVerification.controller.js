import {
  PhoneVerificationError,
  getPhoneVerificationStatus,
  startPhoneVerification
} from '../../services/whatsappVerificationService.js';

const sendError = (res, error) => {
  const status = error instanceof PhoneVerificationError ? error.status : 500;
  const message = status === 500
    ? 'Unable to process phone verification.'
    : error.message;
  res.status(status).json({ error: message });
};

export const start = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const result = await startPhoneVerification(req.patient.id, phone);
    res.set('Cache-Control', 'no-store');
    return res.status(result.phoneVerified ? 200 : 201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

export const status = async (req, res) => {
  try {
    const result = await getPhoneVerificationStatus(req.patient.id);
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
};
