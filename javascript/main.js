// 🎯 CLASSIFIED v7.0 - Complete Business Management System
// 
// WORKING CONDITION - BEST WORKING CONDITION YET - ALL BUGS FIXED UNTIL THIS POINT
// WORKING CONDITION - Stable point with Map Feature
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
import { MessagingManager } from './features/messaging.js';
import { BusinessManager } from './features/business.js';
import { PhotoUploadManager } from './features/photoUpload.js';
import { AdminManager } from './features/admin.js';
import { ReferralManager } from './features/referral.js';
import { MapManager } from './features/map.js';
import { FavoritesCarouselManager } from './features/favoritesCarousel.js';




// Import UI modules
import { NavigationManager } from './ui/navigation.js';


// Import Firestore functions for main app
import {
    doc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';





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

         // ADD THIS: Ensure mockData is fully initialized
        console.log('🔍 MockData initialized:', !!this.mockData, 'Users:', this.mockData?.getUsers()?.length);
            
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
            const firebaseServices = await this.firebaseConfig.initialize();
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
            // Commented out this.setupInitialAuthState();

            // OPTIONAL: Load demo content immediately for better UX
            // This is non-blocking and just populates the feeds with preview content
            this.loadDemoContent();
            
            console.log('✅ CLASSIFIED app ready!');
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.handleInitError(error);
        }
    }

    // Optional: Add this new method if you want to keep the demo data preview
