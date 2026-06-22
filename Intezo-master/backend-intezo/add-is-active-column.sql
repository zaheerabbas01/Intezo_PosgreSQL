-- Add is_active column to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing records to be active
UPDATE clinics SET is_active = true WHERE is_active IS NULL;
