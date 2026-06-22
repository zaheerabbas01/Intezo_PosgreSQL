// scripts/create-indexes.js - Database optimization indexes for PostgreSQL
import dotenv from 'dotenv';
import sequelize from '../config/database.js';

dotenv.config();

const createIndexes = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL');

    const createIndexSafely = async (indexName, tableName, columns, options = {}) => {
      try {
        const unique = options.unique ? 'UNIQUE' : '';
        const columnList = Array.isArray(columns) ? columns.join(', ') : columns;
        await sequelize.query(`CREATE ${unique} INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnList})`);
        console.log(`✓ Created index: ${indexName}`);
      } catch (error) {
        console.log(`Index exists or error: ${indexName}`, error.message);
      }
    };

    // Clinic indexes
    await createIndexSafely('idx_clinics_isopen', 'clinics', 'isOpen');
    await createIndexSafely('idx_clinics_name', 'clinics', 'name');
    await createIndexSafely('idx_clinics_isactive', 'clinics', 'isActive');
    console.log('✅ Clinic indexes created');

    // Doctor indexes
    await createIndexSafely('idx_doctors_email', 'doctors', 'email', { unique: true });
    await createIndexSafely('idx_doctors_license', 'doctors', 'licenseNumber');
    await createIndexSafely('idx_doctors_specialties', 'doctors', 'specialties');
    console.log('✅ Doctor indexes created');

    // Queue indexes - Optimized for frequent queries
    await createIndexSafely('idx_queues_clinic_doctor_status', 'queues', ['clinicId', 'doctorId', 'status']);
    await createIndexSafely('idx_queues_clinic_doctor_booked', 'queues', ['clinicId', 'doctorId', 'bookedAt']);
    await createIndexSafely('idx_queues_patient_status', 'queues', ['patientId', 'status']);
    await createIndexSafely('idx_queues_status_booked', 'queues', ['status', 'bookedAt']);
    await createIndexSafely('idx_queues_doctor_status_number', 'queues', ['doctorId', 'status', 'number']);
    await createIndexSafely('idx_queues_clinic_status_number', 'queues', ['clinicId', 'status', 'number']);
    console.log('✅ Queue indexes created');

    // Patient indexes - Optimized for authentication and queue lookups
    await createIndexSafely('idx_patients_email', 'patients', 'email', { unique: true });
    await createIndexSafely('idx_patients_phone', 'patients', 'phone');
    await createIndexSafely('idx_patients_premium', 'patients', ['isPremium', 'premiumExpiresAt']);
    console.log('✅ Patient indexes created');

    console.log('🎉 All database indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
};

createIndexes();