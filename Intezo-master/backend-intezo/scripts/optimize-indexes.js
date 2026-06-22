// scripts/optimize-indexes.js - Advanced database optimization
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const optimizeIndexes = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUrl) {
      throw new Error('MongoDB connection string not found');
    }
    await mongoose.connect(mongoUrl);
    console.log('🔗 Connected to MongoDB for optimization');

    const db = mongoose.connection.db;

    // Critical compound indexes for performance
    const criticalIndexes = [
      // Queue performance indexes
      { collection: 'queues', index: { clinic: 1, doctor: 1, status: 1, number: 1 } },
      { collection: 'queues', index: { clinic: 1, doctor: 1, bookedAt: -1 } },
      { collection: 'queues', index: { patient: 1, status: 1, bookedAt: -1 } },
      { collection: 'queues', index: { status: 1, bookedAt: 1 } },
      
      // Patient lookup indexes
      { collection: 'patients', index: { email: 1 } },
      { collection: 'patients', index: { phone: 1 } },
      { collection: 'patients', index: { isPremium: 1, premiumExpiresAt: 1 } },
      
      // Doctor availability indexes
      { collection: 'doctors', index: { 'clinics.clinic': 1, 'clinics.isActive': 1, 'clinics.isAvailable': 1 } },
      
      // Clinic status indexes
      { collection: 'clinics', index: { isOpen: 1, isActive: 1 } }
    ];

    for (const { collection, index } of criticalIndexes) {
      try {
        await db.collection(collection).createIndex(index);
        console.log(`✅ Created index on ${collection}:`, Object.keys(index).join(', '));
      } catch (error) {
        if (error.code === 86) {
          console.log(`ℹ️  Index exists on ${collection}`);
        } else {
          console.error(`❌ Error creating index on ${collection}:`, error.message);
        }
      }
    }

    // Analyze query performance
    console.log('\n📊 Analyzing collection statistics...');
    const collections = ['queues', 'patients', 'doctors', 'clinics'];
    
    for (const collectionName of collections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`${collectionName}: ${count} documents`);
      } catch (error) {
        console.log(`${collectionName}: Unable to get stats`);
      }
    }

    console.log('\n🎉 Database optimization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  }
};

optimizeIndexes();