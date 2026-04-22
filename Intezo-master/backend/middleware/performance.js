// middleware/performance.js - Performance monitoring middleware
import redisClient from '../config/redis.js';

export const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} - ${responseTime}ms`);
    }
    
    // Store performance metrics in Redis (optional)
    if (redisClient.isOpen) {
      const key = `perf:${req.method}:${req.path.replace(/\//g, ':')}`;
      redisClient.lPush(key, responseTime.toString()).catch(err => {
        console.error('Error storing performance metric:', err);
      });
      redisClient.lTrim(key, 0, 99); // Keep last 100 measurements
      redisClient.expire(key, 3600); // Expire after 1 hour
    }
    
    // Add performance header
    res.set('X-Response-Time', `${responseTime}ms`);
    
    return originalJson.call(this, data);
  };
  
  next();
};

export const cacheHeaders = (maxAge = 300) => {
  return (req, res, next) => {
    // Set cache headers for public endpoints
    if (req.path.includes('/public') || req.path.includes('/recent')) {
      res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        'ETag': `"${Date.now()}"`,
        'Vary': 'Accept-Encoding'
      });
    }
    next();
  };
};