// 🎯 CLASSIFIED v7.0 - Complete Business Management System
// 
// BUSINESS WORKFLOW:
// 1. Business signs up → gets instant account with temp password
// 2. Business logs in → completes profile → status: pending_approval
// 3. Admin reviews → approves → status: active → appears in feeds
// 4. Business can manage their profile and view dashboard
//
// ADMIN WORKFLOW:
// 1. Set your admin email in isAdminUser() function
// 2. Admin sees "Admin Panel" in settings
// 3. Admin can approve/reject businesses
// 4. Admin gets notifications of pending businesses
//
// USER WORKFLOW:
// 1. Can browse as guest (limited)
// 2. Sign up for full access
// 3. Complete profile → appears in user feed
// 4. Referral system for growth

// 🎯 CLASSIFIED v7.0 - Complete Business Management System
// 
// IMPORTANT: This app requires proper Firestore Security Rules!
// Add these rules in Firebase Console > Firestore > Rules:

// javascript/main.js

// Import core modules
import { FirebaseConfig } from './config/firebase.js';
import { AppState } from './core/state.js';
import { MockData } from './data/mockData.js';

// Import feature modules
import { AuthManager } from './features/auth.js';
import { FeedManager } from './features/feed.js';
import { ProfileManager } from './features/profile.js';
// import { MessagingManager } from './features/messaging.js';
// import { BusinessManager } from './features/business.js';
// import { AdminManager } from './features/admin.js';
// import { ReferralManager } from './features/referral.js';
// import { PhotoUploadManager } from './features/photoUpload.js';

// Import UI modules
import { NavigationManager } from './ui/navigation.js';
// import { UIComponents } from './ui/components.js';
// import { ModalManager } from './ui/modals.js';

// Import utilities (these will be created next)
// import { Helpers } from './utils/helpers.js';

/**
 * Main application class that orchestrates all modules
 */
