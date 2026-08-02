import {
  PhoneVerificationError,
  getPatientAuthChallengeStatus,
  startSmsChallenge,
  verifySmsCode
} from '../../services/smsGatewayService.js';

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

    const result = await startSmsChallenge({
      purpose: 'phone',
      patientId: req.patient.id,
      phone
    });
    res.set('Cache-Control', 'no-store');
    return res.status(result.phoneVerified ? 200 : 201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

export const status = async (req, res) => {
  try {
    if (!req.query.requestId || !req.query.pollToken) {
      res.set('Cache-Control', 'no-store');
      return res.json({
        phoneVerified: req.patient.phoneVerified,
        phone: req.patient.phone,
        phoneVerifiedAt: req.patient.phoneVerifiedAt,
        verificationPending: false,
        pendingPhone: null,
        expiresAt: null
      });
    }
    const result = await getPatientAuthChallengeStatus({
      requestId: req.query.requestId,
      pollToken: req.query.pollToken
    });
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

export const verify = async (req, res) => {
  try {
    const { requestId, pollToken, verificationCode } = req.body || {};
    if (!requestId || !pollToken || !verificationCode) {
      return res.status(400).json({
        error: 'Verification request ID, polling token, and SMS code are required.'
      });
    }
    const result = await verifySmsCode({
      requestId,
      pollToken,
      code: verificationCode
    });
    if (!result.patient || result.patient.id !== req.patient.id) {
      return res.status(403).json({ error: 'Invalid phone verification request.' });
    }
    res.set('Cache-Control', 'no-store');
    return res.json({
      phoneVerified: true,
      phone: result.patient.phone,
      phoneVerifiedAt: result.patient.phoneVerifiedAt
    });
  } catch (error) {
    return sendError(res, error);
  }
};
