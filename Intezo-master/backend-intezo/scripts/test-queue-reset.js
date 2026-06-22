import 'dotenv/config';
import sequelize from '../config/database.js';
import redisClient, { connectRedis } from '../config/redis.js';
import { resetAllDoctorQueuesForClinic, verifyAndFixRedisCounters } from '../utils/queueReset.js';
import Clinic from '../models/Clinic.js';
import Doctor from '../models/Doctor.js';

/**
 * Test script to verify queue reset functionality
 * Run this script to test if the queue reset is working properly
 */
const testQueueReset = async () => {
  try {
    console.log('🧪 Starting queue reset test...');
    
    // Connect to database and Redis
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL');
    
    await connectRedis();
    console.log('✅ Connected to Redis');
    
    // Get a test clinic
    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.log('❌ No clinics found for testing');
      return;
    }
    
    console.log(`🏥 Testing with clinic: ${clinic.name} (${clinic.id})`);
    
    // Get doctors in this clinic
    const doctors = await Doctor.findAll({ 
      where: {
        clinics: {
          [Op.contains]: [{ clinic: clinic.id }]
        }
      }
    });
    
    console.log(`👨‍⚕️ Found ${doctors.length} doctors in clinic`);
    
    // Set some test values in Redis
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
      await redisClient.set(redisKey, 5); // Set to 5 for testing
      console.log(`🔧 Set test value for ${doctor.name}: ${redisKey} = 5`);
    }
    
    // Verify the test values are set
    console.log('📊 Current Redis values before reset:');
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
      const value = await redisClient.get(redisKey);
      console.log(`   ${doctor.name}: ${value}`);
    }
    
    // Test the verification function
    console.log('🔍 Testing verification function...');
    const fixedCount = await verifyAndFixRedisCounters(clinic.id);
    console.log(`✅ Verification fixed ${fixedCount} counters`);
    
    // Check values after verification
    console.log('📊 Redis values after verification:');
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
      const value = await redisClient.get(redisKey);
      console.log(`   ${doctor.name}: ${value}`);
    }
    
    // Test the full reset function (without actually cancelling queues)
    console.log('🔄 Testing reset function (dry run)...');
    
    // Set test values again
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
      await redisClient.set(redisKey, 10); // Set to 10 for testing
    }
    
    // Verify they're reset to 0
    await verifyAndFixRedisCounters(clinic.id);
    
    console.log('📊 Final Redis values:');
    for (const doctor of doctors) {
      const redisKey = `doctor:${doctor.id}:clinic:${clinic.id}:current`;
      const value = await redisClient.get(redisKey);
      console.log(`   ${doctor.name}: ${value}`);
    }
    
    console.log('✅ Queue reset test completed successfully!');
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await sequelize.close();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    process.exit(0);
  }
};

// Run the test
testQueueReset();