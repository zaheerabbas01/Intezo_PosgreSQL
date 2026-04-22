import { Sequelize } from 'sequelize';
import 'dotenv/config';

async function testPostgres() {
  try {
    console.log('Testing PostgreSQL connection...');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Port:', process.env.DB_PORT || 5432);
    console.log('Database:', process.env.DB_NAME || 'intezo_queue');
    console.log('User:', process.env.DB_USER || 'postgres');
    console.log('Password:', process.env.DB_PASSWORD ? '****' : 'NOT SET');
    
    const sequelize = new Sequelize(
      process.env.DB_NAME || 'intezo_queue',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
      }
    );
    
    await sequelize.authenticate();
    console.log('\n✅ PostgreSQL connection successful!');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PostgreSQL connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\nSolution:');
      console.error('1. Check DB_PASSWORD in .env file');
      console.error('2. Make sure it matches your PostgreSQL password');
      console.error('3. No quotes or extra spaces around password');
    }
    
    process.exit(1);
  }
}

testPostgres();
