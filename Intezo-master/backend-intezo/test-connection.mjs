import 'dotenv/config';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  }
);

try {
  await sequelize.authenticate();
  console.log('✅ Supabase connected successfully');
  const [results] = await sequelize.query(`
    SELECT table_name, table_schema 
    FROM information_schema.tables 
    WHERE table_type='BASE TABLE'
    ORDER BY table_schema, table_name
  `);
  if (results.length === 0) {
    console.log('⚠️  No tables found in any schema');
  } else {
    console.log('All tables:');
    results.forEach(r => console.log(` - ${r.table_schema}.${r.table_name}`));
  }
} catch (err) {
  console.error('❌ Connection failed:', err.message);
}
process.exit(0);
