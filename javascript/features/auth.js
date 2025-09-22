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
    }
    
         // PASTE THIS IN ITS PLACE
        async init() {
            console.log('🔐 Initializing authentication...');
            
            // Set a loading state immediately
            this.state.update({
                authLoading: true,
                isAuthenticated: false,
                isGuestMode: false
            });
            
            // Show a loading indicator to the user
            this.showAuthLoading();
            
            // Set up the auth listener with a proper initial check
            this.setupAuthListener();
            
            // Check referral codes, etc.
            this.checkReferralCode();
        }
        
        setupAuthListener() {
            let isInitialCheck = true;
            
            this.authUnsubscribe = onAuthStateChanged(this.auth, async (user) => {
                console.log('🔐 Auth state changed:', user ? user.email : 'No user');
                
                try {
                    if (user) {
                        await this.handleUserLogin(user);
                    } else {
                        // Only show login/guest options after the very first check
                        if (isInitialCheck) {
                            this.showAuthOptions();
                        } else {
                            this.handleUserLogout();
                        }
                    }
                } finally {
                    // Clear loading state only after the first check is complete
                    if (isInitialCheck) {
                        isInitialCheck = false;
                        this.state.set('authLoading', false);
                        this.hideAuthLoading();
                    }
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
    
    // ADD THIS LINE to force nav visibility
    document.querySelector('.bottom-nav').style.display = 'flex';
        
        // Hide auth screens
        this.hideAuthScreens();
        
        // Load user profile
        await this.loadUserProfile(user.uid);
        
        // Check if business user
        await this.checkIfBusiness(user);
        
        // Initialize messaging if available
        if (this.messagingManager) {
            this.messagingManager.init();
        }
        
        // Notify other managers
        this.notifyLogin(user);
    }
    
    /**
     * Handle user logout
     */
    handleUserLogout() {
        this.state.update({
            currentUser: null,
            isAuthenticated: false,
            isBusinessUser: false
        });
        
        // Clean up messaging listeners
        if (this.messagingManager) {
            this.messagingManager.cleanup();
        }
        
        // Show login screen unless in guest mode
        if (!this.state.get('isGuestMode')) {
            this.showLogin();
        }
        
        // Reset user data
        this.state.reset(['userProfile', 'businessProfile']);
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
        
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        try {
            this.showLoading();
            
            // Create auth account
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            
            // Update display name
            await updateProfile(user, { displayName: name });
            
            // Generate referral code
            const referralCode = this.generateReferralCode();
            
            // Check for referral
            const referredBy = sessionStorage.getItem('referralCode');
            
            // Create user profile
            const profileData = {
                name: name,
                email: email,
                uid: user.uid,
                referralCode: referralCode,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                location: 'Hoi An, Vietnam',
                isOnline: true,
                isPremium: !!referredBy,
                premiumUntil: referredBy ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null
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
            console.error('❌ Registration failed:', error);
            throw this.formatAuthError(error);
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
     * Business signup
     */
    async businessSignup(businessData) {
        const { name, email, phone, type } = businessData;
        
        if (!name || !email || !phone || !type) {
            throw new Error('Please fill in all fields');
        }
        
        try {
            this.showLoading();
            
            // Create temporary password
            const tempPassword = this.generateTempPassword();
            
            // Create auth account
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, tempPassword);
            const user = userCredential.user;
            
            // Update display name
            await updateProfile(user, { displayName: name });
            
            // Create business profile
            await setDoc(doc(this.db, 'businesses', user.uid), {
                name: name,
                email: email,
                phone: phone,
                type: type,
                status: 'pending_approval',
                uid: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                tempPassword: tempPassword,
                location: 'Hoi An, Vietnam'
            });
            
            this.hideLoading();
            
            // Return success info
            return {
                user: user,
                tempPassword: tempPassword
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
        // ADD THIS CHECK AT THE TOP
        if (this.state.get('isAuthenticated')) {
            console.warn('⚠️ Cannot enable guest mode while authenticated.');
            return;
        }

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
            await setDoc(doc(this.db, 'users', uid), profileData);
            console.log('✅ User profile created in Firestore');
        } catch (error) {
            console.error('❌ Error creating user profile:', error);
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
            }
        } catch (error) {
            console.error('Error checking business status:', error);
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

        // ADD THESE NEW METHODS
    showAuthOptions() {
        // This function decides what the user sees if they are not logged in on startup.
        // For now, it just shows the login screen, which includes the guest option.
        this.showLogin();
    }
    
    showAuthLoading() {
        // This uses your existing loading overlay to show the initial app load state.
        document.getElementById('loadingOverlay')?.classList.add('show');
    }
    
    hideAuthLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('show');
    }
    
    showAuthScreen(type) {
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
    notifyLogin(user) {
        // Notify profile manager
        if (this.profileManager) {
            this.profileManager.onUserLogin(user);
        }
        
        // Notify feed manager
        if (this.feedManager) {
            this.feedManager.onUserLogin(user);
        }
    }
    
    notifyGuestMode() {
        // Notify feed manager to show demo data
        if (this.feedManager) {
            this.feedManager.showDemoData();
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
