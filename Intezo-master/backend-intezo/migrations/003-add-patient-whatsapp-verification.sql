ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_verification_phone VARCHAR(32),
ADD COLUMN IF NOT EXISTS whatsapp_verification_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS whatsapp_verification_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_verification_requested_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS patients_whatsapp_verification_token_unique_idx
ON public.patients (whatsapp_verification_token_hash)
WHERE whatsapp_verification_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS patients_whatsapp_pending_phone_unique_idx
ON public.patients (whatsapp_verification_phone)
WHERE whatsapp_verification_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS patients_whatsapp_verification_expiry_idx
ON public.patients (whatsapp_verification_expires_at)
WHERE whatsapp_verification_expires_at IS NOT NULL;
