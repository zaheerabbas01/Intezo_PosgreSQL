ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

ALTER TABLE public.clinics
DROP CONSTRAINT IF EXISTS clinics_latitude_range,
ADD CONSTRAINT clinics_latitude_range
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);

ALTER TABLE public.clinics
DROP CONSTRAINT IF EXISTS clinics_longitude_range,
ADD CONSTRAINT clinics_longitude_range
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

CREATE INDEX IF NOT EXISTS clinics_location_available_idx
ON public.clinics (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
