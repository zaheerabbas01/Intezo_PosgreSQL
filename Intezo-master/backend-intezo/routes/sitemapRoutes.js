import express from 'express';
import Clinic from '../models/Clinic.js';

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = 'https://web.intezo.online';
    const currentDate = new Date().toISOString();
    
    // Static pages with priorities and change frequencies
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },
      { url: '/clinic/login', priority: '0.9', changefreq: 'monthly' },
      { url: '/clinic/register', priority: '0.9', changefreq: 'monthly' },
      { url: '/doctor/login', priority: '0.8', changefreq: 'monthly' },
      { url: '/doctor/register', priority: '0.8', changefreq: 'monthly' }
    ];

    // Get active clinics for dynamic content
    const clinics = await Clinic.findAll({ 
      where: { emailVerified: true },
      attributes: ['id', 'name'],
      limit: 100
    });
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    
    // Add static pages
    staticPages.forEach(page => {
      sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });
    
    // Add dynamic clinic pages (if needed for SEO)
    clinics.forEach(clinic => {
      sitemap += `
  <url>
    <loc>${baseUrl}/clinic/${clinic.id}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });
    
    sitemap += `
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

export default router;