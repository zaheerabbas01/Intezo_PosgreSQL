import sequelize from './config/database.js';

const updateColumns = async () => {
  try {
    console.log('Updating verification_code_expires columns to BIGINT...');
    
    await sequelize.query(`
      ALTER TABLE clinics ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
    `);
    console.log('✅ Updated clinics table');
    
    await sequelize.query(`
      ALTER TABLE doctors ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
    `);
    console.log('✅ Updated doctors table');
    
    await sequelize.query(`
      ALTER TABLE patients ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
    `);
    console.log('✅ Updated patients table');
    
    await sequelize.query(`
      ALTER TABLE users ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
    `);
    console.log('✅ Updated users table');
    
    await sequelize.query(`
      ALTER TABLE pending_users ALTER COLUMN verification_code_expires TYPE BIGINT USING EXTRACT(EPOCH FROM verification_code_expires) * 1000;
    `);
    console.log('✅ Updated pending_users table');
    
    console.log('✅ All tables updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating columns:', error.message);
    process.exit(1);
  }
};

updateColumns();
