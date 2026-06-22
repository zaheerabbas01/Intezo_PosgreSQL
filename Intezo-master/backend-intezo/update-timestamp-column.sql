-- Update verification_code_expires column to BIGINT for all tables
ALTER TABLE clinics ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
ALTER TABLE doctors ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
ALTER TABLE patients ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
ALTER TABLE users ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
ALTER TABLE pending_users ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
