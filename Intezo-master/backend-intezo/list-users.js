import sequelize from './config/database.js';
import 'dotenv/config';

/**
 * Lists all clinics and doctors with their password hash status
 */

async function listUsers() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL\n');

    // Get clinics
    const clinics = await sequelize.query(
      'SELECT id, name, email, LEFT(password, 30) as password_preview FROM clinics ORDER BY created_at',
      { type: sequelize.QueryTypes.SELECT }
    );

    // Get doctors
    const doctors = await sequelize.query(
      'SELECT id, name, email, LEFT(password, 30) as password_preview FROM doctors ORDER BY created_at',
      { type: sequelize.QueryTypes.SELECT }
    );

    const bcryptPattern = /^\$2[aby]\$\d{2}\$/;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                         CLINICS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (clinics.length === 0) {
      console.log('No clinics found.\n');
    } else {
      clinics.forEach((clinic, index) => {
        const isValidHash = bcryptPattern.test(clinic.password_preview);
        const status = isValidHash ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${clinic.name}`);
        console.log(`   Email: ${clinic.email}`);
        console.log(`   Password: ${clinic.password_preview}...`);
        console.log(`   Status: ${isValidHash ? 'Valid bcrypt hash' : 'INVALID - needs fix!'}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                         DOCTORS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (doctors.length === 0) {
      console.log('No doctors found.\n');
    } else {
      doctors.forEach((doctor, index) => {
        const isValidHash = bcryptPattern.test(doctor.password_preview);
        const status = isValidHash ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${doctor.name}`);
        console.log(`   Email: ${doctor.email}`);
        console.log(`   Password: ${doctor.password_preview}...`);
        console.log(`   Status: ${isValidHash ? 'Valid bcrypt hash' : 'INVALID - needs fix!'}`);
        console.log('');
      });
    }

    const totalUsers = clinics.length + doctors.length;
    const validClinics = clinics.filter(c => bcryptPattern.test(c.password_preview)).length;
    const validDoctors = doctors.filter(d => bcryptPattern.test(d.password_preview)).length;
    const totalValid = validClinics + validDoctors;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                         SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Users: ${totalUsers}`);
    console.log(`  - Clinics: ${clinics.length} (${validClinics} valid)`);
    console.log(`  - Doctors: ${doctors.length} (${validDoctors} valid)`);
    console.log(`\nValid Hashes: ${totalValid}/${totalUsers}`);

    if (totalValid < totalUsers) {
      console.log('\n⚠️  Some passwords need to be fixed!');
      console.log('Run: node fix-migrated-passwords.js\n');
    } else {
      console.log('\n✅ All passwords are properly hashed!\n');
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listUsers();
