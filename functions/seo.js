// FILE: functions/seo.js

/**
 * SEO Cloud Function for Business Profiles
 * Handles bot detection and serves pre-rendered HTML with meta tags
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin (only if not already initialized)
if (!admin.apps.length) {
    admin.initializeApp();
}

console.log('🔍 [SEO] Module loaded');

// Bot user agents to detect
const BOT_AGENTS = [
    'googlebot',
    'bingbot',
    'slurp',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'facebookexternalhit',
    'twitterbot',
    'whatsapp',
    'linkedinbot',
    'pinterestbot',
    'slackbot',
    'telegrambot'
];

/**
 * Detect if request is from a bot/crawler
 */
function isBot(userAgent) {
    if (!userAgent) {
        console.log('⚠️ [SEO] No user agent provided');
        return false;
    }
    
    const agent = userAgent.toLowerCase();
    const detected = BOT_AGENTS.some(bot => agent.includes(bot));
    
    console.log('🔍 [SEO] User agent check:', {
        userAgent: agent.substring(0, 50),
        isBot: detected
    }); 
    
    return detected;
}

/**
 * Generate meta tags HTML for business profile
 */
function generateBusinessMetaTags(business, generatedSlug) {
    const businessName = business.businessName || business.name || business.displayName || 'Business';
    const bio = business.bio || business.description || business.aboutUs || '';
    
    console.log('📄 [SEO] Generating meta tags for:', businessName);
    
    // Use provided generatedSlug if business.slug doesn't exist
    const slug = business.slug || generatedSlug;
    
    const title = `${businessName} - SocialU Hội An`;
    const description = bio ||
        `Connect with ${businessName} on SocialU. ${business.category || 'Local business'} in Hội An, Vietnam.`;
    const imageUrl = business.photos?.[0] || 'https://hoi-an-social-app.web.app/assets/default-business.jpg';
    const url = `https://hoi-an-social-app.web.app/business/${slug}`;
    
    // Escape special characters for HTML
    const escapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
    
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeBusinessName = escapeHtml(businessName);
    const safeImageUrl = escapeHtml(imageUrl);
    const safeUrl = escapeHtml(url);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Primary Meta Tags -->
    <title>${safeTitle}</title>
    <meta name="title" content="${safeTitle}">
    <meta name="description" content="${safeDescription}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="business.business">
    <meta property="og:url" content="${safeUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${safeImageUrl}">
    <meta property="og:site_name" content="SocialU">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${safeUrl}">
    <meta property="twitter:title" content="${safeTitle}">
    <meta property="twitter:description" content="${safeDescription}">
    <meta property="twitter:image" content="${safeImageUrl}">
    
    <!-- Structured Data - LocalBusiness Schema -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "${safeBusinessName}",
        "description": "${safeDescription}",
        "image": "${safeImageUrl}",
        "url": "${safeUrl}",
        "telephone": "${escapeHtml(business.phone || '')}",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Hội An",
            "addressCountry": "VN"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": ${business.location?.latitude || 15.8801},
            "longitude": ${business.location?.longitude || 108.3380}
        },
        "priceRange": "${escapeHtml(business.priceRange || '$$')}",
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "${business.rating || 4.5}",
            "reviewCount": "${business.reviewCount || 0}"
        }
    }
    </script>
    
    <!-- For bots: Keep them here to read meta tags -->
    <!-- For users with JS: Redirect after brief delay -->
    <script>
        // Only redirect if not a bot (bots don't execute JS anyway)
        setTimeout(function() {
            window.location.href = 'https://hoi-an-social-app.web.app/#business/${slug}';
        }, 100);
    </script>
    
    <noscript>
        <meta http-equiv="refresh" content="1; url=https://hoi-an-social-app.web.app/#business/${slug}">
    </noscript>
</head>
<body>
    <h1>${safeBusinessName}</h1>
    <p>${safeDescription}</p>
    <img src="${safeImageUrl}" alt="${safeBusinessName}">
    <a href="${safeUrl}">Visit ${safeBusinessName} on SocialU</a>
