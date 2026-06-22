import mongoose from 'mongoose';
import sequelize from './config/database.js';
import Clinic from './models/Clinic.js';
import Doctor from './models/Doctor.js';
import 'dotenv/config';

/**
 * This script re-migrates passwords from MongoDB to PostgreSQL
 * without double-hashing them. It preserves the original bcrypt hashes.
 */

// MongoDB models
const mongoClinicSchema = new mongoose.Schema({}, { strict: false });
const mongoDoctorSchema = new mongoose.Schema({}, { strict: false });

const MongoClinic = mongoose.model('Clinic', mongoClinicSchema);
const MongoDoctor = mongoose.model('Doctor', mongoDoctorSchema);

async function fixMigratedPasswords() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    console.log('Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected\n');

    // Fix Clinics
    console.log('Fixing Clinic passwords...');
    const mongoClinics = await MongoClinic.find({});
    let clinicsFixed = 0;
    
    for (const mongoClinic of mongoClinics) {
      // Use raw query to update without triggering hooks
      await sequelize.query(
        'UPDATE clinics SET password = :password WHERE email = :email',
        {
          replacements: {
            password: mongoClinic.password,
            email: mongoClinic.email
          }
        }
      );
      clinicsFixed++;
      console.log(`✅ Fixed password for clinic: ${mongoClinic.email}`);
    }
    console.log(`\n✅ Fixed ${clinicsFixed} clinic passwords\n`);

    // Fix Doctors
    console.log('Fixing Doctor passwords...');
    const mongoDoctors = await MongoDoctor.find({});
    let doctorsFixed = 0;
    
    for (const mongoDoctor of mongoDoctors) {
      // Use raw query to update without triggering hooks
      await sequelize.query(
        'UPDATE doctors SET password = :password WHERE email = :email',
        {
          replacements: {
            password: mongoDoctor.password,
            email: mongoDoctor.email
          }
        }
      );
      doctorsFixed++;
      console.log(`✅ Fixed password for doctor: ${mongoDoctor.email}`);
    }
    console.log(`\n✅ Fixed ${doctorsFixed} doctor passwords\n`);

    console.log('🎉 Password fix completed successfully!');
    console.log('You can now login with your original passwords.');
    
    await mongoose.connection.close();
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing passwords:', error);
    process.exit(1);
  }
}

fixMigratedPasswords();
