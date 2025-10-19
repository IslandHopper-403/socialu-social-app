// javascript/utils/helpers.js

/**
 * Shared Utility Functions
 * Common helper functions used across multiple managers
 * 
 * USAGE:
 * import { formatMessageTime, fetchCustomerPhoto } from '../utils/helpers.js';
 * 
 * USED BY:
 * - businessDashboard.js (message display)
 * - businessMessaging.js (chat display)
 * - Any other managers that need these utilities
 */

import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Format timestamp for message display
 * Converts Firestore timestamps to human-readable relative time
 * 
 * @param {Timestamp|Date|number|null} timestamp - Firestore timestamp or Date object
 * @returns {string} Formatted time string (e.g., "Just now", "5m ago", "2h ago")
 * 
 * @example
 * const timeStr = formatMessageTime(message.timestamp);
 * // Returns: "Just now" or "5m ago" or "2h ago" or date string
 */
export function formatMessageTime(timestamp) {
    // Handle null/undefined
    if (!timestamp) {
        console.log('⏰ [HELPERS] formatMessageTime: No timestamp provided, returning "Just now"');
        return 'Just now';
    }
    
    try {
        // Convert Firestore timestamp to Date
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }
        
        // Less than 1 hour (show minutes)
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }
        
        // Less than 24 hours (show hours)
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }
        
        // Older than 24 hours (show date)
        return date.toLocaleDateString();
        
    } catch (error) {
        console.error('❌ [HELPERS] Error formatting message time:', error);
        return 'Recently';
    }
}

/**
 * Fetch customer profile photo from Firestore
 * Retrieves the first photo from a user's profile
 * 
 * @param {string} userId - User ID to fetch photo for
 * @param {Firestore} db - Firestore database instance
 * @returns {Promise<string>} Photo URL or empty string if not found
 * 
 * @example
 * const photoUrl = await fetchCustomerPhoto(conversation.userId, this.db);
 * if (photoUrl) {
 *     avatar.style.backgroundImage = `url('${photoUrl}')`;
 * }
 */
export async function fetchCustomerPhoto(userId, db) {
    // Validate inputs
    if (!userId) {
        console.warn('⚠️ [HELPERS] fetchCustomerPhoto: No userId provided');
        return '';
    }
    
    if (!db) {
        console.error('❌ [HELPERS] fetchCustomerPhoto: No database instance provided');
        return '';
    }
    
    console.log('📸 [HELPERS] Fetching customer photo for userId:', userId);
    
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Try to get photo from photos array first, then fallback to photo field
            const photoUrl = userData.photos?.[0] || userData.photo || '';
            
            if (photoUrl) {
                console.log('✅ [HELPERS] Customer photo found for:', userId);
            } else {
                console.log('📭 [HELPERS] No photo found for userId:', userId);
            }
            
            return photoUrl;
        } else {
            console.warn('⚠️ [HELPERS] User document not found for userId:', userId);
            return '';
        }
    } catch (error) {
        console.error('❌ [HELPERS] Error fetching customer photo:', error);
        return '';
    }
}

/**
 * Additional helper functions can be added here as needed
 * 
 * GUIDELINES FOR ADDING NEW HELPERS:
 * 1. Must be used by 2+ managers (DRY principle)
 * 2. Should be pure/stateless functions when possible
 * 3. Include comprehensive JSDoc documentation
 * 4. Add debug logging for troubleshooting
 * 5. Handle errors gracefully with fallbacks
 * 6. Export as named exports (not default)
 */
