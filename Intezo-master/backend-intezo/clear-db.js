import sequelize from './config/database.js';
import 'dotenv/config';

async function clearDatabase() {
  try {
    console.log('Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('Connected!\n');

    console.log('Clearing all tables...');
    
    // Disable foreign key checks temporarily
    await sequelize.query('SET session_replication_role = replica;');
    
    // Truncate all tables
    await sequelize.query('TRUNCATE TABLE premium_payments CASCADE;');
    console.log('✓ Cleared premium_payments');
    
    await sequelize.query('TRUNCATE TABLE pending_users CASCADE;');
    console.log('✓ Cleared pending_users');
    
    await sequelize.query('TRUNCATE TABLE reports CASCADE;');
    console.log('✓ Cleared reports');
    
    await sequelize.query('TRUNCATE TABLE queues CASCADE;');
    console.log('✓ Cleared queues');
    
    await sequelize.query('TRUNCATE TABLE patients CASCADE;');
    console.log('✓ Cleared patients');
    
    await sequelize.query('TRUNCATE TABLE doctors CASCADE;');
    console.log('✓ Cleared doctors');
    
    await sequelize.query('TRUNCATE TABLE clinics CASCADE;');
    console.log('✓ Cleared clinics');
    
    await sequelize.query('TRUNCATE TABLE users CASCADE;');
    console.log('✓ Cleared users');
    
    // Re-enable foreign key checks
    await sequelize.query('SET session_replication_role = DEFAULT;');
    
    console.log('\n✅ All tables cleared successfully!');
    console.log('You can now run: npm run migrate\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    process.exit(1);
  }
}

clearDatabase();
