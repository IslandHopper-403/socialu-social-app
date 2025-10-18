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

exports.businessProfile = businessProfile;

console.log('✅ [Functions] All functions exported successfully');