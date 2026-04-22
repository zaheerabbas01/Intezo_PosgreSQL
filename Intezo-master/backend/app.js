import express from 'express';
import http from 'http';
import mainRouter from './routes/index.js';
import { log } from 'console';
import 'dotenv/config';
import cors from 'cors';
import { initializeSocket } from './config/pusher.js';
import redisClient, { connectRedis } from './config/redis.js';
import './cron/dailyReset.js';
import './cron/clinicHoursReset.js';
import { Clinic, Doctor } from './models/index.js';
import { performanceMonitor, cacheHeaders } from './middleware/performance.js';
import FCMService from './services/fcmService.js';
import { performStartupQueueCheck } from './scripts/startup-queue-check.js';
import { connectDB } from './config/database.js';

const app = express();
const server = http.createServer(app);


app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  credentials: false
}));

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

// add urlencoded parser so Pusher auth (application/x-www-form-urlencoded) is parsed
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for profile photos
app.use('/uploads', express.static('uploads'));

// Serve static files for public pages
app.use(express.static('public'));

// Add performance monitoring and caching
app.use(performanceMonitor);
app.use(cacheHeaders(300)); // 5 minute cache for public endpoints

// Initialize everything in proper order
const startServer = async () => {
  try {
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
    console.log('✅ Startup verification completed');
    
    // Set up routes
    app.use('/api', mainRouter);
    
    // Sitemap route at root level
    app.get('/sitemap.xml', async (req, res) => {
      try {
        const baseUrl = 'https://web.intezo.online';
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
    
    // Direct routes for frontend compatibility
    app.post('/login/doctor', async (req, res) => {
      try {
        const { loginDoctor } = await import('./controllers/authController.js');
        await loginDoctor(req, res);
      } catch (err) {
        res.status(500).json({ error: 'Login failed' });
      }
    });
    
    // app.post('/auth/admin/login', async (req, res) => {
    //   try {
    //     const { loginAdmin } = await import('./controllers/authController.js');
    //     await loginAdmin(req, res);
    //   } catch (err) {
    //     res.status(500).json({ error: 'Admin login failed' });
    //   }
    // });
    
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