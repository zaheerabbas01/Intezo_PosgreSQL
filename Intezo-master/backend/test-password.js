import sequelize from './config/database.js';
import Clinic from './models/Clinic.js';
import Doctor from './models/Doctor.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

/**
 * Test script to verify password authentication works correctly
 * Usage: node test-password.js <email> <password>
 */

async function testPassword() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.log('Usage: node test-password.js <email> <password>');
      console.log('Example: node test-password.js clinic@example.com mypassword123');
      process.exit(1);
    }

    console.log(`\nTesting login for: ${email}\n`);

    await sequelize.authenticate();

    // Try to find as clinic
    let user = await Clinic.findOne({ where: { email } });
    let userType = 'Clinic';

    // If not found, try as doctor
    if (!user) {
      user = await Doctor.findOne({ where: { email } });
      userType = 'Doctor';
    }

    if (!user) {
      console.log('❌ User not found with this email');
      process.exit(1);
    }

    console.log(`✅ Found ${userType}: ${user.name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔐 Password hash in DB: ${user.password.substring(0, 20)}...`);
    
    // Check if it's a valid bcrypt hash
    const bcryptPattern = /^\$2[aby]\$\d{2}\$/;
    if (!bcryptPattern.test(user.password)) {
      console.log('⚠️  WARNING: Password hash format is invalid!');
      console.log('   Expected bcrypt format: $2a$10$... or $2b$10$...');
      console.log('   Run fix-migrated-passwords.js to fix this.');
      process.exit(1);
    }

    console.log('✅ Password hash format is valid (bcrypt)');

    // Test password comparison
    console.log(`\n🔍 Testing password: "${password}"`);
    const isMatch = await user.comparePassword(password);

    if (isMatch) {
      console.log('✅ ✅ ✅ PASSWORD MATCH! Login would succeed! ✅ ✅ ✅\n');
    } else {
      console.log('❌ Password does not match');
      console.log('\nTroubleshooting:');
      console.log('1. Make sure you\'re using the original password from MongoDB signup');
      console.log('2. Run: node fix-migrated-passwords.js');
      console.log('3. Check if the password was changed after migration\n');
    }

    await sequelize.close();
    process.exit(isMatch ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testPassword();
