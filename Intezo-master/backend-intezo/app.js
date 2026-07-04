import express from 'express';
import http from 'http';
import mainRouter from './routes/index.js';
import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { initializeSocket, closeSocket } from './config/pusher.js';
import redisClient, { connectRedis } from './config/redis.js';
import { startDailyResetJob, stopDailyResetJob } from './cron/dailyReset.js';
import { startClinicHoursResetJob, stopClinicHoursResetJob } from './cron/clinicHoursReset.js';
import { Clinic, Doctor } from './models/index.js';
import { performanceMonitor, cacheHeaders } from './middleware/performance.js';
import FCMService from './services/fcmService.js';
import { performStartupQueueCheck } from './scripts/startup-queue-check.js';
import sequelize, { connectDB } from './config/database.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigins = (process.env.FRONTEND_URL || 'https://web.intezo.online')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Native mobile clients and server-to-server requests have no browser origin.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 30),
  skip: (req) =>
    req.originalUrl.startsWith('/api/auth/patient/phone/status'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

const patientPhoneStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 400,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many verification checks. Please start again later.' }
});

const phoneVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many phone verification requests. Please try again later.' }
});

app.use([
  '/api/auth',
  '/api/clinics/login',
  '/api/clinics/register',
  '/api/patients/register',
  '/api/doctors/login',
  '/api/doctors/register'
], authLimiter);
app.use('/api/phone-verification/start', phoneVerificationLimiter);
app.use('/api/auth/patient/phone/status', patientPhoneStatusLimiter);

// Initialize queue counters
const initializeQueueCounters = async () => {
  try {
    if (!redisClient.isOpen) {
      console.log('⚠️  Redis not connected, skipping queue counter initialization');
      return;
    }

    const clinics = await Clinic.findAll();
    for (const clinic of clinics) {
      const clinicCurrentKey = `clinic:${clinic.id}:current`;
      const clinicLastIssuedKey = `clinic:${clinic.id}:lastIssued`;
      
      if (!await redisClient.exists(clinicCurrentKey)) {
        await redisClient.set(clinicCurrentKey, 0);
      }
      if (!await redisClient.exists(clinicLastIssuedKey)) {
        await redisClient.set(clinicLastIssuedKey, 0);
      }
    }

    const doctors = await Doctor.findAll();
    for (const doctor of doctors) {
      const clinicAssociations = doctor.clinics || [];
      for (const clinicAssoc of clinicAssociations) {
        const clinicId = clinicAssoc.clinicId || clinicAssoc.clinic || clinicAssoc;
        const doctorCurrentKey = `doctor:${doctor.id}:clinic:${clinicId}:current`;
        const doctorLastIssuedKey = `doctor:${doctor.id}:clinic:${clinicId}:lastIssued`;
        
        if (!await redisClient.exists(doctorCurrentKey)) {
          await redisClient.set(doctorCurrentKey, 0);
        }
        if (!await redisClient.exists(doctorLastIssuedKey)) {
          await redisClient.set(doctorLastIssuedKey, 0);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error initializing queue counters:', err.message);
  }
};

// Call this function when your server starts

// Parse only bounded request bodies. Keep the exact WhatsApp webhook bytes so
// Meta's X-Hub-Signature-256 can be validated before trusting the payload.
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '1mb',
  verify: (req, _res, buffer) => {
    if (req.originalUrl.startsWith('/api/webhooks/whatsapp')) {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Swagger UI and JSON export
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Intezo Backend API Documentation'
  }));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
}

// Profile photos may be public. Medical reports are intentionally excluded and
// are available only through the authorized report download endpoint.
app.use('/uploads/profiles', express.static('uploads/profiles', {
  fallthrough: false,
  maxAge: '1d'
}));

// Serve static files for public pages
app.use(express.static('public'));

// Add performance monitoring and caching
app.use(performanceMonitor);
app.use(cacheHeaders(300)); // 5 minute cache for public endpoints

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

app.get('/readyz', async (_req, res) => {
  try {
    await sequelize.authenticate();
    const redisRequired = process.env.REQUIRE_REDIS === 'true' || process.env.NODE_ENV === 'production';
    if (redisRequired && !redisClient.isReady) {
      return res.status(503).json({ status: 'not_ready', database: 'up', redis: 'down' });
    }
    return res.json({
      status: 'ready',
      database: 'up',
      redis: redisClient.isReady ? 'up' : 'degraded'
    });
  } catch (_error) {
    return res.status(503).json({ status: 'not_ready', database: 'down' });
  }
});

const validateProductionConfiguration = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'JWT_SECRET', 'FRONTEND_URL', 'EMAIL_USER', 'EMAIL_PASS',
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (process.env.REQUIRE_S3_REPORT_STORAGE === 'true' && !process.env.REPORTS_S3_BUCKET) {
    throw new Error('REPORTS_S3_BUCKET is required when REQUIRE_S3_REPORT_STORAGE=true');
  }
};

// Initialize everything in proper order
const startServer = async () => {
  try {
    validateProductionConfiguration();
    console.log('\n🚀 Starting Intezo Queue System...\n');
    
    // Connect to PostgreSQL
    await connectDB();
    console.log('✅ PostgreSQL connected');
    
    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');
    
    // Initialize Socket.IO
    await initializeSocket(server);
    console.log('✅ Socket.IO initialized');
    
    // Initialize FCM service
    FCMService.initialize();
    console.log('✅ FCM service initialized');
    
    // Initialize queue counters
    await initializeQueueCounters();
    console.log('✅ Queue counters initialized');
    
    // Perform startup queue verification and fixes
    await performStartupQueueCheck();
    startDailyResetJob();
    startClinicHoursResetJob();
    console.log('✅ Startup verification completed');
    
    // Set up routes
    app.use('/api', mainRouter);
    
    // Sitemap route at root level
    app.get('/sitemap.xml', async (req, res) => {
      try {
        const baseUrl = process.env.PUBLIC_WEB_URL || 'https://web.intezo.online';
        const currentDate = new Date().toISOString();
        
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/clinic/login</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/clinic/register</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/doctor/login</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/doctor/register</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.send(sitemap);
      } catch (error) {
        console.error('Sitemap error:', error);
        res.status(500).send('Error generating sitemap');
      }
    });
    
    app.use((_req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    app.use((error, _req, res, _next) => {
      console.error('Unhandled request error:', error.message);
      res.status(error.message === 'Not allowed by CORS' ? 403 : 500).json({
        error: error.message === 'Not allowed by CORS' ? error.message : 'Internal server error'
      });
    });
    
    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(50));
      console.log(`🌐 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50) + '\n');
    });
    
  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    process.exit(1);
  }, 15000);
  forceExit.unref();

  stopDailyResetJob();
  stopClinicHoursResetJob();

  try {
    await closeSocket();
    await new Promise((resolve) => server.close(resolve));
    if (redisClient.isOpen) await redisClient.quit();
    await sequelize.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('Shutdown failed:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