loadDemoContent() {
    // Load demo data in background for immediate visual feedback
    // This doesn't interfere with auth state
    try {
        this.managers.feed.populateRestaurantFeedWithData(this.mockData.getRestaurants());
        this.managers.feed.populateActivityFeedWithData(this.mockData.getActivities());
        console.log('📊 Demo content loaded for preview');
    } catch (error) {
        console.error('Could not load demo content:', error);
        // Non-critical error, don't block app
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
            messaging: new MessagingManager(firebaseServices, this.state),
            business: new BusinessManager(firebaseServices, this.state),
            admin: new AdminManager(firebaseServices, this.state),
            referral: new ReferralManager(firebaseServices, this.state),
            photoUpload: new PhotoUploadManager(firebaseServices, this.state),
            navigation: new NavigationManager(firebaseServices, this.state),
            // ADD THIS LINE for Maps Feature
            map: new MapManager(firebaseServices, this.state, this.mockData),
            // ADD THIS LINE for Favorites Carousel Feature
            this.managers.favoritesCarousel = new FavoritesCarouselManager(firebaseServices, this.state);

        };
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
            state: this.state._state,
            data: this.mockData,
            
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
                    this.switchBusinessAuthTab('login');
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
            openSettings: () => this.openSettings(),
            closeSettings: () => this.closeSettings(),
            showSwitchAccount: () => this.showSwitchAccount(),
            openBusinessDashboard: () => this.openBusinessDashboard(),
            openAdminPanel: () => alert('Admin panel coming soon!'),
            showHelp: () => this.showHelp(),
            contactSupport: () => this.contactSupport(),
            
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
      
            // FIXED: Enhanced handleUserAction method
            handleUserAction: (action, userId) => {
                if (!userId || userId === 'undefined') {
                    console.error('Invalid userId for action:', action);
                    return;
                }
                console.log(`User action: ${action} on user ${userId}`);
                
                const currentUser = this.state.get('currentUser');
                
                if (action === 'like') {
                    if (currentUser) {
                        // FIXED: Use messaging manager's processLikeAction method
                        this.managers.messaging.processLikeAction(currentUser.uid, userId)
                            .then(result => {
                                if (result.isMatch) {
                                    // It's a match! Show popup and switch to messaging
                                    console.log('🎉 It\'s a match!');
                                    // Switch to messaging tab
                                    this.managers.feed.switchSocialTab('messaging');
                                    // Popup is handled by triggerMatchPopup in messaging manager
                                } else {
                                    // Just a like, show confirmation
                                     window.CLASSIFIED.showLikeConfirmation(); // <-- CHANGED
                                }
                            })
                            .catch(err => {
                                console.error('Error handling like:', err);
                                window.CLASSIFIED.showLikeConfirmation(); // Fallback to positive UX
                            });
                    } else {
                        alert(`Please sign up to connect! 💖`);
                        this.managers.auth.showRegister();
                    }
                } else if (action === 'pass') {
                    window.CLASSIFIED.recordPass(currentUser?.uid, userId);     // <-- CHANGED
                    window.CLASSIFIED.removeUserFromFeed(userId);              // <-- CHANGED
                } else if (action === 'superlike') {
                    if (currentUser) {
                        this.managers.messaging.processLikeAction(currentUser.uid, userId, 'superlike')
                            .then(result => {
                                if (result.isMatch) {
                                    console.log('🎉 Super like match!');
                                    this.managers.feed.switchSocialTab('messaging');
                                } else {
                                    alert(`Super like sent! 🌟 They'll be notified!`);
                                    window.CLASSIFIED.sendSuperLikeNotification(userId);  // <-- CHANGED
                                }
                            })
                            .catch(err => {
                                console.error('Error handling super like:', err);
                                alert(`Super like sent! 🌟`);
                            });
                    } else {
                        alert(`Sign up to send super likes! 🌟`);
                        this.managers.auth.showRegister();
                    }
                }
            },
            
            // NEW: Helper methods for user actions
            async recordPass(fromUserId, toUserId) {
                if (!fromUserId) return;
                
                try {
                    const passId = `${fromUserId}_${toUserId}`;
                    await setDoc(doc(this.managers.messaging.db, 'passes', passId), {
                        fromUserId,
                        toUserId,
                        timestamp: serverTimestamp()
                    });
                    console.log('✅ Pass recorded:', passId);
                } catch (error) {
                    console.error('Error recording pass:', error);
                }
            },
            
            removeUserFromFeed(userId) {
                // Remove user card from UI with animation
                const userCards = document.querySelectorAll('.user-feed-item');
                userCards.forEach(card => {
                    const cardUserId = card.querySelector('.action-btn')?.onclick?.toString().match(/'([^']+)'/)?.[1];
                    if (cardUserId === userId) {
                        card.style.animation = 'fadeOut 0.3s ease';
                        setTimeout(() => {
                            card.remove();
                        }, 300);
                    }
                });
            },
            
            showLikeConfirmation() {
                // Show brief confirmation
                const notification = document.createElement('div');
                notification.className = 'like-notification';
                notification.innerHTML = '💖 Like sent!';
                notification.style.cssText = `
                    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                    background: rgba(0,212,255,0.9); color: white; padding: 12px 24px;
                    border-radius: 25px; z-index: 999; font-weight: 600;
                    animation: slideDown 0.3s ease;
                `;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 2000);
            },
            
            sendSuperLikeNotification(userId) {
                // In a real app, this would send a push notification
                console.log('🌟 Super like notification sent to user:', userId);
            },


            filterUsers: (filter) => this.managers.feed.filterUsers(filter),
            
            // Business interactions
            openBusinessProfile: (id, type) => this.managers.business.openBusinessProfile(id, type),
            closeBusinessProfile: () => this.managers.navigation.closeOverlay('businessProfile'),
            showBusinessSignup: () => this.managers.business.showBusinessSignup(),
            shareBusinessProfile: () => this.managers.business.shareBusinessProfile(),
            getDirections: () => this.managers.business.getDirections(),
            
            // Chat methods
            openChat: (name, avatar, userId) => this.managers.messaging.openChat(name, avatar, userId),
            closeChat: () => this.managers.navigation.closeOverlay('individualChat'),
            sendMessage: () => this.managers.messaging.sendMessage(),
            openChatWithUser: (userName) => this.managers.messaging.openChatWithUser(userName),
            openProfileFromChat: () => this.managers.messaging.openProfileFromChat(),
            startChatFromMatch: () => this.managers.messaging.startChatFromMatch(),
            startChatWithViewedUser: () => this.managers.messaging.startChatWithViewedUser(),
            
            // Photo upload
            triggerPhotoUpload: (slot) => this.managers.photoUpload.triggerPhotoUpload(slot),
            handlePhotoUpload: (event) => this.managers.photoUpload.handlePhotoUpload(event),
            triggerBusinessPhotoUpload: (slot) => this.managers.photoUpload.triggerBusinessPhotoUpload(slot),
            handleBusinessPhotoUpload: (event) => this.managers.photoUpload.handleBusinessPhotoUpload(event),
            
            // Other methods
            shareApp: () => this.shareApp(),
            shareMyProfile: () => this.managers.profile.shareMyProfile(),
            showReferralCode: () => this.managers.referral.showReferralCode(),
            
            // Business auth tabs
            switchBusinessAuthTab: (tab) => this.switchBusinessAuthTab(tab),
            
            // Choice selection for profile editor
            selectChoice: (type, value, element) => this.managers.profile.selectChoice(type, value, element),
            toggleInterest: (element) => this.managers.profile.toggleInterest(element),
            
            // Feed refresh methods
            populateUserFeed: () => this.managers.feed.populateUserFeed(),
            populateRestaurantFeed: () => this.managers.feed.populateRestaurantFeed(),
            populateActivityFeed: () => this.managers.feed.populateActivityFeed(),
        };
        
        // Also expose some properties for compatibility
        Object.defineProperty(window.CLASSIFIED, 'isAdminUser', {
            value: () => this.managers.auth ? this.managers.auth.isAdminUser() : false
        });
        
        // Favorites methods
        addToFavorites: (businessId) => this.managers.favoritesCarousel.addToFavorites(businessId),
        removeFavorite: (businessId) => this.managers.favoritesCarousel.removeFavorite(businessId),
        toggleFavorite: (businessId) => this.managers.favoritesCarousel.toggleFavorite(businessId),
        isFavorited: (businessId) => this.managers.favoritesCarousel.isFavorited(businessId),

    }
    
    /**
     * Settings implementation
     */
    openSettings() {
        console.log('⚙️ Opening settings');
        this.managers.navigation.showOverlay('settingsOverlay');
        this.updateSettingsDisplay();
    }
    
    closeSettings() {
        console.log('⚙️ Closing settings');
        this.managers.navigation.closeOverlay('settingsOverlay');
    }
    
    updateSettingsDisplay() {
        const user = this.state.get('currentUser');
        const userProfile = this.state.get('userProfile');
        const isBusinessUser = this.state.get('isBusinessUser');
        const isGuestMode = this.state.get('isGuestMode');
        
        // Update user info display
        if (isGuestMode) {
            document.getElementById('settingsUserName').textContent = 'Guest User';
            document.getElementById('settingsUserEmail').textContent = 'Not logged in';
            document.getElementById('settingsAccountType').textContent = 'Guest Mode';
            document.getElementById('settingsUserAvatar').innerHTML = '<span style="font-size: 36px;">👤</span>';
            
            // Hide profile buttons for guests
            document.getElementById('editProfileBtn').style.display = 'none';
            document.getElementById('viewProfileBtn').style.display = 'none';
            document.getElementById('logoutBtn').textContent = 'Sign In';
            document.getElementById('logoutBtn').onclick = () => {
                this.closeSettings();
                this.managers.auth.showLogin();
            };
        } else if (user) {
            // Update with user info
            document.getElementById('settingsUserName').textContent = userProfile?.name || user.displayName || 'User';
            document.getElementById('settingsUserEmail').textContent = user.email;
            document.getElementById('settingsAccountType').textContent = isBusinessUser ? 'Business Account' : 'Personal Account';
            
            // Update avatar if photo exists
            if (userProfile?.photos?.[0] || user.photoURL) {
                const avatarUrl = userProfile?.photos?.[0] || user.photoURL;
                document.getElementById('settingsUserAvatar').innerHTML = `
                    <div style="width: 80px; height: 80px; border-radius: 50%; background-image: url('${avatarUrl}'); background-size: cover; background-position: center;"></div>
                `;
            } else {
                document.getElementById('settingsUserAvatar').innerHTML = '<span style="font-size: 36px;">👤</span>';
            }
            
            // Show appropriate buttons
            document.getElementById('editProfileBtn').style.display = 'flex';
            document.getElementById('viewProfileBtn').style.display = 'flex';
            document.getElementById('logoutBtn').textContent = 'Sign Out';
            document.getElementById('logoutBtn').onclick = () => this.managers.auth.logout();
            
            // Show business dashboard button if business user
            document.getElementById('businessDashboardBtn').style.display = isBusinessUser ? 'flex' : 'none';
            
            // Show admin panel if admin
            document.getElementById('adminPanelBtn').style.display = this.managers.auth.isAdminUser() ? 'flex' : 'none';
        }
        
        // Update profile button onclick based on user type
        if (isBusinessUser) {
            document.getElementById('editProfileBtn').onclick = () => {
                this.closeSettings();
                this.managers.profile.openBusinessProfileEditor();
            };
        } else {
            document.getElementById('editProfileBtn').onclick = () => {
                this.closeSettings();
                this.managers.profile.openProfileEditor();
            };
        }
    }
    
    showSwitchAccount() {
        if (confirm('Switch to a different account? This will log you out.')) {
            this.managers.auth.logout().then(() => {
                this.closeSettings();
                this.managers.auth.showLogin();
            });
        }
    }
    
    openBusinessDashboard() {
        this.closeSettings();
        this.managers.profile.openBusinessProfileEditor();
    }
    
    shareApp() {
        const shareText = 'Join me on CLASSIFIED - discover Hoi An\'s hidden gems!';
        const shareUrl = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: 'CLASSIFIED Hoi An',
                text: shareText,
                url: shareUrl
            }).catch(err => console.log('Share cancelled'));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(`${shareText} - ${shareUrl}`).then(() => {
                alert('App link copied to clipboard! 📋');
            });
        }
    }
    
    showHelp() {
        alert(`
🌟 Welcome to CLASSIFIED!


🔍 Discover: Find the best restaurants and activities
👥 Connect: Meet travelers and locals
💬 Chat: Connect with matches
🏪 Business: Promote your business


Need help? Contact: support@classified.com
        `);
    }
    
    contactSupport() {
        window.location.href = 'mailto:support@classified.com?subject=CLASSIFIED Support Request';
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
     * Set up initial auth state
     */
 //   setupInitialAuthState() {
        // Check if user is already logged in
     //   console.log('🔐 Checking initial auth state...');
        
        // Show initial content while waiting for auth
      //  setTimeout(() => {
            // If no auth state determined after 2 seconds, show login
           // if (!this.state.get('isAuthenticated') && !this.state.get('isGuestMode')) {
             //   console.log('🔑 No auth state detected, showing login screen');
              //  this.managers.auth.showLogin();
                
                // Also load demo data in feeds for preview
             //   this.managers.feed.populateRestaurantFeedWithData(this.mockData.getRestaurants());
               // this.managers.feed.populateActivityFeedWithData(this.mockData.getActivities());
          //  }
       // }, 2000);
  //  }
    
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
    document.addEventListener('DOMContentLoaded', async () => {
        // Initialize ClassifiedApp
        window.classifiedApp = new ClassifiedApp();
    });
} else {
    // DOM already loaded
    window.classifiedApp = new ClassifiedApp();
}
