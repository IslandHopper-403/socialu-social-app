// javascript/core/state.js

/**
 * Centralized state management for the CLASSIFIED app
 */
export class AppState {
    constructor() {
        // Initialize state with default values
        this._state = {
            // Navigation state
            currentScreen: 'restaurant',
            currentSocialTab: 'userFeed',
            
            // Authentication state
            currentUser: null,
            isAuthenticated: false,
            isGuestMode: false,
            isBusinessUser: false,
            
            // UI state
            isProfileOpen: false,
            isChatOpen: false,
            isProfileEditorOpen: false,
            isUserProfileOpen: false,
            isBusinessProfileEditorOpen: false,
            
            // Current context
            currentBusiness: null,
            currentViewedUser: null,
            currentChatUser: null,
            currentUploadSlot: null,
            currentBusinessUploadSlot: null,
            lastMatchedUser: null,
            
            // User profile data
            userProfile: {
                name: '',
                age: '',
                bio: '',
                birthday: '',
                zodiac: '',
                height: '',
                career: '',
                interests: [],
                priority: '',
                relationship: '',
                lookingFor: '',
                marriage: '',
                photos: [],
                referralCode: ''
            },
            
            // Business profile data
            businessProfile: {
                name: '',
                type: '',
                description: '',
                address: '',
                phone: '',
                hours: '',
                priceRange: '',
                promoTitle: '',
                promoDetails: '',
                photos: [],
                status: 'pending_approval'
            },
            
            // System state
            firebaseReady: false
        };
        
        // Store callbacks for state changes
        this._listeners = new Map();
    }
    
    /**
     * Get current state value
     * @param {string} key - The state key to retrieve
     * @returns {*} The state value
     */
    get(key) {
        return this._getNestedValue(this._state, key);
    }
    
    /**
     * Set state value and notify listeners
     * @param {string} key - The state key to set
     * @param {*} value - The value to set
     */
    set(key, value) {
        const oldValue = this.get(key);
        this._setNestedValue(this._state, key, value);
        
        // Notify listeners
        this._notifyListeners(key, value, oldValue);
    }
    
    /**
     * Update multiple state values at once
     * @param {Object} updates - Object with key-value pairs to update
     */
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    }
    
    /**
     * Get entire state object (read-only)
     * @returns {Object} Copy of the current state
     */
    getState() {
        return JSON.parse(JSON.stringify(this._state));
    }
    
    /**
     * Subscribe to state changes
     * @param {string} key - The state key to watch (supports wildcards)
     * @param {Function} callback - Function to call when state changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        
        this._listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const listeners = this._listeners.get(key);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this._listeners.delete(key);
                }
            }
        };
    }
    
    /**
     * Reset state to defaults
     * @param {Array<string>} keys - Optional array of keys to reset
     */
    reset(keys = null) {
        if (!keys) {
            // Reset entire state
            Object.keys(this._state).forEach(key => {
                if (key !== 'firebaseReady') {
                    this.set(key, this._getDefaultValue(key));
                }
            });
        } else {
            // Reset specific keys
            keys.forEach(key => {
                this.set(key, this._getDefaultValue(key));
            });
        }
    }
    
    /**
     * Helper to get nested values using dot notation
     * @private
     */
    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => 
            current && current[key] !== undefined ? current[key] : undefined, obj);
    }
    
    /**
     * Helper to set nested values using dot notation
     * @private
     */
    _setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    
    /**
     * Notify listeners of state changes
     * @private
     */
    _notifyListeners(key, newValue, oldValue) {
        // Notify exact key listeners
        const exactListeners = this._listeners.get(key);
        if (exactListeners) {
            exactListeners.forEach(callback => {
                callback(newValue, oldValue, key);
            });
        }
        
        // Notify wildcard listeners
        this._listeners.forEach((callbacks, pattern) => {
            if (pattern.includes('*') && this._matchesPattern(key, pattern)) {
                callbacks.forEach(callback => {
                    callback(newValue, oldValue, key);
                });
            }
        });
    }
    
    /**
     * Check if key matches pattern with wildcards
     * @private
     */
    _matchesPattern(key, pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(key);
    }
    
    /**
     * Get default value for a state key
     * @private
     */
    _getDefaultValue(key) {
        const defaults = {
            currentScreen: 'restaurant',
            currentSocialTab: 'userFeed',
            currentUser: null,
            isAuthenticated: false,
            isGuestMode: false,
            isBusinessUser: false,
            isProfileOpen: false,
            isChatOpen: false,
            isProfileEditorOpen: false,
            isUserProfileOpen: false,
            isBusinessProfileEditorOpen: false,
            currentBusiness: null,
            currentViewedUser: null,
            currentChatUser: null,
            currentUploadSlot: null,
            currentBusinessUploadSlot: null,
            lastMatchedUser: null,
            userProfile: {
                name: '',
                age: '',
                bio: '',
                birthday: '',
                zodiac: '',
                height: '',
                career: '',
                interests: [],
                priority: '',
                relationship: '',
                lookingFor: '',
                marriage: '',
                photos: [],
                referralCode: ''
            },
            businessProfile: {
                name: '',
                type: '',
                description: '',
                address: '',
                phone: '',
                hours: '',
                priceRange: '',
                promoTitle: '',
                promoDetails: '',
                photos: [],
                status: 'pending_approval'
            }
        };
        
        return defaults[key] !== undefined ? defaults[key] : null;
    }
}
