/**
 * SocialU Cloud Functions
 * SEO and server-side rendering for business profiles
 */
const admin = require('firebase-admin');

// Initialize Firebase Admin once
admin.initializeApp();

console.log('🚀 [Functions] Firebase Admin initialized');

// Import and export SEO functions
const { businessProfile } = require('./seo');
const { generateSitemap } = require('./sitemap');

exports.businessProfile = businessProfile;
exports.generateSitemap = generateSitemap;
exports.fixAllSlugs = require('./fixSlugs').fixAllSlugs;  // ADD THIS

console.log('✅ [Functions] All functions exported successfully');
console.log('📦 [Functions] Available: businessProfile, generateSitemap');