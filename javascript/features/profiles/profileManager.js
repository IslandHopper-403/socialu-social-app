// javascript/features/profiles/profileManager.js

import { UserProfileManager } from './userProfile.js';

import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Profile Manager (Orchestrator)
 * Coordinates user and business profile functionality
 * 
 * RESPONSIBILITIES:
 * - Orchestrate UserProfileManager
 * - Coordinate with BusinessProfileManager (in business/)
 * - Set up event listeners
 * - Handle profile initialization
 * - Delegate profile operations
 */
export class ProfileManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // Initialize user profile sub-manager
        this.userProfile = new UserProfileManager(firebaseServices, appState);
        console.log('✅ [PROFILE-MANAGER] UserProfileManager sub-manager initialized');
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.photoUploadManager = null;
        this.referralManager = null;
        this.feedManager = null;
        this.userFeedManager = null;
        
        // Note: Business profiles handled by BusinessManager → BusinessProfileManager
        console.log('✅ [PROFILE-MANAGER] ProfileManager orchestrator initialized');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🔗 [PROFILE-MANAGER] setManagers() called');
        
        // Store references
        this.navigationManager = managers.navigation;
        this.photoUploadManager = managers.photoUpload;
        this.referralManager = managers.referral;
        this.feedManager = managers.feed;
        this.userFeedManager = managers.userFeed;
        
        // Pass references to userProfile sub-manager
        this.userProfile.setManagers(managers);
        
        console.log('✅ [PROFILE-MANAGER] Manager references set and passed to userProfile');
    }
    
    /**
     * Initialize profile system
     */
    async init() {
        console.log('👤 [PROFILE-MANAGER] Initializing profile manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load user profile if authenticated
        if (this.state.get('isAuthenticated')) {
            await this.loadCurrentUserProfile();
        }
        
        console.log('✅ [PROFILE-MANAGER] Profile manager initialized');
    }
    
    /**
     * Set up event listeners for profile interactions
     * CRITICAL: Delegates to userProfile methods
     */
    setupEventListeners() {
        console.log('🎧 [PROFILE-MANAGER] Setting up event listeners');
        
        // Choice buttons - delegate to userProfile
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choiceType = btn.dataset.choice;
                const value = btn.dataset.value;
                this.userProfile.selectChoice(choiceType, value, btn);
            });
        });
        
        // Interest buttons - delegate to userProfile
        document.querySelectorAll('.interest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.userProfile.toggleInterest(btn);
            });
        });

        // Auto-calculate zodiac when birthday changes - delegate to userProfile
        const birthdayInput = document.getElementById('profileBirthday');
        if (birthdayInput) {
            birthdayInput.addEventListener('change', () => {
                this.userProfile.updateZodiacDisplay();
            });
        }
        
        // Profile save buttons - Remove onclick and delegate to userProfile
        const saveUserBtn = document.querySelector('.save-profile-btn[onclick*="saveUserProfile"]');
        if (saveUserBtn) {
            saveUserBtn.removeAttribute('onclick');
            saveUserBtn.addEventListener('click', () => this.userProfile.saveUserProfile());
        }
        
        // Note: Business profile save button handled by BusinessProfileManager
        const saveBusinessBtn = document.querySelector('.save-profile-btn[onclick*="saveBusinessProfile"]');
        if (saveBusinessBtn) {
            // Leave business button alone - handled by business manager
            console.log('📝 [PROFILE-MANAGER] Business save button left for BusinessManager');
        }
        
        console.log('✅ [PROFILE-MANAGER] Event listeners set up');
    }
    
    /**
     * Handle user login - load profile
     */
    async onUserLogin(user) {
        console.log('👤 [PROFILE-MANAGER] Loading profile for logged in user...');
        await this.loadCurrentUserProfile();
    }
    
    /**
     * Load current user profile
     */
    async loadCurrentUserProfile() {
        const user = this.state.get('currentUser');
        if (!user) return;
        
        try {
            const userDoc = await getDoc(doc(this.db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.state.set('userProfile', { 
                    ...this.state.get('userProfile'), 
                    ...userData 
                });
                console.log('✅ [PROFILE-MANAGER] User profile loaded');
            }
        } catch (error) {
            console.error('❌ [PROFILE-MANAGER] Error loading user profile:', error);
        }
    }
    
    // ========== USER PROFILE DELEGATION METHODS ==========
    // All methods delegate to userProfile sub-manager
    
    /**
     * Open profile editor
     * DELEGATION: Passes to userProfile
     */
    openProfileEditor() {
        return this.userProfile.openProfileEditor();
    }
    
    /**
     * Close profile editor
     * DELEGATION: Passes to userProfile
     */
    closeProfileEditor() {
        return this.userProfile.closeProfileEditor();
    }
    
    /**
     * Save user profile
     * DELEGATION: Passes to userProfile
     */
    async saveUserProfile() {
        return this.userProfile.saveUserProfile();
    }
    
    /**
     * View my profile
     * DELEGATION: Passes to userProfile
     */
    viewMyProfile() {
        return this.userProfile.viewMyProfile();
    }
    
    /**
     * Open user profile view
     * DELEGATION: Passes to userProfile
     */
    openUserProfile(user) {
        return this.userProfile.openUserProfile(user);
    }
    
    /**
     * Select choice button
     * DELEGATION: Passes to userProfile
     */
    selectChoice(type, value, element) {
        return this.userProfile.selectChoice(type, value, element);
    }
    
    /**
     * Toggle interest selection
     * DELEGATION: Passes to userProfile
     */
    toggleInterest(element) {
        return this.userProfile.toggleInterest(element);
    }
    
    /**
     * Calculate zodiac sign
     * DELEGATION: Passes to userProfile
     */
    calculateZodiac(birthday) {
        return this.userProfile.calculateZodiac(birthday);
    }
    
    /**
     * Update zodiac display
     * DELEGATION: Passes to userProfile
     */
    updateZodiacDisplay() {
        return this.userProfile.updateZodiacDisplay();
    }
    
    /**
     * Share my profile
     * DELEGATION: Passes to userProfile
     */
    shareMyProfile() {
        return this.userProfile.shareMyProfile();
    }
    
   /**
     * Generate referral code
     * DELEGATION: Passes to userProfile
     */
    generateReferralCode() {
        return this.userProfile.generateReferralCode();
    }
    
    /**
     * Cleanup resources
     * DELEGATION: Passes to sub-managers
     */
    cleanup() {
        console.log('🧹 [PROFILE-MANAGER] Cleaning up resources');
        
        // Delegate to userProfile sub-manager
        if (this.userProfile && typeof this.userProfile.cleanup === 'function') {
            this.userProfile.cleanup();
        }
        
        // Note: Business profile cleanup handled by BusinessManager
        console.log('✅ [PROFILE-MANAGER] Cleanup complete');
    }
}
