// javascript/utils/storage.js

/**
 * Local Storage Utility Module
 * Centralized localStorage/sessionStorage operations with error handling
 * 
 * USAGE:
 * import { getUserItem, setUserItem, clearUserData } from '../utils/storage.js';
 * 
 * USED BY:
 * - auth.js (user data cleanup)
 * - notifications.js (processed messages, unread counts, timestamps)
 * - matching.js (liked/passed users, seen matches)
 * - messaging.js (message read states, last active timestamps)
 * 
 * SECURITY:
 * - All keys are user-specific or chat-specific
 * - Prevents data leakage between accounts
 * - Comprehensive error handling
 */

/**
 * Get user-specific item from localStorage
 * Pattern: keyName_${userId}
 * 
 * @param {string} key - Storage key (without user suffix)
 * @param {string} userId - User ID
 * @returns {any} Parsed data or null if not found
 * 
 * @example
 * const likes = getUserItem('likedUsers', currentUser.uid);
 * // Reads from: likedUsers_abc123
 */
export function getUserItem(key, userId) {
    if (!userId) {
        console.warn('⚠️ [STORAGE] getUserItem: No userId provided for key:', key);
        return null;
    }
    
    const storageKey = `${key}_${userId}`;
    console.log(`📦 [STORAGE] Reading user item: ${storageKey}`);
    
    try {
        const item = localStorage.getItem(storageKey);
        
        if (item === null) {
            console.log(`📭 [STORAGE] No data found for: ${storageKey}`);
            return null;
        }
        
        const parsed = JSON.parse(item);
        console.log(`✅ [STORAGE] Successfully read ${storageKey}:`, typeof parsed === 'object' ? `${Object.keys(parsed).length} items` : parsed);
        return parsed;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error reading ${storageKey}:`, error);
        return null;
    }
}

/**
 * Set user-specific item in localStorage
 * Pattern: keyName_${userId}
 * 
 * @param {string} key - Storage key (without user suffix)
 * @param {any} value - Data to store (will be JSON stringified)
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 * 
 * @example
 * setUserItem('likedUsers', ['user1', 'user2'], currentUser.uid);
 * // Writes to: likedUsers_abc123
 */
export function setUserItem(key, value, userId) {
    if (!userId) {
        console.warn('⚠️ [STORAGE] setUserItem: No userId provided for key:', key);
        return false;
    }
    
    const storageKey = `${key}_${userId}`;
    console.log(`💾 [STORAGE] Writing user item: ${storageKey}`);
    
    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(storageKey, serialized);
        
        console.log(`✅ [STORAGE] Successfully wrote ${storageKey}`);
        return true;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error writing ${storageKey}:`, error);
        return false;
    }
}

/**
 * Get chat-specific item from localStorage
 * Pattern: keyName_${chatId}_${userId}
 * 
 * @param {string} key - Storage key (without chat/user suffix)
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @returns {any} Parsed data or null if not found
 * 
 * @example
 * const seenTime = getChatItem('seen', chatId, currentUser.uid);
 * // Reads from: seen_chat123_user456
 */
export function getChatItem(key, chatId, userId) {
    if (!chatId || !userId) {
        console.warn('⚠️ [STORAGE] getChatItem: Missing chatId or userId for key:', key);
        return null;
    }
    
    const storageKey = `${key}_${chatId}_${userId}`;
    console.log(`📦 [STORAGE] Reading chat item: ${storageKey}`);
    
    try {
        const item = localStorage.getItem(storageKey);
        
        if (item === null) {
            console.log(`📭 [STORAGE] No data found for: ${storageKey}`);
            return null;
        }
        
        // For timestamps, return as number
        if (!isNaN(item)) {
            return parseInt(item, 10);
        }
        
        const parsed = JSON.parse(item);
        console.log(`✅ [STORAGE] Successfully read ${storageKey}`);
        return parsed;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error reading ${storageKey}:`, error);
        return null;
    }
}

/**
 * Set chat-specific item in localStorage
 * Pattern: keyName_${chatId}_${userId}
 * 
 * @param {string} key - Storage key (without chat/user suffix)
 * @param {any} value - Data to store
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 * 
 * @example
 * setChatItem('seen', Date.now(), chatId, currentUser.uid);
 * // Writes to: seen_chat123_user456
 */
export function setChatItem(key, value, chatId, userId) {
    if (!chatId || !userId) {
        console.warn('⚠️ [STORAGE] setChatItem: Missing chatId or userId for key:', key);
        return false;
    }
    
    const storageKey = `${key}_${chatId}_${userId}`;
    console.log(`💾 [STORAGE] Writing chat item: ${storageKey}`);
    
    try {
        const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
        localStorage.setItem(storageKey, serialized);
        
        console.log(`✅ [STORAGE] Successfully wrote ${storageKey}`);
        return true;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error writing ${storageKey}:`, error);
        return false;
    }
}

/**
 * Get global item from localStorage (no user suffix)
 * 
 * @param {string} key - Storage key
 * @returns {any} Parsed data or null if not found
 * 
 * @example
 * const lastActive = getItem('lastAppActive');
 */
