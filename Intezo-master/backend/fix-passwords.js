import sequelize from './config/database.js';
import Clinic from './models/Clinic.js';
import Doctor from './models/Doctor.js';

/**
 * This script fixes passwords that were migrated from MongoDB.
 * The passwords in MongoDB were already bcrypt hashed, so we need to
 * update them in PostgreSQL without triggering the beforeSave hook
 * that would hash them again.
 */

async function fixPasswords() {
  try {
    console.log('Starting password fix...');

    // Use raw queries to update passwords without triggering hooks
    // This preserves the bcrypt hashes from MongoDB
    
    // Get all clinics
    const clinics = await sequelize.query(
      'SELECT id, email, password FROM clinics',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log(`Found ${clinics.length} clinics`);
    
    // Get all doctors
    const doctors = await sequelize.query(
      'SELECT id, email, password FROM doctors',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log(`Found ${doctors.length} doctors`);
    
    // Check if passwords are already bcrypt hashes (they should start with $2a$, $2b$, or $2y$)
    const bcryptPattern = /^\$2[aby]\$\d{2}\$/;
    
    let clinicsOk = 0;
    let doctorsOk = 0;
    
    for (const clinic of clinics) {
      if (bcryptPattern.test(clinic.password)) {
        clinicsOk++;
      } else {
        console.log(`⚠️  Clinic ${clinic.email} has invalid password hash`);
      }
    }
    
    for (const doctor of doctors) {
      if (bcryptPattern.test(doctor.password)) {
        doctorsOk++;
      } else {
        console.log(`⚠️  Doctor ${doctor.email} has invalid password hash`);
      }
    }
    
    console.log(`\n✅ ${clinicsOk}/${clinics.length} clinics have valid bcrypt hashes`);
    console.log(`✅ ${doctorsOk}/${doctors.length} doctors have valid bcrypt hashes`);
    
    if (clinicsOk === clinics.length && doctorsOk === doctors.length) {
      console.log('\n✅ All passwords are already properly hashed. No action needed.');
      console.log('Your passwords should work correctly now.');
    } else {
      console.log('\n⚠️  Some passwords are not properly hashed.');
      console.log('This might indicate an issue with the migration.');
    }
    
  } catch (error) {
    console.error('Error fixing passwords:', error);
  } finally {
    await sequelize.close();
  }
}

fixPasswords();
