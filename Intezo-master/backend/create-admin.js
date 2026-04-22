import sequelize from './config/database.js';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import 'dotenv/config';

const createAdminUser = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ where: { email: 'zaheerszhrs@gmail.com' } });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'zaheerszhrs@gmail.com',
      role: 'admin'
    });

    console.log('Admin user created successfully');
    console.log('Email: zaheerszhrs@gmail.com');
    console.log('Note: Use your authentication system to set password');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

createAdminUser();