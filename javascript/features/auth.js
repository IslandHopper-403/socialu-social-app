// javascript/features/auth.js

import { 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Authentication Manager
 * Handles all authentication-related functionality
 */
export class AuthManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.googleProvider = firebaseServices.googleProvider;
        this.state = appState;
        
        // References to other managers (set later)
        this.profileManager = null;
        this.businessManager = null;
        this.referralManager = null;
        this.messagingManager = null;
        this.feedManager = null;
        this.navigationManager = null;
        
        // Auth state listener
        this.authUnsubscribe = null;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.profileManager = managers.profile;
        this.businessManager = managers.business;
        this.referralManager = managers.referral;
        this.messagingManager = managers.messaging;
        this.feedManager = managers.feed;
        this.navigationManager = managers.navigation;
        this.favoritesCarousel = managers.favoritesCarousel;
    }
    
    /**
     * Initialize authentication system
     */
    async init() {
        console.log('🔐 Initializing authentication...');
        this.setupAuthListener();
        this.checkReferralCode();
    }
    
    /**
     * Set up Firebase auth state listener
     */
    setupAuthListener() {
        this.authUnsubscribe = onAuthStateChanged(this.auth, async (user) => {
            console.log('🔐 Auth state changed:', user ? user.email : 'No user');
            
            if (user) {
                await this.handleUserLogin(user);
            } else {
                this.handleUserLogout();
            }
        });
    }
    
    /**
     * Handle user login
     */
      async handleUserLogin(user) {
        this.state.update({
            currentUser: user,
            isAuthenticated: true,
            isGuestMode: false
        });
            
        // Hide auth screens
        this.hideAuthScreens();
        
        // Load user profile
        await this.loadUserProfile(user.uid);
        
        // Check if business user BEFORE showing UI
        const isBusiness = await this.checkIfBusiness(user);
        
        // Route to appropriate interface
        if (isBusiness) {
            // Business users go straight to dashboard
            this.routeBusinessUser();
        } else {
            // Regular users see social features
            this.routeRegularUser();
        }
        
        // Initialize messaging if available
        if (this.messagingManager) {
            this.messagingManager.init();
        }
        
        // CRITICAL: Await notification to ensure feeds load before UI shows
        await this.notifyLogin(user);
    
         // Load favorites for logged in user
        if (this.favoritesCarousel) {
            this.favoritesCarousel.onUserLogin(user);
        }
    }
    
  /**
     * Handle user logout
     */
   handleUserLogout() {
        this.state.update({
            currentUser: null,
            isAuthenticated: false,
            isBusinessUser: false,
            isGuestMode: false  // Reset guest mode too
        });
        
        // Clean up messaging listeners
        if (this.messagingManager) {
            this.messagingManager.cleanup();
        }
        
        // Clean up business dashboard resources
        if (this.businessManager) {
            this.businessManager.cleanup();
        }
        
        // Clear overlays but keep navigation state
        if (this.navigationManager) {
            this.navigationManager.clearOverlayStack();
            // DON'T clear navigation history - it breaks feed loading
        }
        
        // Reset ONLY overlay content (profiles, chats) - NOT feeds
        this.resetOverlayContent();
        
        // Reset UI to default state
        const mainScreens = document.querySelector('.main-screens');
        const bottomNav = document.querySelector('.bottom-nav');
        const businessDashboard = document.getElementById('businessDashboard');
        
        if (mainScreens) mainScreens.style.display = 'block';
        if (bottomNav) bottomNav.style.display = 'none';
        if (businessDashboard) {
            businessDashboard.classList.remove('show');
            businessDashboard.style.display = 'none';
        }
        
        // Always show login screen after logout
        this.showLogin();
        
        // Reset user data
        this.state.reset(['userProfile', 'businessProfile']);
    }
    
    /**
     * Reset all overlay content to prevent previous user data from showing
     * SECURITY: Critical for account switching
     */
    resetOverlayContent() {
        console.log('🧹 Resetting overlay content for account switch');
        
        // List of overlays that display user-specific content
        const overlaysToReset = [
            'userProfileView',
            'myProfileView',
            'businessProfile',
            'profileEditor',
            'businessProfileEditor',
            'individualChat',
            'settingsOverlay'
        ];
        
        overlaysToReset.forEach(overlayId => {
            const overlay = document.getElementById(overlayId);
            if (overlay) {
                // Reset common profile elements
                const elements = {
                    name: overlay.querySelector('[id*="Name"]'),
                    email: overlay.querySelector('[id*="Email"]'),
                    bio: overlay.querySelector('[id*="Bio"]'),
                    photos: overlay.querySelector('.profile-photos'),
                    messages: overlay.querySelector('.chat-messages')
                };
                
                // Clear text content
                if (elements.name) elements.name.textContent = '';
                if (elements.email) elements.email.textContent = '';
                if (elements.bio) elements.bio.textContent = '';
                
                // Clear photos
                if (elements.photos) elements.photos.innerHTML = '';
                
                // Clear messages
                if (elements.messages) elements.messages.innerHTML = '';
            }
        });
        
        // Clear chat list
        const chatList = document.getElementById('chatList');
        if (chatList) chatList.innerHTML = '';
        
        // DON'T clear feed containers - they reload on next login via onUserLogin()
        
        console.log('✅ Overlay content reset complete');
    }
    
    /**
     * Email login
     */
    async loginWithEmail(email, password) {
        if (!email || !password) {
            throw new Error('Please enter email and password');
        }
        
        try {
            this.showLoading();
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            console.log('✅ Email login successful');
            return userCredential.user;
        } catch (error) {
            this.hideLoading();
            console.error('❌ Login error:', error);
            throw this.formatAuthError(error);
        }
    }
    
    /**
     * Email registration
     */
   async registerWithEmail(name, email, password, confirmPassword) {
        // Validation
        if (!name || !email || !password || !confirmPassword) {
            throw new Error('Please fill in all fields');
        }
        
        // ADD: Name validation BEFORE anything else
        if (!/^[a-zA-Z\s\-'.]+$/.test(name)) {
            throw new Error('Name can only contain letters, spaces, hyphens, periods, and apostrophes');
        }
        
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        let user = null;  // Define in outer scope
        
        try {
            this.showLoading();
            
            // Create auth account
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            user = userCredential.user;  // Assign to outer variable (remove const)
            
            // Update display name
            await updateProfile(user, { displayName: name });

            // Save name to Firestore immediately
            await setDoc(doc(this.db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: email,
                name: name,  // Save the signup name
                createdAt: serverTimestamp()
            }, { merge: true });
            
            // Generate referral code
            const referralCode = this.generateReferralCode();
            
            // Check for referral
            const referredBy = sessionStorage.getItem('referralCode');
            
            // Create COMPLETE initial user profile with all fields
            const profileData = {
                // Required fields
                uid: user.uid,
                email: email,
                name: name,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                
                // Profile fields (initialize empty/defaults)
                bio: '',
                age: null,
                birthday: '',
                zodiac: '',
                height: '',
                career: '',
                interests: [],
                priority: '',
                relationship: '',
                lookingFor: '',
                marriage: '',
                photos: [],  // Initialize empty array
                
                // System fields
                referralCode: referralCode,
                location: 'Hoi An, Vietnam',
                isOnline: true,
                isPremium: !!referredBy,
                premiumUntil: referredBy ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
                businessFavorites: [],  // Initialize empty
                offerFavorites: []      // Initialize empty
            };
            
            await this.createUserProfile(user.uid, profileData);
            
            // Handle referral if exists
            if (referredBy && this.referralManager) {
                await this.referralManager.trackReferral(referredBy, user.uid);
                this.showReferralSuccess();
            }
            
            // Clear referral code
            sessionStorage.removeItem('referralCode');
            
            console.log('🎉 Registration completed successfully!');
            return user;
            
        } catch (error) {
            this.hideLoading();
            console.warn('⚠️ Profile document creation deferred:', error);
            // Don't throw - account created successfully
            // Profile will be created when user saves their profile
            return user;
        }
    }
    
    /**
     * Google login
     */
    async loginWithGoogle() {
        try {
            this.showLoading();
            
            const result = await signInWithPopup(this.auth, this.googleProvider);
            const user = result.user;
            
            // Check if new user
            const userDoc = await getDoc(doc(this.db, 'users', user.uid));
            
            if (!userDoc.exists()) {
                // Create profile for new Google user
                const referralCode = this.generateReferralCode();
                await this.createUserProfile(user.uid, {
                    name: user.displayName,
                    email: user.email,
                    photo: user.photoURL,
                    uid: user.uid,
                    referralCode: referralCode,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    location: 'Hoi An, Vietnam',
                    isOnline: true
                });
            }
            
            console.log('✅ Google login successful');
            return user;
            
        } catch (error) {
            this.hideLoading();
            console.error('❌ Google login error:', error);
            
            if (error.code === 'auth/popup-closed-by-user') {
                console.log('User closed Google popup');
                return null;
            }
            
            throw this.formatAuthError(error);
        }
    }
    
    /**
     * Business login
     */
    async businessLogin(email, password) {
        // Business login uses same Firebase auth
        const user = await this.loginWithEmail(email, password);
        
        // Verify it's a business account
        const businessDoc = await getDoc(doc(this.db, 'businesses', user.uid));
        if (!businessDoc.exists()) {
            await signOut(this.auth);
            throw new Error('This is not a business account. Please use regular login.');
        }
        
        return user;
    }
    
   /**
 * Business signup - supports businesses with OR without email
 * @param {Object} businessData - { name, email, phone, type, authEmail (optional), location (optional) }
 */
async businessSignup(businessData) {
    const { name, email, phone, type, authEmail, location } = businessData;
    
    // Only require name, phone, and type (email is optional now)
    if (!name || !phone || !type) {
        throw new Error('Please fill in name, phone, and type fields');
    }
    
    // Determine if email is real or needs a fake auth email
    const hasRealEmail = email && email.includes('@') && !email.includes('noemail') && !email.includes('@business.com');
    
    // Generate clean slug from business name for auth email
    const businessSlug = name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')              // Remove special chars
        .trim()
        .replace(/\s+/g, '')                       // Remove all spaces
        .substring(0, 30);                         // Limit length
    
    // Create auth email: use provided authEmail, real email, or generate from business name
    const loginEmail = authEmail || 
                      (hasRealEmail ? email : null) || 
                      `${businessSlug}@business.com`;
    
    try {
        this.showLoading();
        
        // Create temporary password
        const tempPassword = this.generateTempPassword();
        
        console.log(`📝 Creating business account:`);
        console.log(`   Name: ${name}`);
        console.log(`   Login Email: ${loginEmail}`);
        console.log(`   Contact Email: ${hasRealEmail ? email : 'NONE'}`);
        console.log(`   Phone: ${phone}`);
        
        // Create auth account (may use fake email for login only)
        const userCredential = await createUserWithEmailAndPassword(this.auth, loginEmail, tempPassword);
        const user = userCredential.user;
        
        // Update display name
        await updateProfile(user, { displayName: name });
        
        // Create business profile in Firestore
        await setDoc(doc(this.db, 'businesses', user.uid), {
            name: name,
            email: hasRealEmail ? email : '',              // BLANK if no real email
            contactEmail: hasRealEmail ? email : '',        // Separate field for clarity
            authEmail: loginEmail,                          // Store auth email (may be fake)
            phone: phone,
            type: type,
            status: 'pending_approval',
            uid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            tempPassword: tempPassword,
            location: location || 'Hoi An, Vietnam',
            hasRealEmail: hasRealEmail                      // Flag for CSV export
        });
        
        this.hideLoading();
        
        console.log(`✅ Business account created successfully`);
        
        // Return success info
        return {
            user: user,
            tempPassword: tempPassword,
            authEmail: loginEmail,
            hasRealEmail: hasRealEmail
        };
        
    } catch (error) {
        this.hideLoading();
        console.error('❌ Business signup error:', error);
        throw this.formatAuthError(error);
    }
}
    
    /**
     * Logout
     */
    async logout() {
        try {
            await signOut(this.auth);
            this.state.set('isGuestMode', false);
            console.log('✅ Logout successful');
        } catch (error) {
            console.error('❌ Logout error:', error);
            throw error;
        }
    }
    
    /**
     * Enable guest mode
     */
    enableGuestMode() {
        console.log('👤 Enabling guest mode');
        this.state.update({
            isGuestMode: true,
            isAuthenticated: false
        });
        
        // Hide auth screens
        this.hideAuthScreens();
        
        // Show guest banner
        if (this.navigationManager) {
            this.navigationManager.toggleGuestBanner(true);
        } else {
            const guestBanner = document.getElementById('guestBanner');
            if (guestBanner) {
                guestBanner.style.display = 'block';
            }
        }
        
        // Notify other managers
        this.notifyGuestMode();
    }
    
    /**
     * Create user profile in Firestore
     */
   async createUserProfile(uid, profileData) {
        try {
            console.log('📝 Attempting to create profile with data:', profileData);
            await setDoc(doc(this.db, 'users', uid), profileData);
            console.log('✅ User profile created in Firestore');
        } catch (error) {
            console.error('❌ Error creating user profile:', error);
            console.error('Profile data that failed:', profileData);
            throw error;
        }
    }
    
    /**
     * Load user profile from Firestore
     */
    async loadUserProfile(uid) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.state.set('userProfile', { 
                    ...this.state.get('userProfile'), 
                    ...userData 
                });
                console.log('✅ User profile loaded:', userData);
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
        }
    }
    
    /**
     * Check if user is a business
     */
    async checkIfBusiness(user) {
        try {
            const businessDoc = await getDoc(doc(this.db, 'businesses', user.uid));
            if (businessDoc.exists()) {
                this.state.update({
                    isBusinessUser: true,
                    businessProfile: businessDoc.data()
                });
                
                // Notify business manager
                if (this.businessManager) {
                    this.businessManager.handleBusinessLogin(businessDoc.data());
                }
                return true; // Return true for business
            }
            return false; // Return false for regular user
        } catch (error) {
            console.error('Error checking business status:', error);
            return false;
        }
    }
    
    /**
     * Route business user to dashboard
     */
    routeBusinessUser() {
        try {
            console.log('🏢 Routing business user to dashboard');

            // Mark body as business user for CSS
            document.body.classList.add('business-user');
            document.body.classList.remove('regular-user');
            
            // Hide regular user UI
            const mainScreens = document.querySelector('.main-screens');
            const bottomNav = document.querySelector('.bottom-nav');
            
            if (mainScreens) mainScreens.style.display = 'none';
            if (bottomNav) bottomNav.style.display = 'none';
            
            // Show business dashboard
            const businessDashboard = document.getElementById('businessDashboard');
            if (businessDashboard) {
                businessDashboard.classList.add('show');
                businessDashboard.style.display = 'flex';
            } else {
                console.error('Business dashboard element not found');
                // Fallback to regular view
                this.routeRegularUser();
                return;
            }
            
            // Initialize business messaging if available
            if (this.messagingManager) {
                this.messagingManager.initBusinessMode();
            }
            
            // Initialize business dashboard
            if (this.businessManager) {
                this.businessManager.initializeDashboard();
            }
        } catch (error) {
            console.error('Error routing business user:', error);
            // Fallback to regular view if routing fails
            this.routeRegularUser();
        }
    }
    
    /**
     * Route regular user to social features
     */
    routeRegularUser() {
        try {
            console.log('👥 Routing regular user to social features');

            // Mark body as regular user for CSS
            document.body.classList.add('regular-user');
            document.body.classList.remove('business-user');
            
            // Show regular UI
            const mainScreens = document.querySelector('.main-screens');
            const bottomNav = document.querySelector('.bottom-nav');
            
            if (mainScreens) mainScreens.style.display = 'block';
            if (bottomNav) bottomNav.style.display = 'flex';
            
            // Hide business dashboard if visible
            const businessDashboard = document.getElementById('businessDashboard');
            if (businessDashboard) {
                businessDashboard.classList.remove('show');
                businessDashboard.style.display = 'none';
            }
            
            // Initialize messaging for regular users
            if (this.messagingManager) {
                this.messagingManager.init();
            }
            
            // Notify other managers
            this.notifyLogin(this.state.get('currentUser'));
            
            // Load favorites for logged in user
            if (this.favoritesCarousel) {
                this.favoritesCarousel.onUserLogin(this.state.get('currentUser'));
            }
        } catch (error) {
            console.error('Error routing regular user:', error);
            // Show error message but continue
            console.warn('Some features may not be available');
        }
    }
    
    /**
     * Check for referral code in URL
     */
    checkReferralCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');
        
        if (referralCode) {
            sessionStorage.setItem('referralCode', referralCode);
            
            // Show referral welcome if referral manager exists
            if (this.referralManager) {
                this.referralManager.showReferralWelcome(referralCode);
            }
        }
    }
    
    /**
     * UI Helper Methods
     */
    showLogin() {
        this.showAuthScreen('login');
    }
    
    showRegister() {
        this.showAuthScreen('register');
    }
    
    showBusinessAuth() {
        this.showAuthScreen('businessAuth');
    }
    
    showAuthScreen(type) {
    // Don't show auth if in deep link mode
    if (window.__DEEP_LINK_MODE__) {
        console.log('🔗 Deep link mode active, blocking auth screen');
        return;
    }
    
    const screens = {
        login: 'loginScreen',
        register: 'registerScreen',
        businessAuth: 'businessAuthScreen'
    };
        
        // Hide all auth screens
        Object.values(screens).forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) screen.classList.remove('show');
        });
        
        // Show requested screen
        const targetScreen = document.getElementById(screens[type]);
        if (targetScreen) targetScreen.classList.add('show');
        
        // Update UI state
        document.querySelector('.main-screens')?.classList.remove('authenticated');
        document.querySelector('.bottom-nav')?.style.setProperty('display', 'none');
        document.getElementById('guestBanner')?.style.setProperty('display', 'none');
    }
    
    hideAuthScreens() {
        ['loginScreen', 'registerScreen', 'businessAuthScreen'].forEach(id => {
            document.getElementById(id)?.classList.remove('show');
        });
        
        // Update authentication state via navigation manager
        if (this.navigationManager) {
            this.navigationManager.updateAuthenticationState(true);
        } else {
            // Fallback for before navigation manager is set
            document.querySelector('.main-screens')?.classList.add('authenticated');
            document.querySelector('.bottom-nav')?.style.setProperty('display', 'flex');
        }
        
        document.getElementById('guestBanner')?.style.setProperty('display', 'none');
        
        this.hideLoading();
    }
    
    showLoading() {
        document.getElementById('loadingOverlay')?.classList.add('show');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('show');
    }
    
    showReferralSuccess() {
        alert('🎉 Welcome! You and your friend both got premium features!');
    }
    
    /**
     * Utility Methods
     */
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    generateTempPassword() {
        return Math.random().toString(36).slice(-8);
    }
    
    formatAuthError(error) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/email-already-in-use': 'An account already exists with this email',
            'auth/weak-password': 'Password should be at least 6 characters',
            'auth/invalid-email': 'Invalid email address',
            'auth/network-request-failed': 'Network error. Please check your connection',
            'auth/too-many-requests': 'Too many attempts. Please try again later'
        };
        
        return new Error(errorMessages[error.code] || error.message);
    }
    
    /**
     * Notify other managers of auth events
     */
    async notifyLogin(user) {
        console.log('📢 Notifying managers of login:', user.email);
        
        // Notify profile manager
        if (this.profileManager) {
            await this.profileManager.onUserLogin(user);
        }
        
        // CRITICAL: Ensure feed manager reloads - this fixes Browse People not populating
        if (this.feedManager) {
            console.log('📊 Triggering feed reload for:', user.email);
            try {
                await this.feedManager.onUserLogin(user);
                console.log('✅ Feed reload complete');
            } catch (error) {
                console.error('❌ Feed reload failed:', error);
                // Retry once if failed
                console.log('🔄 Retrying feed load...');
                setTimeout(() => {
                    this.feedManager.onUserLogin(user);
                }, 1000);
            }
        }
    }
    
    notifyGuestMode() {
        // Notify feed manager to show demo data
        if (this.feedManager) {
            this.feedManager.showDemoData();
        }
         // ADD THIS: Notify messaging manager to show demo data
        if (this.messagingManager) {
            this.messagingManager.showDemoOnlineUsers();
            this.messagingManager.showDemoChats();
        }
    }
    
    /**
     * Check if current user is admin
     */
    isAdminUser() {
        const user = this.state.get('currentUser');
        return user && (
            user.email === 'admin@classified.com' || 
            user.email === 'your-admin-email@gmail.com' // Replace with your email
        );
    }
    
    /**
     * Cleanup on destroy
     */
    destroy() {
        if (this.authUnsubscribe) {
            this.authUnsubscribe();
        }
    }
}
