-- PostgreSQL Schema for Intezo Queue Management System

-- Create database
CREATE DATABASE intezo_queue;

-- Connect to database
\c intezo_queue;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) DEFAULT 'patient' CHECK (role IN ('patient', 'staff', 'admin')),
  verification_code VARCHAR(255),
  verification_code_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clinics table
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  location_updated_at TIMESTAMPTZ,
  profile_photo VARCHAR(500),
  services TEXT[],
  operating_hours JSONB DEFAULT '{"opening": "09:00", "closing": "17:00"}',
  average_process_time INTEGER DEFAULT 15,
  max_active_queues INTEGER DEFAULT 50,
  role VARCHAR(50) DEFAULT 'clinic',
  is_open BOOLEAN DEFAULT false,
  manually_closed BOOLEAN NOT NULL DEFAULT false,
  last_status_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(255),
  verification_code_expires TIMESTAMP,
  custom_report_templates JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctors table
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  profile_photo VARCHAR(500),
  specialties TEXT[] NOT NULL,
  qualifications JSONB,
  license_number VARCHAR(100) NOT NULL UNIQUE,
  clinics JSONB,
  role VARCHAR(50) DEFAULT 'doctor',
  last_status_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(255),
  verification_code_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50) NOT NULL UNIQUE,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  whatsapp_verification_phone VARCHAR(32),
  whatsapp_verification_token_hash VARCHAR(64),
  whatsapp_verification_expires_at TIMESTAMPTZ,
  whatsapp_verification_requested_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(255),
  verification_code_expires TIMESTAMP,
  fcm_token VARCHAR(500),
  current_queue UUID,
  active_queues UUID[],
  queue_history UUID[],
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMP,
  clinic_notifications UUID[],
  doctor_notifications UUID[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX patients_whatsapp_verification_token_unique_idx
ON patients (whatsapp_verification_token_hash)
WHERE whatsapp_verification_token_hash IS NOT NULL;

CREATE UNIQUE INDEX patients_whatsapp_pending_phone_unique_idx
ON patients (whatsapp_verification_phone)
WHERE whatsapp_verification_phone IS NOT NULL;

CREATE TABLE patient_auth_challenges (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
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

-- Queues table
CREATE TABLE queues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(255),
  manual_entry JSONB,
  number INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'served', 'cancelled', 'missed', 'skipped')),
  booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  served_at TIMESTAMP,
  missed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  skipped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  report_type VARCHAR(50) DEFAULT 'medical' CHECK (report_type IN ('medical', 'lab_test')),
  title VARCHAR(255) NOT NULL,
  diagnosis TEXT NOT NULL,
  symptoms TEXT,
  treatment TEXT,
  medications JSONB,
  notes TEXT,
  recommendations TEXT,
  lab_tests JSONB,
  follow_up_date TIMESTAMP,
  pdf_url VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending Users table
CREATE TABLE pending_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_data JSONB NOT NULL,
  user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('doctor', 'clinic', 'patient')),
  verification_code VARCHAR(255),
  verification_code_expires TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'pending_approval', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Premium Payments table
CREATE TABLE premium_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('easypesa', 'jazzcash', 'nayapay', 'sadapay')),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 100,
  payment_image TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_clinics_email ON clinics(email);
CREATE INDEX idx_doctors_email ON doctors(email);
CREATE INDEX idx_doctors_license ON doctors(license_number);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_phone ON patients(phone);

CREATE INDEX idx_queues_clinic_doctor_status_number ON queues(clinic_id, doctor_id, status, number);
CREATE INDEX idx_queues_clinic_doctor_booked ON queues(clinic_id, doctor_id, booked_at);
CREATE INDEX idx_queues_patient_status ON queues(patient_id, status);
CREATE INDEX idx_queues_status_booked ON queues(status, booked_at);
CREATE INDEX idx_queues_doctor_status_number ON queues(doctor_id, status, number);

CREATE INDEX idx_reports_patient_created ON reports(patient_id, created_at);
CREATE INDEX idx_reports_clinic_created ON reports(clinic_id, created_at);
CREATE INDEX idx_reports_doctor_created ON reports(doctor_id, created_at);

-- Add foreign key for patient current_queue
ALTER TABLE patients ADD CONSTRAINT fk_patients_current_queue 
  FOREIGN KEY (current_queue) REFERENCES queues(id) ON DELETE SET NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON queues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pending_users_updated_at BEFORE UPDATE ON pending_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_premium_payments_updated_at BEFORE UPDATE ON premium_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