class ClassifiedApp {
    constructor() {
        console.log('🚀 Initializing CLASSIFIED v7.0 Modular Architecture...');
        
        // Core services
        this.firebaseConfig = new FirebaseConfig();
        this.state = new AppState();
        this.mockData = new MockData();
        
        // Manager instances will be created after Firebase init
        this.managers = {};
        
        // Store listeners for cleanup
        this.listeners = [];
        
        // Initialize the app
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Step 1: Initialize Firebase
            console.log('🔥 Initializing Firebase...');
            const firebaseServices = this.firebaseConfig.initialize();
            this.state.set('firebaseReady', true);
            
            // Step 2: Create manager instances
            console.log('📦 Creating manager instances...');
            await this.createManagers(firebaseServices);
            
            // Step 3: Set up cross-manager references
            console.log('🔗 Setting up manager references...');
            this.setupManagerReferences();
            
            // Step 4: Initialize managers
            console.log('🚀 Initializing managers...');
            await this.initializeManagers();
            
            // Step 5: Set up global API for backward compatibility
            console.log('🌐 Setting up global API...');
            this.setupGlobalAPI();
            
            // Step 6: Check for existing auth state
            this.setupInitialAuthState();
            
            console.log('✅ CLASSIFIED app ready!');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.handleInitError(error);
        }
    }
    
    /**
     * Create all manager instances
     */
    async createManagers(firebaseServices) {
        // Create manager instances
        this.managers = {
            auth: new AuthManager(firebaseServices, this.state),
            feed: new FeedManager(firebaseServices, this.state, this.mockData),
            profile: new ProfileManager(firebaseServices, this.state),
            // messaging: new MessagingManager(firebaseServices, this.state),
            // business: new BusinessManager(firebaseServices, this.state),
            // admin: new AdminManager(firebaseServices, this.state),
            // referral: new ReferralManager(firebaseServices, this.state),
            // photoUpload: new PhotoUploadManager(firebaseServices, this.state),
            navigation: new NavigationManager(firebaseServices, this.state),
            // ui: new UIComponents(firebaseServices, this.state),
            // modals: new ModalManager(firebaseServices, this.state),
            // helpers: new Helpers()
        };
        
        // Temporary: Add mock methods for testing
        this.setupTemporaryMethods();
    }
    
    /**
     * Set up cross-manager references
     */
    setupManagerReferences() {
        // Each manager gets references to other managers it needs
        Object.values(this.managers).forEach(manager => {
            if (manager && typeof manager.setManagers === 'function') {
                manager.setManagers(this.managers);
            }
        });
    }
    
    /**
     * Initialize all managers
     */
    async initializeManagers() {
        // Initialize each manager that has an init method
        for (const [name, manager] of Object.entries(this.managers)) {
            if (manager && typeof manager.init === 'function') {
                console.log(`🔧 Initializing ${name} manager...`);
                await manager.init();
            }
        }
    }
    
    /**
     * Set up global CLASSIFIED object for backward compatibility
     */
    setupGlobalAPI() {
        // Create the global CLASSIFIED object with all public methods
        window.CLASSIFIED = {
            // State access
            state: this.state._state, // Direct state access for compatibility
            data: this.mockData, // Direct data access for compatibility
            
            // Auth methods
            loginWithEmail: () => {
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                this.managers.auth.loginWithEmail(email, password).catch(err => {
                    alert('Login failed: ' + err.message);
                });
            },
            registerWithEmail: () => {
                const name = document.getElementById('registerName').value;
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const confirmPassword = document.getElementById('registerConfirmPassword').value;
                this.managers.auth.registerWithEmail(name, email, password, confirmPassword).catch(err => {
                    alert('Registration failed: ' + err.message);
                });
            },
            loginWithGoogle: () => this.managers.auth.loginWithGoogle().catch(err => {
                if (err) alert('Google login failed: ' + err.message);
            }),
            logout: () => this.managers.auth.logout().catch(err => {
                alert('Logout failed: ' + err.message);
            }),
            businessLogin: () => {
                const email = document.getElementById('businessLoginEmail').value;
                const password = document.getElementById('businessLoginPassword').value;
                this.managers.auth.businessLogin(email, password).catch(err => {
                    alert('Business login failed: ' + err.message);
                });
            },
            businessSignup: () => {
                const businessData = {
                    name: document.getElementById('businessSignupName').value,
                    email: document.getElementById('businessSignupEmail').value,
                    phone: document.getElementById('businessSignupPhone').value,
                    type: document.getElementById('businessSignupType').value
                };
                this.managers.auth.businessSignup(businessData).then(result => {
                    alert(`🎉 Business account created! Your temporary password is: ${result.tempPassword}\n\nYour account is pending approval. You can login now and complete your profile. We'll review it within 24 hours.`);
                    // Switch to login tab
                    this.switchBusinessAuthTab('login');
                    // Pre-fill login form
                    document.getElementById('businessLoginEmail').value = businessData.email;
                    document.getElementById('businessLoginPassword').value = result.tempPassword;
                }).catch(err => {
                    alert('Business signup failed: ' + err.message);
                });
            },
            enableGuestMode: () => this.managers.auth.enableGuestMode(),
            
            // Navigation methods
            showScreen: (screen) => this.managers.navigation.showScreen(screen),
            switchSocialTab: (tab) => this.managers.feed.switchSocialTab(tab),
            showLogin: () => this.managers.auth.showLogin(),
            showRegister: () => this.managers.auth.showRegister(),
            showBusinessAuth: () => this.managers.auth.showBusinessAuth(),
            
            // Settings
            openSettings: () => this.showTempMessage('openSettings'),
            
            // Profile methods
            openProfileEditor: () => this.managers.profile.openProfileEditor(),
            closeProfileEditor: () => this.managers.navigation.closeOverlay('profileEditor'),
            openBusinessProfileEditor: () => this.managers.profile.openBusinessProfileEditor(),
            closeBusinessProfileEditor: () => this.managers.navigation.closeOverlay('businessProfileEditor'),
            saveUserProfile: () => this.managers.profile.saveUserProfile(),
            saveBusinessProfile: () => this.managers.profile.saveBusinessProfile(),
            viewMyProfile: () => this.managers.profile.viewMyProfile(),
            closeMyProfile: () => this.managers.navigation.closeOverlay('myProfileView'),
            
            // User interactions
            openUserProfile: (user) => this.managers.profile.openUserProfile(user),
            closeUserProfile: () => this.managers.navigation.closeOverlay('userProfileView'),
            handleUserAction: (action, userId) => this.showTempMessage('handleUserAction', {action, userId}),
            filterUsers: (filter) => this.managers.feed.filterUsers(filter),
            
            // Business interactions
            openBusinessProfile: (id, type) => this.showTempMessage('openBusinessProfile', {id, type}),
            closeBusinessProfile: () => this.managers.navigation.closeOverlay('businessProfile'),
            showBusinessSignup: () => this.showTempMessage('showBusinessSignup'),
            submitQuickBusinessSignup: () => this.showTempMessage('submitQuickBusinessSignup'),
            
            // Chat methods
            openChat: (name, avatar) => this.showTempMessage('openChat', {name, avatar}),
            closeChat: () => this.managers.navigation.closeOverlay('individualChat'),
            sendMessage: () => this.showTempMessage('sendMessage'),
            openChatWithUser: (userName) => this.showTempMessage('openChatWithUser', userName),
            openProfileFromChat: () => this.showTempMessage('openProfileFromChat'),
            startChatFromMatch: () => this.showTempMessage('startChatFromMatch'),
            startChatWithViewedUser: () => this.showTempMessage('startChatWithViewedUser'),
            
            // Photo upload
            triggerPhotoUpload: (slot) => this.showTempMessage('triggerPhotoUpload', slot),
            handlePhotoUpload: (event) => this.showTempMessage('handlePhotoUpload', event),
            triggerBusinessPhotoUpload: (slot) => this.showTempMessage('triggerBusinessPhotoUpload', slot),
            handleBusinessPhotoUpload: (event) => this.showTempMessage('handleBusinessPhotoUpload', event),
            
            // Other methods
            shareApp: () => this.showTempMessage('shareApp'),
            showReferralCode: () => this.showTempMessage('showReferralCode'),
            shareMyProfile: () => this.managers.profile.shareMyProfile(),
            shareBusinessProfile: () => this.showTempMessage('shareBusinessProfile'),
            getDirections: () => this.showTempMessage('getDirections'),
            
            // Admin methods
            openAdminPanel: () => this.showTempMessage('openAdminPanel'),
            approveBusiness: (id) => this.showTempMessage('approveBusiness', id),
            rejectBusiness: (id) => this.showTempMessage('rejectBusiness', id),
            
            // Business auth tabs
            switchBusinessAuthTab: (tab) => this.switchBusinessAuthTab(tab),
            
            // Utility methods
            init: () => console.log('App already initialized'),
            
            // Choice selection for profile editor
            selectChoice: (type, value, element) => this.managers.profile.selectChoice(type, value, element),
            toggleInterest: (element) => this.managers.profile.toggleInterest(element)
        };
        
        // Also expose some properties for compatibility
        Object.defineProperty(window.CLASSIFIED, 'isAdminUser', {
            value: () => this.managers.auth ? this.managers.auth.isAdminUser() : false
        });
    }
    
    /**
     * Temporary method implementations for testing
     */
    setupTemporaryMethods() {
        console.log('🔧 Setting up temporary method implementations...');
    }
    
    /**
     * Temporary message display for unimplemented features
     */
    showTempMessage(method, data = null) {
        console.log(`📍 Called: ${method}`, data);
        // You can uncomment this to see alerts for each method call
        // alert(`Feature coming soon: ${method}`);
    }
    
    /**
     * Switch business auth tab
     */
    switchBusinessAuthTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.business-auth-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[onclick="CLASSIFIED.switchBusinessAuthTab('${tab}')"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Update form visibility
        document.querySelectorAll('.business-auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        const activeForm = document.getElementById(`business${tab.charAt(0).toUpperCase() + tab.slice(1)}Form`);
        if (activeForm) {
            activeForm.classList.add('active');
        }
    }
    
    /**
     * Populate demo data
     */
    populateDemoData() {
        // This will be implemented by the FeedManager
        console.log('📊 Populating demo data...');
    }
    
    /**
     * Set up initial auth state
     */
    setupInitialAuthState() {
        // Check if user is already logged in
        // This will be handled by AuthManager
        console.log('🔐 Checking initial auth state...');
    }
    
    /**
     * Handle initialization errors
     */
    handleInitError(error) {
        console.error('Failed to initialize app:', error);
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #2a2a2a; padding: 30px; border-radius: 10px; 
                        text-align: center; z-index: 9999;">
                <h3 style="color: #FF6B6B; margin-bottom: 10px;">⚠️ Initialization Error</h3>
                <p style="color: white; margin-bottom: 20px;">
                    Failed to initialize the app. Please refresh the page or check your internet connection.
                </p>
                <button onclick="location.reload()" 
                        style="background: #00D4FF; border: none; padding: 10px 20px; 
                               border-radius: 5px; color: white; cursor: pointer;">
                    Refresh Page
                </button>
            </div>
        `;
        document.body.appendChild(errorMessage);
    }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.classifiedApp = new ClassifiedApp();
    });
} else {
    // DOM already loaded
    window.classifiedApp = new ClassifiedApp();
}
 
