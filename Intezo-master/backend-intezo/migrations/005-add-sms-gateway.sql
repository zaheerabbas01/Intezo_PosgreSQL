ALTER TABLE public.patient_auth_challenges
  ADD COLUMN IF NOT EXISTS sms_code_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS sms_code_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS gateway_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS gateway_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_last_error TEXT,
  ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.patient_auth_challenges
  DROP CONSTRAINT IF EXISTS patient_auth_challenges_purpose_check;

ALTER TABLE public.patient_auth_challenges
  ADD CONSTRAINT patient_auth_challenges_purpose_check
  CHECK (purpose IN ('login', 'register', 'phone'));

CREATE INDEX IF NOT EXISTS patient_auth_challenges_gateway_idx
ON public.patient_auth_challenges (gateway_status, expires_at);
