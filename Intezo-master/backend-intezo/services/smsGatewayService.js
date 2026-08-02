import crypto from 'node:crypto';
import { Op, QueryTypes } from 'sequelize';

import sequelize from '../config/database.js';
import Patient from '../models/Patient.js';
import PatientAuthChallenge from '../models/PatientAuthChallenge.js';
import { normalizePakistaniPhone, PhoneVerificationError } from './whatsappVerificationService.js';

const TOKEN_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const CLAIM_LEASE_MS = 2 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const hashValue = (value) =>
  crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const gatewayKey = () => {
  const key = String(process.env.SMS_GATEWAY_KEY || '');
  if (key.length < 32) {
    throw new PhoneVerificationError('SMS gateway is not configured.', 503);
  }
  return key;
};

const encryptionKey = () => crypto.createHash('sha256').update(gatewayKey()).digest();

const encryptCode = (code) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
};

const decryptCode = (payload) => {
  const parts = String(payload || '').split('.');
  if (parts.length !== 3) throw new PhoneVerificationError('SMS gateway job is invalid.', 500);
  const [iv, authTag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

const validateName = (value) => {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) {
    throw new PhoneVerificationError('Enter your full name using between 2 and 120 characters.');
  }
  return name;
};

const findPatientByPhone = async (nationalNumber, transaction) => {
  const matches = await sequelize.query(
    `SELECT id FROM public.patients
     WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = :nationalNumber
     LIMIT 1`,
    { replacements: { nationalNumber }, type: QueryTypes.SELECT, transaction }
  );
  return matches[0] ? Patient.findByPk(matches[0].id, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  }) : null;
};

const findOtherPatientByPhone = async (nationalNumber, patientId, transaction) => {
  const matches = await sequelize.query(
    `SELECT id FROM public.patients
     WHERE id <> :patientId
       AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = :nationalNumber
     LIMIT 1`,
    { replacements: { nationalNumber, patientId }, type: QueryTypes.SELECT, transaction }
  );
  return matches[0] || null;
};

const createCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

export const startSmsChallenge = async ({ purpose, patientId = null, name, phone }) => {
  if (!['login', 'register', 'phone'].includes(purpose)) {
    throw new PhoneVerificationError('Invalid verification request.');
  }

  const normalized = normalizePakistaniPhone(phone);
  const patient = await findPatientByPhone(normalized.nationalNumber);

  if (purpose === 'login' && !patient) {
    throw new PhoneVerificationError('No patient account was found for this phone number.', 404);
  }
  if (purpose === 'register' && patient) {
    throw new PhoneVerificationError('This phone number is already registered. Please sign in instead.', 409);
  }
  if (purpose === 'phone' && !patientId) {
    throw new PhoneVerificationError('Patient account is required.', 401);
  }
  if (purpose === 'phone' && patientId) {
    const existing = await findOtherPatientByPhone(normalized.nationalNumber, patientId);
    if (existing) throw new PhoneVerificationError('This phone number is already connected to another account.', 409);
  }

  const previous = await PatientAuthChallenge.findOne({
    where: { phone: normalized.e164, purpose, verifiedAt: null, consumedAt: null },
    order: [['createdAt', 'DESC']]
  });
  if (previous?.createdAt && Date.now() - new Date(previous.createdAt).getTime() < REQUEST_COOLDOWN_MS) {
    throw new PhoneVerificationError('Please wait 30 seconds before requesting another code.', 429);
  }

  await PatientAuthChallenge.destroy({
    where: {
      [Op.or]: [
        { expiresAt: { [Op.lt]: new Date() } },
        { phone: normalized.e164, purpose, verifiedAt: null, consumedAt: null }
      ]
    }
  });

  const code = createCode();
  const pollToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const challenge = await PatientAuthChallenge.create({
    patientId: purpose === 'phone' ? patientId : patient?.id || null,
    purpose,
    name: purpose === 'register' ? validateName(name) : null,
    phone: normalized.e164,
    // Keep the legacy column populated for old database constraints and old rows.
    messageTokenHash: hashValue(`sms:${crypto.randomBytes(32).toString('base64url')}`),
    smsCodeHash: hashValue(code),
    smsCodeCiphertext: encryptCode(code),
    pollTokenHash: hashValue(pollToken),
    expiresAt,
    gatewayStatus: 'pending',
    gatewayAttempts: 0,
    verificationAttempts: 0
  });

  return {
    requestId: challenge.id,
    pollToken,
    phone: normalized.e164,
    expiresAt: expiresAt.toISOString(),
    pollAfterSeconds: 5,
    requiresVerification: true
  };
};

export const getPatientAuthChallengeStatus = async ({ requestId, pollToken }) => {
  const challenge = await PatientAuthChallenge.findByPk(requestId);
  if (!challenge || !safeEqual(challenge.pollTokenHash, hashValue(pollToken))) {
    throw new PhoneVerificationError('Invalid verification request.', 401);
  }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    throw new PhoneVerificationError('This verification request expired. Please start again.', 410);
  }
  if (!challenge.verifiedAt || !challenge.patientId) {
    return { verified: false, expiresAt: challenge.expiresAt.toISOString() };
  }
  const patient = await Patient.findByPk(challenge.patientId);
  if (!patient) throw new PhoneVerificationError('Patient account not found.', 404);
  return { verified: true, completedNow: !challenge.consumedAt, patient };
};