export function getItem(key) {
    console.log(`📦 [STORAGE] Reading global item: ${key}`);
    
    try {
        const item = localStorage.getItem(key);
        
        if (item === null) {
            console.log(`📭 [STORAGE] No data found for: ${key}`);
            return null;
        }
        
        // Try to parse as JSON, fallback to raw value
        try {
            const parsed = JSON.parse(item);
            console.log(`✅ [STORAGE] Successfully read ${key}`);
            return parsed;
        } catch {
            // Not JSON, return as-is (e.g., timestamps)
            return item;
        }
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error reading ${key}:`, error);
        return null;
    }
}

/**
 * Set global item in localStorage (no user suffix)
 * 
 * @param {string} key - Storage key
 * @param {any} value - Data to store
 * @returns {boolean} Success status
 * 
 * @example
 * setItem('lastAppActive', Date.now());
 */
export function setItem(key, value) {
    console.log(`💾 [STORAGE] Writing global item: ${key}`);
    
    try {
        const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
        localStorage.setItem(key, serialized);
        
        console.log(`✅ [STORAGE] Successfully wrote ${key}`);
        return true;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error writing ${key}:`, error);
        return false;
    }
}

/**
 * Remove user-specific item from localStorage
 * 
 * @param {string} key - Storage key (without user suffix)
 * @param {string} userId - User ID
 * @returns {boolean} Success status
 * 
 * @example
 * removeUserItem('likedUsers', currentUser.uid);
 * // Removes: likedUsers_abc123
 */
export function removeUserItem(key, userId) {
    if (!userId) {
        console.warn('⚠️ [STORAGE] removeUserItem: No userId provided for key:', key);
        return false;
    }
    
    const storageKey = `${key}_${userId}`;
    console.log(`🗑️ [STORAGE] Removing user item: ${storageKey}`);
    
    try {
        localStorage.removeItem(storageKey);
        console.log(`✅ [STORAGE] Successfully removed ${storageKey}`);
        return true;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error removing ${storageKey}:`, error);
        return false;
    }
}

/**
 * Clear all user-specific data from localStorage
 * SECURITY: Critical for account switching on shared devices
 * 
 * @param {string} userId - User ID
 * @returns {number} Number of items removed
 * 
 * @example
 * clearUserData(currentUser.uid);
 * // Removes all keys matching: *_abc123
 */
export function clearUserData(userId) {
    if (!userId) {
        console.warn('⚠️ [STORAGE] clearUserData: No userId provided');
        return 0;
    }
    
    console.log(`🧹 [STORAGE] Clearing all data for user: ${userId}`);
    
    // Known user-specific keys to clear
    const userKeys = [
        'likedUsers',
        'passedUsers',
        'seenMatches',
        'businessFavorites',
        'offerFavorites',
        'processedMessages',
        'processedNotifications',
        'unreadMessages',
        'lastSeenTimestamps',
        'messageReadStates',
        'lastAppClose'
    ];
    
    let removedCount = 0;
    
    try {
        userKeys.forEach(key => {
            const storageKey = `${key}_${userId}`;
            if (localStorage.getItem(storageKey)) {
                localStorage.removeItem(storageKey);
                removedCount++;
                console.log(`🧹 [STORAGE] Removed: ${storageKey}`);
            }
        });
        
        console.log(`✅ [STORAGE] Cleared ${removedCount} items for user ${userId}`);
        return removedCount;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error clearing user data:`, error);
        return removedCount;
    }
}

/**
 * Get all keys for a specific user
 * Useful for debugging and data migration
 * 
 * @param {string} userId - User ID
 * @returns {string[]} Array of storage keys
 * 
 * @example
 * const keys = getUserKeys(currentUser.uid);
 * console.log('User has data in:', keys);
 */
export function getUserKeys(userId) {
    if (!userId) {
        console.warn('⚠️ [STORAGE] getUserKeys: No userId provided');
        return [];
    }
    
    console.log(`🔍 [STORAGE] Finding keys for user: ${userId}`);
    
    const userKeys = [];
    const suffix = `_${userId}`;
    
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.endsWith(suffix)) {
                userKeys.push(key);
            }
        }
        
        console.log(`✅ [STORAGE] Found ${userKeys.length} keys for user ${userId}:`, userKeys);
        return userKeys;
        
    } catch (error) {
        console.error(`❌ [STORAGE] Error getting user keys:`, error);
        return [];
    }
}

/**
 * Export for sessionStorage operations (same API, different storage)
 */
export const sessionStorage = {
    getItem: (key) => {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`❌ [SESSION-STORAGE] Error reading ${key}:`, error);
            return null;
        }
    },
    
    setItem: (key, value) => {
        try {
            window.sessionStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`❌ [SESSION-STORAGE] Error writing ${key}:`, error);
            return false;
        }
    },
    
    removeItem: (key) => {
        try {
            window.sessionStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`❌ [SESSION-STORAGE] Error removing ${key}:`, error);
            return false;
        }
    }
};
