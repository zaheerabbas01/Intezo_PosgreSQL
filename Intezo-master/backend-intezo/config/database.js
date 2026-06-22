import { Sequelize } from 'sequelize';
import 'dotenv/config';

const sslEnabled = process.env.DB_SSL === 'true' || (
  process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false'
);

const sslOptions = sslEnabled ? {
  require: true,
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  ...(process.env.DB_CA_CERT
    ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n') }
    : {})
} : false;

const sequelize = new Sequelize(
  process.env.DB_NAME || 'intezo_queue',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    timezone: '+05:00',
    dialectOptions: { ssl: sslOptions },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error('❌ PostgreSQL Connection Error:', err.message);
    process.exit(1);
  }
};

export default sequelize;
