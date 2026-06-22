import { createClient } from 'redis';
import 'dotenv/config';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return false;
      return Math.min(retries * 100, 3000);
    },
    connectTimeout: 10000,
    lazyConnect: true
  },
  retry_unfulfilled_commands: true
});

redisClient.on('error', (error) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('Redis error:', error.message);
  }
});

redisClient.on('end', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Redis disconnected');
  }
});

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    const redisRequired = process.env.REQUIRE_REDIS === 'true' || process.env.NODE_ENV === 'production';
    if (redisRequired) throw error;
    console.log('Continuing without Redis; realtime queue features are degraded');
  }
};

export { connectRedis };
export default redisClient;
