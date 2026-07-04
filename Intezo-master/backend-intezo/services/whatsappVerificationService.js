import crypto from 'node:crypto';
import { QueryTypes, UniqueConstraintError } from 'sequelize';

import sequelize from '../config/database.js';
import Patient from '../models/Patient.js';

const TOKEN_PREFIX = 'INZ-';
const TOKEN_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const VERIFICATION_MESSAGE_PATTERN = /verify\s+my\s+intezo\s+account:\s*(INZ-[A-Za-z0-9_-]{20,80})/i;

export class PhoneVerificationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PhoneVerificationError';
    this.status = status;
  }
}

export const normalizePakistaniPhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(2);

  let nationalNumber;
  if (digits.startsWith('92') && digits.length === 12) {
    nationalNumber = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    nationalNumber = digits.slice(1);
  } else if (digits.length === 10) {
    nationalNumber = digits;
  }

  if (!nationalNumber || !/^3\d{9}$/.test(nationalNumber)) {
    throw new PhoneVerificationError(
      'Enter a valid Pakistani mobile number, such as 03XXXXXXXXX or +923XXXXXXXXX.'
    );
  }

  return {
    e164: `+92${nationalNumber}`,
    digits: `92${nationalNumber}`,
    nationalNumber
  };
};

const getBusinessPhoneDigits = () => {
  if (!process.env.WHATSAPP_VERIFY_TOKEN || !process.env.WHATSAPP_APP_SECRET) {
    throw new PhoneVerificationError(
      'WhatsApp verification is temporarily unavailable.',
      503
    );
  }

  const digits = String(process.env.WHATSAPP_BUSINESS_PHONE || '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new PhoneVerificationError(
      'WhatsApp verification is temporarily unavailable.',
      503
    );
  }
  return digits;
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const findPatientUsingPhone = async (nationalNumber, patientId, transaction) => {
  const matches = await sequelize.query(
    `
      SELECT id
      FROM public.patients
      WHERE id <> :patientId
        AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = :nationalNumber
      LIMIT 1
    `,
    {
      replacements: { patientId, nationalNumber },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  return matches[0] || null;
};

const clearExpiredVerification = async (patient) => {
  const expiresAt = patient.whatsappVerificationExpiresAt;
  if (!expiresAt || new Date(expiresAt).getTime() > Date.now()) return false;

  await patient.update({
    whatsappVerificationPhone: null,
    whatsappVerificationTokenHash: null,
    whatsappVerificationExpiresAt: null
  });
  return true;
};

export const startPhoneVerification = async (patientId, phone) => {
  const businessPhone = getBusinessPhoneDigits();
  const normalizedPhone = normalizePakistaniPhone(phone);
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new PhoneVerificationError('Patient not found.', 404);

  if (patient.phoneVerified) {
    try {
      const currentPhone = normalizePakistaniPhone(patient.phone);
      if (currentPhone.e164 === normalizedPhone.e164) {
        return {
          phoneVerified: true,
          phone: currentPhone.e164,
          whatsappUrl: null,
          expiresAt: null
        };
      }
    } catch {
      // A legacy non-Pakistani number can be replaced by a verified number.
    }
  }

  const existingPatient = await findPatientUsingPhone(
    normalizedPhone.nationalNumber,
    patient.id
  );
  if (existingPatient) {
    throw new PhoneVerificationError(
      'This WhatsApp number is already connected to another Intezo account.',
      409
    );
  }

  const lastRequestedAt = patient.whatsappVerificationRequestedAt
    ? new Date(patient.whatsappVerificationRequestedAt).getTime()
    : 0;
  if (Date.now() - lastRequestedAt < REQUEST_COOLDOWN_MS) {
    throw new PhoneVerificationError(
      'Please wait 30 seconds before requesting another verification.',
      429
    );
  }

  const token = `${TOKEN_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const message = `Verify my Intezo account: ${token}`;

  try {
    await patient.update({
      whatsappVerificationPhone: normalizedPhone.e164,
      whatsappVerificationTokenHash: hashToken(token),
      whatsappVerificationExpiresAt: expiresAt,
      whatsappVerificationRequestedAt: new Date()
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new PhoneVerificationError(
        'This WhatsApp number is already being verified by another Intezo account.',
        409
      );
    }
    throw error;
  }

  return {
    phoneVerified: false,
    phone: normalizedPhone.e164,
    whatsappUrl: `https://wa.me/${businessPhone}?text=${encodeURIComponent(message)}`,
    expiresAt: expiresAt.toISOString(),
    pollAfterSeconds: 3
  };
};

export const getPhoneVerificationStatus = async (patientId) => {
  const patient = await Patient.findByPk(patientId, {
    attributes: [
      'id',
      'phone',
      'phoneVerified',
      'phoneVerifiedAt',
      'whatsappVerificationPhone',
      'whatsappVerificationTokenHash',
      'whatsappVerificationExpiresAt'
    ]
  });
  if (!patient) throw new PhoneVerificationError('Patient not found.', 404);

  const expired = await clearExpiredVerification(patient);
  const verificationPending = !expired &&
    Boolean(patient.whatsappVerificationTokenHash) &&
    Boolean(patient.whatsappVerificationExpiresAt);

  return {
    phoneVerified: patient.phoneVerified,
    phone: patient.phone,
    phoneVerifiedAt: patient.phoneVerifiedAt,
    verificationPending,
    pendingPhone: verificationPending ? patient.whatsappVerificationPhone : null,
    expiresAt: verificationPending
      ? patient.whatsappVerificationExpiresAt.toISOString()
      : null
  };
};

const extractVerificationToken = (message) => {
  const match = String(message || '').match(VERIFICATION_MESSAGE_PATTERN);
  return match?.[1] || null;
};

export const verifyIncomingWhatsAppMessage = async ({ from, message }) => {
  const token = extractVerificationToken(message);
  if (!token) return { matched: false, verified: false };

  let sender;
  try {
    sender = normalizePakistaniPhone(from);
  } catch {
    return { matched: true, verified: false };
  }

  return sequelize.transaction(async (transaction) => {
    const patient = await Patient.findOne({
      where: { whatsappVerificationTokenHash: hashToken(token) },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!patient) return { matched: true, verified: false };

    const expiresAt = patient.whatsappVerificationExpiresAt
      ? new Date(patient.whatsappVerificationExpiresAt).getTime()
      : 0;
    if (!expiresAt || expiresAt <= Date.now()) {
      await patient.update({
        whatsappVerificationPhone: null,
        whatsappVerificationTokenHash: null,
        whatsappVerificationExpiresAt: null
      }, { transaction });
      return { matched: true, verified: false };
    }

    if (patient.whatsappVerificationPhone !== sender.e164) {
      return { matched: true, verified: false };
    }

    const existingPatient = await findPatientUsingPhone(
      sender.nationalNumber,
      patient.id,
      transaction
    );
    if (existingPatient) {
      await patient.update({
        whatsappVerificationPhone: null,
        whatsappVerificationTokenHash: null,
        whatsappVerificationExpiresAt: null
      }, { transaction });
      return { matched: true, verified: false };
    }

    await patient.update({
      phone: sender.e164,
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      whatsappVerificationPhone: null,
      whatsappVerificationTokenHash: null,
      whatsappVerificationExpiresAt: null
    }, { transaction });

    return { matched: true, verified: true, patientId: patient.id };
  });
};

const secureStringEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyWebhookChallengeToken = (providedToken) => {
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  return Boolean(expectedToken) && secureStringEqual(providedToken, expectedToken);
};

export const verifyWebhookSignature = (rawBody, signature) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !Buffer.isBuffer(rawBody) || !signature) return false;

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  return secureStringEqual(signature, expectedSignature);
};
