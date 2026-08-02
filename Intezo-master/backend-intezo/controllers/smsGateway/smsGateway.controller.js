import {
  claimSmsJob,
  completeSmsJob,
  registerSmsGatewayDevice,
  verifyGatewayKey,
  PhoneVerificationError
} from '../../services/smsGatewayService.js';

const authenticateGateway = (req, res) => {
  if (verifyGatewayKey(req.get('x-sms-gateway-key'))) return true;
  res.status(401).json({ error: 'Invalid SMS gateway credentials.' });
  return false;
};

const sendError = (res, error) => {
  const status = error instanceof PhoneVerificationError ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'Unable to process SMS gateway request.' : error.message });
};

export const claimJob = async (req, res) => {
  if (!authenticateGateway(req, res)) return;
  try {
    const job = await claimSmsJob(req.params.jobId);
    res.set('Cache-Control', 'no-store');
    return res.json({ job });
  } catch (error) {
    return sendError(res, error);
  }
};

export const register = async (req, res) => {
  if (!authenticateGateway(req, res)) return;
  try {
    const { deviceId, fcmToken, enabled } = req.body || {};
    return res.json(await registerSmsGatewayDevice({ deviceId, fcmToken, enabled }));
  } catch (error) {
    return sendError(res, error);
  }
};

export const result = async (req, res) => {
  if (!authenticateGateway(req, res)) return;
  try {
    const { jobId } = req.params;
    const { success, error } = req.body || {};
    if (!jobId || typeof success !== 'boolean') {
      return res.status(400).json({ error: 'jobId and a boolean success value are required.' });
    }
    return res.json(await completeSmsJob({ jobId, success, error }));
  } catch (error) {
    return sendError(res, error);
  }
};