</body>
</html>
    `.trim();
}

/**
 * Cloud Function to serve SEO-optimized pages
 */
exports.businessProfile = functions.https.onRequest(async (req, res) => {
    const startTime = Date.now();
    const userAgent = req.get('user-agent') || '';
    const path = req.path;
    const slug = path.split('/').filter(Boolean).pop();
    
    console.log('🔍 [SEO] Request received:', {
        path,
        slug,
        userAgent: userAgent.substring(0, 100),
        isBot: isBot(userAgent),
        timestamp: new Date().toISOString()
    });
    
    // If not a bot, redirect to main app with hash routing
    if (!isBot(userAgent)) {
        const redirectUrl = `https://hoi-an-social-app.web.app/#business/${slug}`;
        console.log('👤 [SEO] Regular user detected, redirecting to:', redirectUrl);
        return res.redirect(302, redirectUrl);
    }
    
    // Bot detected - serve pre-rendered HTML
    try {
        console.log('🤖 [SEO] Bot detected, fetching business data for:', slug);
        
        // Helper function to create slug from name (matches categoryPage.js logic)
        const createSlug = (name) => {
            if (!name) return '';
            return name
                .toLowerCase()
                .normalize('NFD')                    // Normalize accented characters
                .replace(/[\u0300-\u036f]/g, '')    // Remove diacritics
                .replace(/đ/g, 'd')                 // Vietnamese đ → d
                .replace(/[^a-z0-9\s-]/g, '')       // Remove special chars except spaces and hyphens
                .replace(/\s+/g, '-')               // Spaces → hyphens
                .replace(/-+/g, '-')                // Multiple hyphens → single hyphen
                .replace(/^-|-$/g, '')              // Remove leading/trailing hyphens
                .trim();
        };
        
        // Try to find by slug field first
        let businessDoc = await admin.firestore()
            .collection('businesses')
            .where('slug', '==', slug)
            .limit(1)
            .get();
        
        // If not found by slug, search by generated slug from name
        if (businessDoc.empty) {
            console.log('⚠️ [SEO] No slug field found, searching by name...');
            
            const allBusinesses = await admin.firestore()
                .collection('businesses')
                .get();
            
            console.log(`📊 [SEO] Total businesses in database: ${allBusinesses.size}`);
            
            // Find business where generated slug matches
            const matchingBusiness = allBusinesses.docs.find(doc => {
                const business = doc.data();
                const businessName = business.name || business.displayName || business.businessName || '';
                const generatedSlug = createSlug(businessName);
                console.log(`  🔍 Checking: "${businessName}" → "${generatedSlug}" (looking for: "${slug}")`);
                return generatedSlug === slug;
            });
            
            if (matchingBusiness) {
                businessDoc = { 
                    empty: false, 
                    docs: [matchingBusiness] 
                };
                console.log('✅ [SEO] Found business by name match:', matchingBusiness.data().name || matchingBusiness.data().businessName);
            }
        }
        
        if (businessDoc.empty) {
            console.log('❌ [SEO] Business not found:', slug);
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Business Not Found - SocialU</title></head>
                <body>
                    <h1>Business Not Found</h1>
                    <p>The business profile you're looking for doesn't exist.</p>
                    <a href="https://hoi-an-social-app.web.app">Return to SocialU</a>
                </body>
                </html>
            `);
        }
        
        const business = businessDoc.docs[0].data();
        const processingTime = Date.now() - startTime;
        
        console.log('✅ [SEO] Business found, generating meta tags:', {
            businessName: business.businessName || business.name,
            slug: business.slug || slug,
            processingTime: `${processingTime}ms`
        });
        
        const html = generateBusinessMetaTags(business, slug);
        
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
        res.status(200).send(html);
        
        console.log('✅ [SEO] Response sent successfully in', `${processingTime}ms`);
        
    } catch (error) {
        console.error('💥 [SEO] Error serving business profile:', {
            slug,
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Error - SocialU</title></head>
            <body>
                <h1>Error Loading Business</h1>
                <p>An error occurred while loading this business profile.</p>
                <a href="https://hoi-an-social-app.web.app">Return to SocialU</a>
            </body>
            </html>
        `);
    }
});

console.log('✅ [SEO] businessProfile function exported');