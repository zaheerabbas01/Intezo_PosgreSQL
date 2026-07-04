ALTER TABLE public.patients
ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.patient_auth_challenges (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  purpose VARCHAR(16) NOT NULL CHECK (purpose IN ('login', 'register')),
  name VARCHAR(120),
  phone VARCHAR(32) NOT NULL,
  message_token_hash VARCHAR(64) NOT NULL UNIQUE,
  poll_token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patient_auth_challenges_phone_idx
ON public.patient_auth_challenges (phone);

CREATE INDEX IF NOT EXISTS patient_auth_challenges_expiry_idx
ON public.patient_auth_challenges (expires_at);

CREATE INDEX IF NOT EXISTS patient_auth_challenges_patient_idx
ON public.patient_auth_challenges (patient_id)
WHERE patient_id IS NOT NULL;
