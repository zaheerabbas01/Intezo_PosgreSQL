import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return false; // Stop after 10 attempts
      return Math.min(retries * 100, 3000);
    },
    connectTimeout: 10000,
    lazyConnect: true
  },
  retry_unfulfilled_commands: true
});

redisClient.on('error', (err) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Redis Error:', err.message);
  }
});

redisClient.on('connect', () => {
  // Silent
});

redisClient.on('ready', () => {
  // Silent
});

redisClient.on('end', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️  Redis disconnected');
  }
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    console.log('⚠️  Continuing without Redis - some features may be limited');
  }
};

export { connectRedis };
export default redisClient;