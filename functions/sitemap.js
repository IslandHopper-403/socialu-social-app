// FILE: functions/sitemap.js

/**
 * Sitemap Generation Cloud Function
 * Automatically generates sitemap.xml with all businesses and category pages
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Generate dynamic sitemap.xml
 */
exports.generateSitemap = functions.https.onRequest(async (req, res) => {
    console.log('🗺️ [Sitemap] Request received for sitemap.xml');
    console.log('🗺️ [Sitemap] User Agent:', req.get('user-agent'));
    
    try {
        // Query all approved and active businesses
        console.log('🔍 [Sitemap] Querying businesses from Firestore...');
        const businessesSnapshot = await admin.firestore()
            .collection('businesses')
            .where('status', '==', 'approved')
            .where('isActive', '==', true)
            .get();
        
        const businesses = businessesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('📊 [Sitemap] Found', businesses.length, 'businesses');
        
        // Extract unique categories
        const categoriesSet = new Set();
        businesses.forEach(business => {
            if (business.category) {
                categoriesSet.add(business.category);
                console.log('📂 [Sitemap] Category found:', business.category);
            }
        });
        const categories = Array.from(categoriesSet);
        
        console.log('📊 [Sitemap] Found', categories.length, 'unique categories');
        
        // Build sitemap XML
        const currentDate = new Date().toISOString();
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    
    <!-- Homepage -->
    <url>
        <loc>https://hoi-an-social-app.web.app/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <lastmod>${currentDate}</lastmod>
    </url>
    
   <!-- Main Location Page -->
<url>
    <loc>https://hoi-an-social-app.web.app/hoi-an</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
    <lastmod>${currentDate}</lastmod>
</url>
    
`;
        
        // Add category pages
        console.log('📝 [Sitemap] Adding category pages...');
        categories.forEach(category => {
            const slug = category.toLowerCase().replace(/\s+/g, '-');
            sitemap += `    <!-- Category: ${category} -->
    <url>
        <loc>https://hoi-an-social-app.web.app/hoi-an/${slug}</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
        <lastmod>${currentDate}</lastmod>
    </url>
`;
            console.log('✅ [Sitemap] Added category page:', slug);
        });
        
        // Add business profile pages
        console.log('📝 [Sitemap] Adding business pages...');
        businesses.forEach(business => {
            const lastMod = business.updatedAt 
                ? business.updatedAt.toDate().toISOString() 
                : currentDate;
            
            sitemap += `    <!-- Business: ${business.businessName} -->
    <url>
        <loc>https://hoi-an-social-app.web.app/business/${business.slug}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
        <lastmod>${lastMod}</lastmod>
    </url>
`;
            console.log('✅ [Sitemap] Added business page:', business.slug);
        });
        
        sitemap += `</urlset>`;
        
        // Calculate total URLs
        const totalUrls = 2 + categories.length + businesses.length; // Homepage + Location + Categories + Businesses
        
        console.log('✅ [Sitemap] Sitemap generated successfully');
        console.log('📊 [Sitemap] Total URLs:', totalUrls);
        console.log('📊 [Sitemap] Breakdown - Homepage: 1, Location: 1, Categories:', categories.length, 'Businesses:', businesses.length);
        
        // Set headers and send response
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.status(200).send(sitemap);
        
        console.log('✅ [Sitemap] Response sent successfully');
        
    } catch (error) {
        console.error('❌ [Sitemap] Error generating sitemap:', error);
        console.error('❌ [Sitemap] Error stack:', error.stack);
        res.status(500).send('Error generating sitemap');
    }
});