const completeChallenge = async (challenge, transaction) => {
  let patient = challenge.patientId
    ? await Patient.findByPk(challenge.patientId, { transaction, lock: transaction.LOCK.UPDATE })
    : await findPatientByPhone(normalizePakistaniPhone(challenge.phone).nationalNumber, transaction);

  if (challenge.purpose === 'login' && !patient) {
    throw new PhoneVerificationError('Patient account not found.', 404);
  }
  if (challenge.purpose === 'register' && patient) {
    throw new PhoneVerificationError('This phone number is already registered. Please sign in instead.', 409);
  }

  if (!patient) {
    patient = await Patient.create({
      name: challenge.name,
      email: null,
      phone: challenge.phone,
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      emailVerified: false
    }, { transaction });
  } else {
    if (challenge.purpose === 'phone') {
      const duplicate = await findOtherPatientByPhone(
        normalizePakistaniPhone(challenge.phone).nationalNumber,
        patient.id,
        transaction
      );
      if (duplicate) throw new PhoneVerificationError('This phone number is already connected to another account.', 409);
    }
    await patient.update({
      phone: challenge.phone,
      phoneVerified: true,
      phoneVerifiedAt: new Date()
    }, { transaction });
  }

  await challenge.update({
    patientId: patient.id,
    verifiedAt: new Date(),
    consumedAt: new Date(),
    gatewayStatus: 'verified',
    smsCodeHash: null,
    smsCodeCiphertext: null
  }, { transaction });

  return patient;
};

export const verifySmsCode = async ({ requestId, pollToken, code }) => {
  const normalizedCode = String(code || '').trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new PhoneVerificationError('Enter the 6-digit SMS verification code.');
  }

  return sequelize.transaction(async (transaction) => {
    const challenge = await PatientAuthChallenge.findByPk(requestId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!challenge || !safeEqual(challenge.pollTokenHash, hashValue(pollToken))) {
      throw new PhoneVerificationError('Invalid verification request.', 401);
    }
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      throw new PhoneVerificationError('This verification request expired. Please start again.', 410);
    }
    if (challenge.verifiedAt) {
      const patient = await Patient.findByPk(challenge.patientId, { transaction });
      return { verified: true, completedNow: false, patient };
    }
    if ((challenge.verificationAttempts || 0) >= MAX_CODE_ATTEMPTS) {
      throw new PhoneVerificationError('Too many incorrect codes. Please request a new code.', 429);
    }
    if (!safeEqual(challenge.smsCodeHash, hashValue(normalizedCode))) {
      await challenge.increment('verificationAttempts', { by: 1, transaction });
      throw new PhoneVerificationError('Incorrect verification code.');
    }
    const patient = await completeChallenge(challenge, transaction);
    return { verified: true, completedNow: true, patient };
  });
};

export const claimNextSmsJob = async () => {
  gatewayKey();
  return sequelize.transaction(async (transaction) => {
    const now = new Date();
    const challenge = await PatientAuthChallenge.findOne({
      where: {
        smsCodeCiphertext: { [Op.ne]: null },
        expiresAt: { [Op.gt]: now },
        [Op.or]: [
          { gatewayStatus: 'pending' },
          { gatewayStatus: 'claimed', gatewayClaimedAt: { [Op.lt]: new Date(Date.now() - CLAIM_LEASE_MS) } }
        ]
      },
      order: [['createdAt', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    });
    if (!challenge) return null;
    await challenge.update({
      gatewayStatus: 'claimed',
      gatewayClaimedAt: now,
      gatewayAttempts: (challenge.gatewayAttempts || 0) + 1,
      gatewayLastError: null
    }, { transaction });
    return {
      jobId: challenge.id,
      phone: challenge.phone,
      code: decryptCode(challenge.smsCodeCiphertext),
      expiresAt: challenge.expiresAt.toISOString()
    };
  });
};

export const completeSmsJob = async ({ jobId, success, error }) => {
  gatewayKey();
  const challenge = await PatientAuthChallenge.findByPk(jobId);
  if (!challenge) throw new PhoneVerificationError('SMS job not found.', 404);
  if (challenge.gatewayStatus !== 'claimed') throw new PhoneVerificationError('SMS job is not currently claimed.', 409);

  if (success) {
    await challenge.update({ gatewayStatus: 'sent', gatewaySentAt: new Date(), gatewayLastError: null });
  } else {
    const retry = (challenge.gatewayAttempts || 0) < 3 && new Date(challenge.expiresAt).getTime() > Date.now();
    await challenge.update({
      gatewayStatus: retry ? 'pending' : 'failed',
      gatewayLastError: String(error || 'The gateway could not send the SMS.').slice(0, 500)
    });
  }
  return { success: true };
};

export const verifyGatewayKey = (providedKey) => {
  const configured = String(process.env.SMS_GATEWAY_KEY || '');
  return configured.length >= 32 && safeEqual(providedKey, configured);
};

export { PhoneVerificationError };
