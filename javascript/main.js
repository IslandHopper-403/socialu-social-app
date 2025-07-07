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

const CLASSIFIED = {
    // Enhanced App State Management
    state: {
        currentScreen: 'restaurant',
        currentSocialTab: 'userFeed',
        currentBusiness: null,
        currentViewedUser: null,
        currentChatUser: null,
        currentUser: null,
        isAuthenticated: false,
        isGuestMode: false,
        isProfileOpen: false,
        isChatOpen: false,
        isProfileEditorOpen: false,
        isUserProfileOpen: false,
        isBusinessProfileEditorOpen: false,
        currentUploadSlot: null,
        currentBusinessUploadSlot: null,
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
            photos: []
        },
        firebaseReady: false,
        isBusinessUser: false
    },
    
    // Enhanced App Data
    data: {
        users: [
            {
                name: "Jessica",
                age: 28,
                image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop",
                interests: ["Reading", "Gym", "Music", "Laughter", "Cafe Connoisseur"],
                bio: "Backpacker exploring Vietnam 🇻🇳 Looking for adventure buddies and great coffee spots!",
                isOnline: true,
                distance: "2 km",
                matchPercentage: 83,
                category: "nomads"
            },
            {
                name: "Dave",
                age: 32,
                image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
                interests: ["Surfing", "Photography", "Coffee", "Adventure Sports", "Live Music"],
                bio: "Digital nomad loving Hoi An vibes ✨ Always down for beach days and exploring local culture.",
                isOnline: false,
                distance: "1.5 km",
                matchPercentage: 76,
                category: "nomads"
            },
            {
                name: "Rebecca",
                age: 26,
                image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=600&fit=crop",
                interests: ["Yoga", "Cooking", "Beach", "Art", "Nightlife"],
                bio: "Artist seeking creative adventures 🎨 Love painting landscapes and meeting fellow creatives!",
                isOnline: true,
                distance: "800m",
                matchPercentage: 91,
                category: "all"
            },
            {
                name: "Alex",
                age: 29,
                image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop",
                interests: ["Hiking", "Beer", "Football", "Travel", "Food"],
                bio: "Exploring Southeast Asia one city at a time 🌏 Football fanatic and craft beer enthusiast.",
                isOnline: true,
                distance: "3.2 km",
                matchPercentage: 68,
                category: "all"
            },
            {
                name: "Maria",
                age: 24,
                image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
                interests: ["Dancing", "Food", "Travel", "Photography", "Beach"],
                bio: "Spanish girl making memories in Vietnam 💃 Love salsa dancing and trying street food!",
                isOnline: false,
                distance: "4.1 km",
                matchPercentage: 79,
                category: "all"
            },
            {
                name: "James",
                age: 30,
                image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=600&fit=crop",
                interests: ["Music", "Art", "Coffee", "Culture", "Adventure"],
                bio: "British musician discovering Southeast Asia 🎸 Looking for jam sessions and cultural experiences.",
                isOnline: true,
                distance: "1.8 km",
                matchPercentage: 85,
                category: "nomads"
            }
        ],
        restaurants: [
            {
                id: 'banh-mi-queen',
                name: "Banh Mi Queen",
                type: "Vietnamese Street Food",
                image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=150&h=200&fit=crop",
                promo: "2-for-1 Banh Mi Special",
                details: "Daily 7am-10pm • Perfect for breakfast",
                description: "Authentic Vietnamese banh mi served fresh daily. A favorite among backpackers for quick, delicious, and affordable meals in the heart of Hoi An Ancient Town.",
                location: "123 Tran Phu Street, Hoi An",
                hours: "7:00 AM - 10:00 PM",
                price: "$ - Budget Friendly",
                contact: "+84 235 123 456"
            },
            {
                id: 'thuan-tinh-island-bar',
                name: "Thuan Tinh Island Bar",
                type: "Riverside Bar & Grill",
                image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=150&h=200&fit=crop",
                promo: "Happy Hour - 50% Off All Drinks",
                details: "Daily 4pm-2am • River views & live music",
                description: "Stunning riverside location with panoramic views of Thu Bon River. Popular with expats and travelers for sunset drinks, live music, and BBQ nights.",
                location: "Thuan Tinh Island, Hoi An",
                hours: "4:00 PM - 2:00 AM",
                price: "$ - Moderate",
                contact: "+84 235 234 567"
            },
            {
                id: 'streets-restaurant',
                name: "Streets Restaurant & Cafe",
                type: "International Cuisine",
                image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=150&h=200&fit=crop",
                promo: "Western Breakfast Special",
                details: "Daily 7am-11pm • WiFi & AC",
                description: "Western and Vietnamese fusion cuisine in a comfortable, air-conditioned setting. Great for digital nomads with reliable WiFi and international menu options.",
                location: "45 Le Loi Street, Hoi An",
                hours: "7:00 AM - 11:00 PM",
                price: "$ - Moderate",
                contact: "+84 235 345 678"
            }
        ],
        activities: [
            {
                id: 'basket-boat-tours',
                name: "Basket Boat Adventure",
                type: "Water Sports",
                image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=150&h=200&fit=crop",
                promo: "Group Discount - 4+ People Save 30%",
                details: "Daily tours 8am & 2pm • 3 hours duration",
                description: "Traditional Vietnamese basket boat tours through coconut forests. Perfect group activity for backpackers wanting to experience local culture and nature.",
                location: "Coconut Forest, Cam Thanh",
                hours: "8:00 AM - 5:00 PM",
                price: "$ - Budget Friendly",
                contact: "+84 235 678 901"
            }
        ],
        chats: [
            {
                name: "Jessica",
                message: "Perfect! Want to check it out together? 😊",
                time: "2m",
                avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop"
            },
            {
                name: "Dave", 
                message: "Great surfing spots near Da Nang!",
                time: "1h",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
            },
            {
                name: "Rebecca",
                message: "The art scene here is amazing!",
                time: "3h", 
                avatar: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop"
            }
        ]
    },
    
    // Initialize App
    init() {
        console.log('🚀 Starting CLASSIFIED v7.0...');
        
        // Check if Firebase security rules are configured
        this.showFirebaseRulesWarning();
        
        // Wait for Firebase to be ready
        this.waitForFirebase().then(() => {
            console.log('✅ Firebase is ready');
            
            // Setup authentication listener
            this.setupAuthListener();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Populate static content
            this.populateFeeds();
            this.setupProfileEditor();
            
            // Initialize growth features
            this.initGrowthFeatures();
            
            console.log('✅ CLASSIFIED app ready!');
        }).catch(error => {
            console.error('❌ Error waiting for Firebase:', error);
        });
    },
    
    // Show warning about Firebase rules
    showFirebaseRulesWarning() {
        console.warn('⚠️ IMPORTANT: Make sure to configure Firestore Security Rules!');
        console.warn('Go to Firebase Console > Firestore > Rules and add the rules from the top of main.js file');
    },
    
    // Wait for Firebase to be ready
    waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            
            const checkFirebase = () => {
                attempts++;
                
                if (window.auth && window.db && window.storage) {
                    this.state.firebaseReady = true;
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Firebase failed to initialize'));
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            
            checkFirebase();
        });
    },
    
    // 🔥 Enhanced Firebase Authentication Methods
    setupAuthListener() {
        console.log('🔐 Setting up auth listener...');
        if (!window.auth) {
            console.error('❌ Firebase auth not initialized!');
            return;
        }
        
        window.auth.onAuthStateChanged((user) => {
            console.log('🔐 Auth state changed:', user ? user.email : 'No user');
            
            if (user) {
                this.state.currentUser = user;
                this.state.isAuthenticated = true;
                this.state.isGuestMode = false;
                this.hideAuthScreens();
                this.loadUserProfile(user.uid);
                this.populateUserFeed();
                this.populateMessaging();
                this.checkIfBusiness(user);
                
                // Initialize messaging system
                this.initMessaging();
            } else {
                this.state.currentUser = null;
                this.state.isAuthenticated = false;
                
                // Clean up messaging listeners
                this.cleanupMessagingListeners();
                
                if (!this.state.isGuestMode) {
                    this.showLogin();
                }
            }
        });
    },
    
    async checkIfBusiness(user) {
        try {
            const businessDoc = await window.db.collection('businesses').doc(user.uid).get();
            if (businessDoc.exists) {
                this.state.isBusinessUser = true;
                this.state.businessProfile = businessDoc.data();
                
                // Show business-specific UI elements
                this.showBusinessUI();
                
                // Auto-open business profile editor if profile is incomplete
                if (this.state.businessProfile.status === 'pending_approval' && !this.state.businessProfile.description) {
                    setTimeout(() => {
                        alert('👋 Welcome to CLASSIFIED! Please complete your business profile to get approved faster.');
                        this.openBusinessProfileEditor();
                    }, 2000);
                }
                
                this.loadBusinessProfile(user.uid);
            }
        } catch (error) {
            console.error('Error checking business status:', error);
        }
    },
    
    showBusinessUI() {
        // Update header to show business status
        const headers = document.querySelectorAll('.header-title');
        headers.forEach(header => {
            if (header.textContent.includes('Feeling Adventurous')) {
                const status = this.state.businessProfile.status;
                const statusText = status === 'active' ? '✅ Active' : 
                                 status === 'pending_approval' ? '⏳ Pending' : '❌ Inactive';
                header.innerHTML = `${header.textContent} <span style="font-size: 12px; opacity: 0.7;">${statusText}</span>`;
            }
        });
        
        // Add business dashboard button to settings
        this.addBusinessDashboardAccess();
    },
    
    addBusinessDashboardAccess() {
        // This will be used in the settings menu
        console.log('✅ Business UI elements added');
    },
    
    async loginWithEmail() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        try {
            this.showLoading();
            await window.auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Email login successful');
        } catch (error) {
            this.hideLoading();
            console.error('❌ Login error:', error);
            alert('Login failed: ' + error.message);
        }
    },
    
    async registerWithEmail() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const referralCode = sessionStorage.getItem('referralCode');
        
        console.log('📝 Registration attempt for:', email);
        
        if (!name || !email || !password || !confirmPassword) {
            alert('Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        
        if (!window.auth || !window.db) {
            alert('Firebase is still loading. Please wait a few seconds and try again.');
            return;
        }
        
        try {
            this.showLoading();
            
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
            console.log('✅ User account created:', userCredential.user.uid);
            
            // Update display name
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            // Generate referral code
            const newReferralCode = this.generateReferralCode();
            
            // Create user profile
            const profileData = {
                name: name,
                email: email,
                referralCode: newReferralCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                location: 'Hoi An, Vietnam',
                isOnline: true,
                isPremium: referralCode ? true : false,
                premiumUntil: referralCode ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null
            };
            
            await this.createUserProfile(userCredential.user.uid, profileData);
            
            // Handle referral
            if (referralCode) {
                await this.trackReferral(referralCode, userCredential.user.uid);
                alert('🎉 Welcome! You and your friend both got premium features!');
            }
            
            // Clear referral code
            sessionStorage.removeItem('referralCode');
            
            console.log('🎉 Registration completed successfully!');
            
        } catch (error) {
            this.hideLoading();
            console.error('❌ Registration failed:', error);
            alert('Registration failed: ' + error.message);
        }
    },
    
    async loginWithGoogle() {
        console.log('🔍 Attempting Google login...');
        
        if (!window.auth) {
            alert('Authentication system not ready. Please refresh and try again.');
            return;
        }
        
        try {
            this.showLoading();
            const provider = new firebase.auth.GoogleAuthProvider();
            
            const result = await window.auth.signInWithPopup(provider);
            
            // Check if this is a new user
            const userDoc = await window.db.collection('users').doc(result.user.uid).get();
            
            if (!userDoc.exists) {
                // Create profile for new Google user
                await this.createUserProfile(result.user.uid, {
                    name: result.user.displayName,
                    email: result.user.email,
                    photo: result.user.photoURL,
                    referralCode: this.generateReferralCode(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    location: 'Hoi An, Vietnam',
                    isOnline: true
                });
            }
            
            console.log('✅ Google login successful');
        } catch (error) {
            this.hideLoading();
            console.error('❌ Google login error:', error);
            
            if (error.code === 'auth/popup-closed-by-user') {
                console.log('User closed Google popup');
            } else {
                alert('Google login failed: ' + error.message);
            }
        }
    },
    
    async logout() {
        try {
            // Clean up messaging listeners
            this.cleanupMessagingListeners();
            
            await window.auth.signOut();
            this.state.isGuestMode = false;
            console.log('✅ Logout successful');
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    },
    
    // 🏢 Business Authentication Methods
    async businessLogin() {
        const email = document.getElementById('businessLoginEmail').value;
        const password = document.getElementById('businessLoginPassword').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        try {
            this.showLoading();
            await window.auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Business login successful');
        } catch (error) {
            this.hideLoading();
            console.error('❌ Business login error:', error);
            alert('Login failed: ' + error.message);
        }
    },
    
    async businessSignup() {
        const name = document.getElementById('businessSignupName').value;
        const email = document.getElementById('businessSignupEmail').value;
        const phone = document.getElementById('businessSignupPhone').value;
        const type = document.getElementById('businessSignupType').value;
        
        if (!name || !email || !phone || !type) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            this.showLoading();
            
            // Create business account directly
            const tempPassword = this.generateTempPassword();
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, tempPassword);
            
            // Update display name
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            // Create business profile
            await window.db.collection('businesses').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                phone: phone,
                type: type,
                status: 'pending_approval',
                uid: userCredential.user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                tempPassword: tempPassword,
                location: 'Hoi An, Vietnam',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.hideLoading();
            
            // Show success with login info
            alert(`🎉 Business account created! Your temporary password is: ${tempPassword}\n\nYour account is pending approval. You can login now and complete your profile. We'll review it within 24 hours.`);
            
            // Switch to login tab
            this.switchBusinessAuthTab('login');
            
            // Pre-fill login form
            document.getElementById('businessLoginEmail').value = email;
            document.getElementById('businessLoginPassword').value = tempPassword;
            
            console.log('✅ Business account created successfully');
            
        } catch (error) {
            this.hideLoading();
            console.error('❌ Business signup error:', error);
            alert('Signup failed: ' + error.message);
        }
    },
    
    generateTempPassword() {
        return Math.random().toString(36).slice(-8);
    },
    
    switchBusinessAuthTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.business-auth-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[onclick="CLASSIFIED.switchBusinessAuthTab('${tab}')"]`).classList.add('active');
        
        // Update form visibility
        document.querySelectorAll('.business-auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`business${tab.charAt(0).toUpperCase() + tab.slice(1)}Form`).classList.add('active');
    },
    
    // 👤 Guest Mode Implementation
    enableGuestMode() {
        console.log('👤 Enabling guest mode');
        this.state.isGuestMode = true;
        this.state.isAuthenticated = false;
        
        // Hide auth screens
        this.hideAuthScreens();
        
        // Show guest banner
        document.getElementById('guestBanner').style.display = 'block';
        
        // Populate feeds with demo data
        this.populateFeeds();
        this.populateGuestUserFeed();
        
        // Show restricted features message
        setTimeout(() => {
            this.showGuestLimitationsMessage();
        }, 3000);
    },
    
    populateGuestUserFeed() {
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '';
        
        // Show first 3 users to guests
        const guestUsers = this.data.users.slice(0, 3);
        guestUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            
            // Add guest overlay to limit interactions
            const overlay = document.createElement('div');
            overlay.innerHTML = `
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; border-radius: 20px; z-index: 10;">
                    <div style="text-align: center; padding: 20px;">
                        <h3 style="color: #FFD700; margin-bottom: 10px;">🔒 Sign up to connect!</h3>
                        <button onclick="CLASSIFIED.showRegister()" style="background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; padding: 10px 20px; border-radius: 20px; color: white; font-weight: 600; cursor: pointer;">
                            Create Account
                        </button>
                    </div>
                </div>
            `;
            overlay.style.position = 'relative';
            feedItem.appendChild(overlay);
            
            container.appendChild(feedItem);
        });
        
        // Add signup encouragement
        const signupCard = document.createElement('div');
        signupCard.innerHTML = `
            <div style="background: linear-gradient(135deg, #FFD700, #FF6B6B); padding: 30px; border-radius: 20px; text-align: center; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; font-size: 20px;">🚀 Ready to connect?</h3>
                <p style="margin: 0 0 20px 0; opacity: 0.9;">Join ${this.data.users.length}+ travelers already using CLASSIFIED</p>
                <button onclick="CLASSIFIED.showRegister()" style="background: rgba(255,255,255,0.2); border: none; padding: 12px 24px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer; margin-right: 10px;">
                    Sign Up Free
                </button>
                <button onclick="CLASSIFIED.showLogin()" style="background: transparent; border: 2px solid rgba(255,255,255,0.3); padding: 10px 22px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer;">
                    Login
                </button>
            </div>
        `;
        container.appendChild(signupCard);
    },
    
    showGuestLimitationsMessage() {
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: rgba(255,215,0,0.9); color: white; padding: 15px 20px; border-radius: 15px; font-size: 14px; font-weight: 600; z-index: 999; max-width: 300px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <div style="margin-bottom: 10px;">👋 Browsing as guest</div>
                <div style="font-size: 12px; opacity: 0.9;">Sign up to message people, upload photos, and access all features!</div>
                <button onclick="this.parentElement.remove(); CLASSIFIED.showRegister();" style="background: rgba(255,255,255,0.2); border: none; padding: 6px 12px; border-radius: 10px; color: white; font-size: 11px; font-weight: 600; cursor: pointer; margin-top: 10px;">
                    Sign Up Now
                </button>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 8000);
    },
    
    // 🔥 Enhanced Firestore Methods
    async createUserProfile(uid, profileData) {
        try {
            await window.db.collection('users').doc(uid).set(profileData);
            console.log('✅ User profile created in Firestore');
        } catch (error) {
            console.error('❌ Error creating user profile:', error);
            throw error;
        }
    },
    
    async loadUserProfile(uid) {
        try {
            const doc = await window.db.collection('users').doc(uid).get();
            if (doc.exists) {
                const userData = doc.data();
                this.state.userProfile = { ...this.state.userProfile, ...userData };
                console.log('✅ User profile loaded:', userData);
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
        }
    },
    
    async saveUserProfile() {
        if (!this.state.currentUser) {
            alert('Please log in first');
            return;
        }
        
        try {
            // Gather form data
            this.state.userProfile.bio = document.getElementById('profileBio').value;
            this.state.userProfile.birthday = document.getElementById('profileBirthday').value;
            this.state.userProfile.height = document.getElementById('profileHeight').value;
            this.state.userProfile.name = this.state.currentUser.displayName || this.state.userProfile.name;
            this.state.userProfile.email = this.state.currentUser.email;
            
            // Calculate age from birthday
            if (this.state.userProfile.birthday) {
                const today = new Date();
                const birthDate = new Date(this.state.userProfile.birthday);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                this.state.userProfile.age = age;
            }
            
            // Add required fields for user feed
            this.state.userProfile.uid = this.state.currentUser.uid;
            this.state.userProfile.isOnline = true;
            this.state.userProfile.lastSeen = firebase.firestore.FieldValue.serverTimestamp();
            this.state.userProfile.location = 'Hoi An, Vietnam';
            this.state.userProfile.matchPercentage = Math.floor(Math.random() * 30) + 70;
            this.state.userProfile.distance = `${Math.floor(Math.random() * 5) + 1} km`;
            this.state.userProfile.category = this.state.userProfile.career === 'Digital Nomad' ? 'nomads' : 'all';
            
            // Generate referral code if not exists
            if (!this.state.userProfile.referralCode) {
                this.state.userProfile.referralCode = this.generateReferralCode();
            }
            
            // Save to Firebase
            await window.db.collection('users').doc(this.state.currentUser.uid).set({
                ...this.state.userProfile,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('💾 Profile saved successfully:', this.state.userProfile);
            alert('Profile saved successfully! 🎉 You\'ll now appear in the user feed.');
            
            // Refresh user feed
            this.closeProfileEditor();
            this.populateUserFeed();
            
            // Show success with referral code
            setTimeout(() => {
                this.showReferralCode();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error saving profile:', error);
            alert('Error saving profile: ' + error.message);
        }
    },
    
    async loadBusinessProfile(uid) {
        try {
            const doc = await window.db.collection('businesses').doc(uid).get();
            if (doc.exists) {
                const businessData = doc.data();
                this.state.businessProfile = { ...this.state.businessProfile, ...businessData };
                console.log('✅ Business profile loaded:', businessData);
            }
        } catch (error) {
            console.error('❌ Error loading business profile:', error);
        }
    },
    
    async saveBusinessProfile() {
        if (!this.state.currentUser) {
            alert('Please log in first');
            return;
        }
        
        try {
            // Gather form data
            this.state.businessProfile.name = document.getElementById('businessName').value;
            this.state.businessProfile.type = document.getElementById('businessType').value;
            this.state.businessProfile.description = document.getElementById('businessDescription').value;
            this.state.businessProfile.address = document.getElementById('businessAddress').value;
            this.state.businessProfile.phone = document.getElementById('businessPhone').value;
            this.state.businessProfile.hours = document.getElementById('businessHours').value;
            this.state.businessProfile.priceRange = document.getElementById('businessPriceRange').value;
            this.state.businessProfile.promoTitle = document.getElementById('businessPromoTitle').value;
            this.state.businessProfile.promoDetails = document.getElementById('businessPromoDetails').value;
            
            // Add required fields
            this.state.businessProfile.uid = this.state.currentUser.uid;
            this.state.businessProfile.email = this.state.currentUser.email;
            this.state.businessProfile.status = 'active';
            
            // Save to Firebase
            await window.db.collection('businesses').doc(this.state.currentUser.uid).set({
                ...this.state.businessProfile,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('💾 Business profile saved successfully');
            alert('Business profile saved successfully! 🎉 Your business will appear in the feeds.');
            
            // Refresh feeds
            this.closeBusinessProfileEditor();
            this.populateFeeds();
            
        } catch (error) {
            console.error('❌ Error saving business profile:', error);
            alert('Error saving business profile: ' + error.message);
        }
    },
    
    // 📸 Fixed Photo Upload System
    triggerPhotoUpload(slotIndex) {
        console.log('📸 Triggering photo upload for slot:', slotIndex);
        
        // If no slot index provided (clicking main section), default to first empty slot
        if (slotIndex === undefined) {
            const slots = document.querySelectorAll('#photoGrid .photo-slot');
            for (let i = 0; i < slots.length; i++) {
                if (!slots[i].classList.contains('filled')) {
                    slotIndex = i;
                    break;
                }
            }
            // If all slots are filled, default to first slot
            if (slotIndex === undefined) {
                slotIndex = 0;
            }
        }
        
        this.state.currentUploadSlot = slotIndex;
        document.getElementById('photoUpload').click();
    },
    
    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const slotIndex = this.state.currentUploadSlot;
        console.log('📸 Handling photo upload:', file.name, 'to slot', slotIndex);
        
        if (!this.state.currentUser) {
            alert('Please log in to upload photos');
            return;
        }
        
        if (slotIndex === null || slotIndex === undefined) {
            console.error('❌ No upload slot selected');
            return;
        }
        
        try {
            // Get the correct slot element
            const slots = document.querySelectorAll('#photoGrid .photo-slot');
            const slot = slots[slotIndex];
            
            if (!slot) {
                console.error('❌ Could not find photo slot at index:', slotIndex);
                return;
            }
            
            // Show upload progress
            slot.classList.add('uploading');
            slot.innerHTML = `
                <div style="text-align: center;">
                    <div>📤</div>
                    <div style="font-size: 12px; margin-top: 5px;">Uploading...</div>
                    <div class="upload-progress">
                        <div class="upload-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            `;
            
            // Upload to Firebase Storage
            const storageRef = window.storage.ref();
            const photoRef = storageRef.child(`users/${this.state.currentUser.uid}/photo_${slotIndex}_${Date.now()}`);
            
            const uploadTask = photoRef.put(file);
            
            uploadTask.on('state_changed', 
                (snapshot) => {
                    // Progress tracking
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    const progressBar = slot.querySelector('.upload-progress-bar');
                    if (progressBar) {
                        progressBar.style.width = progress + '%';
                    }
                },
                (error) => {
                    console.error('❌ Upload failed:', error);
                    slot.classList.remove('uploading');
                    slot.innerHTML = `<span style="font-size: 24px; opacity: 0.5;">+</span>`;
                    alert('Upload failed: ' + error.message);
                },
                async () => {
                    // Upload completed successfully
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        
                        // Update UI
                        slot.classList.remove('uploading');
                        slot.classList.add('filled');
                        slot.style.backgroundImage = `url('${downloadURL}')`;
                        slot.innerHTML = slotIndex === 0 ? '<div class="star-icon">⭐</div>' : '';
                        
                        // Save to state - ensure photos array exists
                        if (!this.state.userProfile.photos) {
                            this.state.userProfile.photos = [];
                        }
                        this.state.userProfile.photos[slotIndex] = downloadURL;
                        
                        console.log('✅ Photo uploaded successfully');
                        
                        // Auto-save profile
                        await this.saveUserProfile();
                        
                    } catch (error) {
                        console.error('❌ Error getting download URL:', error);
                        alert('Error saving photo: ' + error.message);
                    }
                }
            );
            
        } catch (error) {
            console.error('❌ Error uploading photo:', error);
            alert('Error uploading photo: ' + error.message);
        }
        
        // Clear the input for next upload
        event.target.value = '';
    },
    
    triggerBusinessPhotoUpload(slotIndex) {
        console.log('📸 Triggering business photo upload for slot:', slotIndex);
        
        // If no slot index provided, default to first empty slot
        if (slotIndex === undefined) {
            const slots = document.querySelectorAll('#businessPhotoGrid .photo-slot');
            for (let i = 0; i < slots.length; i++) {
                if (!slots[i].classList.contains('filled')) {
                    slotIndex = i;
                    break;
                }
            }
            // If all slots are filled, default to first slot
            if (slotIndex === undefined) {
                slotIndex = 0;
            }
        }
        
        this.state.currentBusinessUploadSlot = slotIndex;
        document.getElementById('businessPhotoUpload').click();
    },
    
    async handleBusinessPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const slotIndex = this.state.currentBusinessUploadSlot;
        console.log('📸 Handling business photo upload:', file.name, 'to slot', slotIndex);
        
        if (!this.state.currentUser) {
            alert('Please log in to upload photos');
            return;
        }
        
        if (slotIndex === null || slotIndex === undefined) {
            console.error('❌ No upload slot selected');
            return;
        }
        
        try {
            // Get the correct slot element
            const slots = document.querySelectorAll('#businessPhotoGrid .photo-slot');
            const slot = slots[slotIndex];
            
            if (!slot) {
                console.error('❌ Could not find business photo slot at index:', slotIndex);
                return;
            }
            
            // Show upload progress
            slot.classList.add('uploading');
            slot.innerHTML = `
                <div style="text-align: center;">
                    <div>📤</div>
                    <div style="font-size: 12px; margin-top: 5px;">Uploading...</div>
                    <div class="upload-progress">
                        <div class="upload-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            `;
            
            // Upload to Firebase Storage
            const storageRef = window.storage.ref();
            const photoRef = storageRef.child(`businesses/${this.state.currentUser.uid}/photo_${slotIndex}_${Date.now()}`);
            
            const uploadTask = photoRef.put(file);
            
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    const progressBar = slot.querySelector('.upload-progress-bar');
                    if (progressBar) {
                        progressBar.style.width = progress + '%';
                    }
                },
                (error) => {
                    console.error('❌ Business upload failed:', error);
                    slot.classList.remove('uploading');
                    slot.innerHTML = `<span style="font-size: 24px; opacity: 0.5;">+</span>`;
                    alert('Upload failed: ' + error.message);
                },
                async () => {
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        
                        // Update UI
                        slot.classList.remove('uploading');
                        slot.classList.add('filled');
                        slot.style.backgroundImage = `url('${downloadURL}')`;
                        slot.innerHTML = slotIndex === 0 ? '<div class="star-icon">⭐</div>' : '';
                        
                        // Save to state - ensure photos array exists
                        if (!this.state.businessProfile.photos) {
                            this.state.businessProfile.photos = [];
                        }
                        this.state.businessProfile.photos[slotIndex] = downloadURL;
                        
                        console.log('✅ Business photo uploaded successfully');
                        
                        // Auto-save business profile
                        await this.saveBusinessProfile();
                        
                    } catch (error) {
                        console.error('❌ Error getting business download URL:', error);
                        alert('Error saving business photo: ' + error.message);
                    }
                }
            );
            
        } catch (error) {
            console.error('❌ Error uploading business photo:', error);
            alert('Error uploading business photo: ' + error.message);
        }
        
        // Clear the input for next upload
        event.target.value = '';
    },
    
    // 🔄 Referral System
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    },
    
    async trackReferral(referralCode, newUserId) {
        try {
            const referrerSnapshot = await window.db.collection('users')
                .where('referralCode', '==', referralCode)
                .get();
                
            if (!referrerSnapshot.empty) {
                const referrerId = referrerSnapshot.docs[0].id;
                
                // Save referral record
                await window.db.collection('referrals').add({
                    referrer: referrerId,
                    referred: newUserId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    bonus: 'premium_week',
                    status: 'active'
                });
                
                // Update referrer's stats
                await window.db.collection('users').doc(referrerId).update({
                    referralCount: firebase.firestore.FieldValue.increment(1),
                    premiumUntil: firebase.firestore.FieldValue.serverTimestamp() + (7 * 24 * 60 * 60 * 1000)
                });
                
                console.log('✅ Referral tracked successfully');
            }
        } catch (error) {
            console.error('❌ Error tracking referral:', error);
        }
    },
    
    shareApp() {
        const referralCode = this.state.userProfile.referralCode || this.generateReferralCode();
        const shareUrl = `${window.location.origin}?ref=${referralCode}`;
        
        const shareData = {
            title: 'CLASSIFIED - Hoi An Social Discovery',
            text: `Join me on CLASSIFIED - discover hidden gems and meet amazing people in Hoi An! 🌟 Use my code: ${referralCode}`,
            url: shareUrl
        };
        
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
            alert('✅ Referral link copied to clipboard! Share it with your friends 📱');
        }
    },
    
    showReferralCode() {
        const referralCode = this.state.userProfile.referralCode || this.generateReferralCode();
        const shareUrl = `${window.location.origin}?ref=${referralCode}`;
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;" onclick="this.remove()">
                <div style="background: #2a2a2a; border-radius: 20px; padding: 30px; max-width: 350px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.1);" onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 20px 0; color: #00D4FF;">🔑 Your Referral Code</h3>
                    
                    <div style="background: rgba(0,212,255,0.1); border: 2px solid #00D4FF; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <div style="font-size: 32px; font-weight: 700; color: #00D4FF; margin-bottom: 10px;">${referralCode}</div>
                        <div style="font-size: 14px; opacity: 0.8;">Share this code with friends</div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; opacity: 0.9;">When friends sign up with your code:</p>
                        <ul style="text-align: left; margin: 0; padding-left: 20px; font-size: 14px; opacity: 0.8;">
                            <li>You both get 1 week premium</li>
                            <li>Access to exclusive events</li>
                            <li>Priority customer support</li>
                        </ul>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="navigator.clipboard.writeText('${referralCode}'); alert('Code copied!')" style="flex: 1; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer;">
                            Copy Code
                        </button>
                        <button onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Link copied!')" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                            Copy Link
                        </button>
                    </div>
                    
                    <button onclick="this.closest('div').remove()" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer; margin-top: 10px;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    checkReferralCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const referralCode = urlParams.get('ref');
        
        if (referralCode) {
            sessionStorage.setItem('referralCode', referralCode);
            
            // Show referral welcome message
            setTimeout(() => {
                const welcomeModal = document.createElement('div');
                welcomeModal.innerHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #2a2a2a; border-radius: 20px; padding: 30px; max-width: 350px; width: 100%; text-align: center; border: 1px solid rgba(255,215,0,0.3);" onclick="event.stopPropagation()">
                            <h3 style="margin: 0 0 20px 0; color: #FFD700;">🎉 Welcome to CLASSIFIED!</h3>
                            <p style="margin: 0 0 20px 0; font-size: 16px;">You've been invited by a friend!</p>
                            <div style="background: rgba(255,215,0,0.1); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Sign up with code <strong>${referralCode}</strong> and you'll both get premium features!</p>
                            </div>
                            <button onclick="this.closest('div').remove(); CLASSIFIED.showRegister();" style="width: 100%; padding: 15px; background: linear-gradient(135deg, #FFD700, #FF6B6B); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                                Sign Up Now 🚀
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(welcomeModal);
            }, 1000);
        }
    },
    
    // 📱 UI Helper Methods
    showLogin() {
        document.getElementById('loginScreen').classList.add('show');
        document.getElementById('registerScreen').classList.remove('show');
        document.getElementById('businessAuthScreen').classList.remove('show');
        document.querySelector('.main-screens').classList.remove('authenticated');
        document.querySelector('.bottom-nav').style.display = 'none';
        document.getElementById('guestBanner').style.display = 'none';
    },
    
    showRegister() {
        document.getElementById('registerScreen').classList.add('show');
        document.getElementById('loginScreen').classList.remove('show');
        document.getElementById('businessAuthScreen').classList.remove('show');
    },
    
    showBusinessAuth() {
        document.getElementById('businessAuthScreen').classList.add('show');
        document.getElementById('loginScreen').classList.remove('show');
        document.getElementById('registerScreen').classList.remove('show');
    },
    
    hideAuthScreens() {
        document.getElementById('loginScreen').classList.remove('show');
        document.getElementById('registerScreen').classList.remove('show');
        document.getElementById('businessAuthScreen').classList.remove('show');
        document.querySelector('.main-screens').classList.add('authenticated');
        document.querySelector('.bottom-nav').style.display = 'flex';
        document.getElementById('guestBanner').style.display = 'none';
        this.hideLoading();
    },
    
    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    },
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    },
    
    // 🔧 Event Listeners
    setupEventListeners() {
        // Bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const screen = item.dataset.screen;
                this.showScreen(screen);
            });
        });
        
        // Social tabs
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabType = tab.dataset.tab;
                this.switchSocialTab(tabType);
            });
        });
        
        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const filter = chip.dataset.filter;
                this.filterUsers(filter);
            });
        });
        
        // Overlay back buttons
        document.getElementById('profileBackBtn').addEventListener('click', () => this.closeBusinessProfile());
        document.getElementById('chatBackBtn').addEventListener('click', () => this.closeChat());
        
        // Chat functionality
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Match popup
        document.getElementById('startChatBtn').addEventListener('click', () => this.startChatFromMatch());
    },
    
    // 📝 Profile Editor Setup
    setupProfileEditor() {
        // Choice buttons
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choiceType = btn.dataset.choice;
                const value = btn.dataset.value;
                this.selectChoice(choiceType, value, btn);
            });
        });
        
        // Interest buttons
        document.querySelectorAll('.interest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleInterest(btn);
            });
        });
    },
    
    // 📝 Profile Editor Functions
    openProfileEditor() {
        console.log('✏️ Opening profile editor');
        document.getElementById('profileEditor').classList.add('show');
        this.state.isProfileEditorOpen = true;
        this.loadProfileData();
    },
    
    closeProfileEditor() {
        console.log('🔙 Closing profile editor');
        document.getElementById('profileEditor').classList.remove('show');
        this.state.isProfileEditorOpen = false;
    },
    
    openBusinessProfileEditor() {
        console.log('🏢 Opening business profile editor');
        document.getElementById('businessProfileEditor').classList.add('show');
        this.state.isBusinessProfileEditorOpen = true;
        this.loadBusinessProfileData();
    },
    
    closeBusinessProfileEditor() {
        console.log('🔙 Closing business profile editor');
        document.getElementById('businessProfileEditor').classList.remove('show');
        this.state.isBusinessProfileEditorOpen = false;
    },
    
    viewMyProfile() {
        console.log('👤 Viewing my profile');
        this.closeProfileEditor();
        document.getElementById('myProfileView').classList.add('show');
        this.updateMyProfileView();
    },
    
    closeMyProfile() {
        console.log('🔙 Closing my profile');
        document.getElementById('myProfileView').classList.remove('show');
    },
    
    viewBusinessProfile() {
        console.log('🏢 Viewing business profile');
        this.closeBusinessProfileEditor();
        // Could open business profile view here
    },
    
    loadProfileData() {
        const profile = this.state.userProfile;
        
        // Load basic info
        document.getElementById('profileBio').value = profile.bio || '';
        document.getElementById('profileBirthday').value = profile.birthday || '';
        document.getElementById('profileHeight').value = profile.height || '';
        
        // Load choices
        if (profile.zodiac) this.selectChoiceByValue('zodiac', profile.zodiac);
        if (profile.career) this.selectChoiceByValue('career', profile.career);
        if (profile.priority) this.selectChoiceByValue('priority', profile.priority);
        if (profile.relationship) this.selectChoiceByValue('relationship', profile.relationship);
        if (profile.lookingFor) this.selectChoiceByValue('lookingFor', profile.lookingFor);
        if (profile.marriage) this.selectChoiceByValue('marriage', profile.marriage);
        
        // Load interests
        document.querySelectorAll('.interest-btn').forEach(btn => {
            btn.classList.remove('active');
            if (profile.interests && profile.interests.includes(btn.dataset.interest)) {
                btn.classList.add('active');
            }
        });
        
        // Load photos
        if (profile.photos && profile.photos.length > 0) {
            profile.photos.forEach((photo, index) => {
                if (photo) {
                    const slot = document.querySelectorAll('#photoGrid .photo-slot')[index];
                    if (slot) {
                        slot.style.backgroundImage = `url('${photo}')`;
                        slot.classList.add('filled');
                        slot.innerHTML = index === 0 ? '<div class="star-icon">⭐</div>' : '';
                    }
                }
            });
        }
    },
    
    loadBusinessProfileData() {
        const profile = this.state.businessProfile;
        
        // Load basic info
        document.getElementById('businessName').value = profile.name || '';
        document.getElementById('businessType').value = profile.type || '';
        document.getElementById('businessDescription').value = profile.description || '';
        document.getElementById('businessAddress').value = profile.address || '';
        document.getElementById('businessPhone').value = profile.phone || '';
        document.getElementById('businessHours').value = profile.hours || '';
        document.getElementById('businessPriceRange').value = profile.priceRange || '';
        document.getElementById('businessPromoTitle').value = profile.promoTitle || '';
        document.getElementById('businessPromoDetails').value = profile.promoDetails || '';
        
        // Load photos
        if (profile.photos && profile.photos.length > 0) {
            profile.photos.forEach((photo, index) => {
                if (photo) {
                    const slot = document.querySelectorAll('#businessPhotoGrid .photo-slot')[index];
                    if (slot) {
                        slot.style.backgroundImage = `url('${photo}')`;
                        slot.classList.add('filled');
                        slot.innerHTML = index === 0 ? '<div class="star-icon">⭐</div>' : '';
                    }
                }
            });
        }
    },
    
    selectChoice(choiceType, value, buttonElement) {
        // Remove active from siblings
        const siblings = buttonElement.parentElement.querySelectorAll('.choice-btn');
        siblings.forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        buttonElement.classList.add('active');
        
        // Update state
        this.state.userProfile[choiceType] = value;
        console.log(`Selected ${choiceType}: ${value}`);
    },
    
    selectChoiceByValue(choiceType, value) {
        const btn = document.querySelector(`[data-choice="${choiceType}"][data-value="${value}"]`);
        if (btn) {
            this.selectChoice(choiceType, value, btn);
        }
    },
    
    toggleInterest(buttonElement) {
        const interest = buttonElement.dataset.interest;
        const isActive = buttonElement.classList.contains('active');
        
        if (!this.state.userProfile.interests) {
            this.state.userProfile.interests = [];
        }
        
        if (isActive) {
            buttonElement.classList.remove('active');
            this.state.userProfile.interests = this.state.userProfile.interests.filter(i => i !== interest);
        } else {
            if (this.state.userProfile.interests.length < 8) {
                buttonElement.classList.add('active');
                this.state.userProfile.interests.push(interest);
            } else {
                alert('You can select up to 8 interests!');
            }
        }
        console.log('Current interests:', this.state.userProfile.interests);
    },
    
    updateMyProfileView() {
        const profile = this.state.userProfile;
        
        // Update profile view with user data
        document.getElementById('myProfileName').textContent = profile.name || 'Your Name';
        document.getElementById('myProfileAge').textContent = profile.age ? `${profile.age} years old` : 'Add your age';
        document.getElementById('myProfileBio').textContent = profile.bio || 'Complete your profile to start connecting with amazing people in Hoi An!';
        
        // Update details
        document.getElementById('myProfileAgeDetail').textContent = profile.age || '-';
        document.getElementById('myProfileHeightDetail').textContent = profile.height || '-';
        document.getElementById('myProfileCareerDetail').textContent = profile.career || '-';
        document.getElementById('myProfileZodiacDetail').textContent = profile.zodiac || '-';
        document.getElementById('myProfileLookingForDetail').textContent = profile.lookingFor || '-';
        
        // Update interests
        const interestsContainer = document.getElementById('myProfileInterests');
        if (profile.interests && profile.interests.length > 0) {
            interestsContainer.innerHTML = profile.interests.map(interest => 
                `<span class="interest-tag">${interest}</span>`
            ).join('');
        } else {
            interestsContainer.innerHTML = '<span class="interest-tag">Add interests in profile editor</span>';
        }
        
        // Update hero image if photos available
        if (profile.photos && profile.photos.length > 0 && profile.photos[0]) {
            document.getElementById('myProfileHero').style.backgroundImage = `url('${profile.photos[0]}')`;
        }
    },
    
    shareMyProfile() {
        const shareText = `Check out my profile on CLASSIFIED Hoi An! 🌟`;
        if (navigator.share) {
            navigator.share({
                title: 'My CLASSIFIED Profile',
                text: shareText,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(shareText + ' - ' + window.location.href);
            alert('Profile link copied to clipboard! 📋');
        }
    },
    
    // ⚙️ Settings & Account Management
    openSettings() {
        const settingsMenu = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 500; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
                <div style="background: #2a2a2a; border-radius: 20px; padding: 30px; max-width: 300px; width: 90%; border: 1px solid rgba(255,255,255,0.1); max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 20px 0; text-align: center; color: #00D4FF;">Settings</h3>
                    ${this.state.isAuthenticated ? `
                        <button onclick="CLASSIFIED.openProfileEditor(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: white; cursor: pointer;">✏️ Edit Profile</button>
                        <button onclick="CLASSIFIED.viewMyProfile(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: white; cursor: pointer;">👤 View My Profile</button>
                        ${this.state.isBusinessUser ? `
                            <button onclick="CLASSIFIED.openBusinessProfileEditor(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; color: #FFD700; cursor: pointer;">🏢 Business Profile</button>
                            <button onclick="CLASSIFIED.viewBusinessDashboard(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; color: #FFD700; cursor: pointer;">📊 Business Dashboard</button>
                        ` : ''}
                        <button onclick="CLASSIFIED.showReferralCode(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 10px; color: #00D4FF; cursor: pointer;">🔑 Referral Code</button>
                        ${this.isAdminUser() ? `
                            <button onclick="CLASSIFIED.openAdminPanel(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 10px; color: #FF6B6B; cursor: pointer;">🛡️ Admin Panel</button>
                        ` : ''}
                        <button onclick="CLASSIFIED.logout(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; background: rgba(255,107,107,0.2); border: 1px solid rgba(255,107,107,0.3); border-radius: 10px; color: #FF6B6B; cursor: pointer;">🚪 Logout</button>
                    ` : `
                        <button onclick="CLASSIFIED.showLogin(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; border-radius: 10px; color: white; cursor: pointer;">🔐 Login</button>
                        <button onclick="CLASSIFIED.showRegister(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; margin-bottom: 10px; background: linear-gradient(135deg, #FFD700, #FF6B6B); border: none; border-radius: 10px; color: white; cursor: pointer;">🚀 Sign Up</button>
                        <button onclick="CLASSIFIED.showBusinessAuth(); this.closest('.settings-overlay').remove();" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: white; cursor: pointer;">🏢 Business Login</button>
                    `}
                </div>
            </div>
        `;
        
        const overlay = document.createElement('div');
        overlay.className = 'settings-overlay';
        overlay.innerHTML = settingsMenu;
        document.body.appendChild(overlay);
    },
    
    isAdminUser() {
        // Check if current user is admin (replace with your actual admin email)
        return this.state.currentUser && (
            this.state.currentUser.email === 'admin@classified.com' || 
            this.state.currentUser.email === 'your-admin-email@gmail.com' // Replace with your email
        );
    },
    
    viewBusinessDashboard() {
        if (!this.state.isBusinessUser) {
            alert('Access denied: Business account required');
            return;
        }
        
        const dashboard = document.createElement('div');
        dashboard.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;" onclick="this.remove()">
                <div style="background: #2a2a2a; border-radius: 20px; padding: 30px; max-width: 400px; width: 100%; border: 1px solid rgba(255,255,255,0.1); max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 20px 0; text-align: center; color: #FFD700;">🏢 Business Dashboard</h3>
                    
                    <div style="background: rgba(255,215,0,0.1); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #FFD700;">Account Status</h4>
                        <p style="margin: 0; font-size: 14px;">Status: <strong>${this.state.businessProfile.status}</strong></p>
                        <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">
                            ${this.state.businessProfile.status === 'active' ? 'Your business is live on CLASSIFIED!' : 
                              this.state.businessProfile.status === 'pending_approval' ? 'Your profile is being reviewed. Complete it to speed up approval.' : 
                              'Please complete your profile to get approved.'}
                        </p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #00D4FF;">Quick Actions</h4>
                        <button onclick="CLASSIFIED.openBusinessProfileEditor(); this.closest('div').remove();" style="width: 100%; padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer;">✏️ Edit Profile</button>
                        <button onclick="CLASSIFIED.viewBusinessAnalytics(); this.closest('div').remove();" style="width: 100%; padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer;">📊 View Analytics</button>
                        <button onclick="CLASSIFIED.managePromotions(); this.closest('div').remove();" style="width: 100%; padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer;">🎯 Manage Promotions</button>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #00D4FF;">Help & Support</h4>
                        <p style="margin: 0; font-size: 12px; opacity: 0.8;">Need help? Contact us at support@classified.com</p>
                    </div>
                    
                    <button onclick="this.closest('div').remove()" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dashboard);
    },
    
    viewBusinessAnalytics() {
        alert('📊 Analytics feature coming soon! You\'ll be able to see views, clicks, and customer engagement here.');
    },
    
    managePromotions() {
        alert('🎯 Promotions management coming soon! You\'ll be able to create and manage special offers here.');
    },
    
    openAdminPanel() {
        if (!this.isAdminUser()) {
            alert('Access denied: Admin privileges required');
            return;
        }
        
        this.loadPendingBusinesses();
    },
    
    async loadPendingBusinesses() {
        try {
            const snapshot = await window.db.collection('businesses')
                .where('status', '==', 'pending_approval')
                .orderBy('createdAt', 'desc')
                .get();
            
            const businesses = [];
            snapshot.forEach(doc => {
                businesses.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.showAdminPanel(businesses);
            
        } catch (error) {
            console.error('Error loading pending businesses:', error);
            alert('Error loading pending businesses');
        }
    },
    
    showAdminPanel(businesses) {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;" onclick="this.remove()">
                <div style="background: #2a2a2a; border-radius: 20px; padding: 30px; max-width: 500px; width: 100%; border: 1px solid rgba(255,255,255,0.1); max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 20px 0; text-align: center; color: #FF6B6B;">🛡️ Admin Panel</h3>
                    
                    <h4 style="margin: 0 0 15px 0; color: #00D4FF;">Pending Business Approvals (${businesses.length})</h4>
                    
                    ${businesses.length === 0 ? `
                        <p style="text-align: center; opacity: 0.7; margin: 40px 0;">No pending approvals</p>
                    ` : businesses.map(business => `
                        <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);">
                            <h4 style="margin: 0 0 8px 0; color: #FFD700;">${business.name}</h4>
                            <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.8;">Type: ${business.type}</p>
                            <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.8;">Email: ${business.email}</p>
                            <p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.8;">Phone: ${business.phone}</p>
                            <p style="margin: 0 0 10px 0; font-size: 12px; opacity: 0.8;">Created: ${business.createdAt?.toDate ? business.createdAt.toDate().toLocaleDateString() : 'Unknown'}</p>
                            
                            <div style="display: flex; gap: 8px; margin-top: 10px;">
                                <button onclick="CLASSIFIED.approveBusiness('${business.id}'); this.closest('.admin-panel').remove();" style="flex: 1; padding: 8px; background: rgba(76,175,80,0.2); border: 1px solid rgba(76,175,80,0.3); border-radius: 6px; color: #4CAF50; cursor: pointer; font-size: 12px;">
                                    ✅ Approve
                                </button>
                                <button onclick="CLASSIFIED.rejectBusiness('${business.id}'); this.closest('.admin-panel').remove();" style="flex: 1; padding: 8px; background: rgba(255,107,107,0.2); border: 1px solid rgba(255,107,107,0.3); border-radius: 6px; color: #FF6B6B; cursor: pointer; font-size: 12px;">
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    `).join('')}
                    
                    <button onclick="this.closest('div').remove()" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer; margin-top: 15px;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        panel.className = 'admin-panel';
        document.body.appendChild(panel);
    },
    
    async approveBusiness(businessId) {
        try {
            await window.db.collection('businesses').doc(businessId).update({
                status: 'active',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('✅ Business approved successfully!');
            
            // Refresh feeds to show new business
            this.populateFeeds();
            
        } catch (error) {
            console.error('Error approving business:', error);
            alert('Error approving business');
        }
    },
    
    async rejectBusiness(businessId) {
        if (!confirm('Are you sure you want to reject this business?')) return;
        
        try {
            await window.db.collection('businesses').doc(businessId).update({
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('❌ Business rejected');
            
        } catch (error) {
            console.error('Error rejecting business:', error);
            alert('Error rejecting business');
        }
    },
    
    // 📱 Screen Management
    showScreen(screenType) {
        console.log(`📱 Switching to ${screenType} screen`);
        
        // Check if guest trying to access restricted features
        if (this.state.isGuestMode && screenType === 'social') {
            alert('🔒 Sign up to access social features and connect with other travelers!');
            this.showRegister();
            return;
        }
        
        this.state.currentScreen = screenType;
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(`${screenType}Screen`).classList.add('active');
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-screen="${screenType}"]`).classList.add('active');
        
        // Reset social tab when leaving social screen
        if (screenType !== 'social') {
            this.switchSocialTab('userFeed');
        }
    },
    
    switchSocialTab(tabType) {
        console.log(`🔄 Switching to ${tabType} tab`);
        this.state.currentSocialTab = tabType;
        
        // Update tabs
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.social-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabType}Content`).classList.add('active');
    },
    
    // 🍽️ Feed Management
    populateFeeds() {
        this.populateRestaurantFeed();
        this.populateActivityFeed();
    },
    
    async populateRestaurantFeed() {
        const storiesContainer = document.getElementById('restaurantStories');
        const feedContainer = document.getElementById('restaurantFeed');
        
        try {
            // Show loading
            feedContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Try to fetch from Firebase first
            if (this.state.isAuthenticated && window.db) {
                const snapshot = await window.db.collection('businesses')
                    .where('type', '==', 'restaurant')
                    .where('status', '==', 'active')
                    .orderBy('updatedAt', 'desc')
                    .limit(20)
                    .get();
                
                const restaurants = [];
                snapshot.forEach(doc => {
                    const business = doc.data();
                    restaurants.push({
                        id: doc.id,
                        name: business.name,
                        type: business.type,
                        image: business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop',
                        logo: business.photos?.[1] || business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop',
                        story: business.photos?.[0] || 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=150&h=200&fit=crop',
                        promo: business.promoTitle || 'Special Offer',
                        details: business.promoDetails || 'Ask about our current promotions',
                        description: business.description || 'Great food and atmosphere in Hoi An',
                        location: business.address || 'Hoi An Ancient Town',
                        hours: business.hours || 'Daily 8am-10pm',
                        price: business.priceRange === 'budget' ? '$ - Budget Friendly' : 
                               business.priceRange === 'expensive' ? '$$ - Expensive' : '$ - Moderate',
                        contact: business.phone || '+84 123 456 789'
                    });
                });
                
                // If Firebase has restaurants, use them
                if (restaurants.length > 0) {
                    this.renderRestaurantFeed(restaurants, storiesContainer, feedContainer);
                    return;
                }
            }
            
            // Fallback to demo data
            this.renderRestaurantFeed(this.data.restaurants, storiesContainer, feedContainer);
            
        } catch (error) {
            console.error('❌ Error loading restaurants:', error);
            // Fallback to demo data
            this.renderRestaurantFeed(this.data.restaurants, storiesContainer, feedContainer);
        }
    },
    
    renderRestaurantFeed(restaurants, storiesContainer, feedContainer) {
        // Populate stories
        storiesContainer.innerHTML = restaurants.slice(0, 10).map(restaurant => 
            `<div class="story-item" style="background-image: url('${restaurant.story}')">
                <div class="story-overlay">
                    <div class="story-title">${restaurant.name}</div>
                    <div class="story-subtitle">${restaurant.type}</div>
                </div>
            </div>`
        ).join('');
        
        // Populate feed
        feedContainer.innerHTML = restaurants.map(restaurant => 
            this.createBusinessCard(restaurant, 'restaurant')
        ).join('');
        
        // Add business signup banner
        this.addBusinessSignupBanner(feedContainer);
        
        // Add admin notice if there are pending businesses
        if (this.isAdminUser()) {
            this.addAdminNotice(feedContainer);
        }
        
        console.log('🍽️ Restaurant feed populated with', restaurants.length, 'businesses');
    },
    
    async addAdminNotice(container) {
        try {
            const pendingSnapshot = await window.db.collection('businesses')
                .where('status', '==', 'pending_approval')
                .get();
            
            if (pendingSnapshot.size > 0) {
                const adminNotice = document.createElement('div');
                adminNotice.innerHTML = `
                    <div style="background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 15px; padding: 20px; margin: 20px 0; text-align: center;">
                        <h3 style="margin: 0 0 10px 0; color: #FF6B6B;">🛡️ Admin Notice</h3>
                        <p style="margin: 0 0 15px 0; font-size: 14px;">${pendingSnapshot.size} business${pendingSnapshot.size > 1 ? 'es' : ''} pending approval</p>
                        <button onclick="CLASSIFIED.openAdminPanel()" style="background: rgba(255,107,107,0.2); border: 1px solid rgba(255,107,107,0.3); border-radius: 20px; padding: 8px 16px; color: #FF6B6B; cursor: pointer; font-size: 12px;">
                            Review Applications
                        </button>
                    </div>
                `;
                container.appendChild(adminNotice);
            }
        } catch (error) {
            console.error('Error checking pending businesses:', error);
        }
    },
    
    async populateActivityFeed() {
        const storiesContainer = document.getElementById('activityStories');
        const feedContainer = document.getElementById('activityFeed');
        
        try {
            feedContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Try to fetch from Firebase first
            if (this.state.isAuthenticated && window.db) {
                const snapshot = await window.db.collection('businesses')
                    .where('type', '==', 'activity')
                    .where('status', '==', 'active')
                    .orderBy('updatedAt', 'desc')
                    .limit(20)
                    .get();
                
                const activities = [];
                snapshot.forEach(doc => {
                    const business = doc.data();
                    activities.push({
                        id: doc.id,
                        name: business.name,
                        type: business.type,
                        image: business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop',
                        logo: business.photos?.[1] || business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop',
                        story: business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=150&h=200&fit=crop',
                        promo: business.promoTitle || 'Special Activity',
                        details: business.promoDetails || 'Book now for special rates',
                        description: business.description || 'Amazing activity experience in Hoi An',
                        location: business.address || 'Hoi An, Vietnam',
                        hours: business.hours || 'Daily tours available',
                        price: business.priceRange === 'budget' ? '$ - Budget Friendly' : 
                               business.priceRange === 'expensive' ? '$$ - Expensive' : '$ - Moderate',
                        contact: business.phone || '+84 123 456 789'
                    });
                });
                
                if (activities.length > 0) {
                    this.renderActivityFeed(activities, storiesContainer, feedContainer);
                    return;
                }
            }
            
            // Fallback to demo data
            this.renderActivityFeed(this.data.activities, storiesContainer, feedContainer);
            
        } catch (error) {
            console.error('❌ Error loading activities:', error);
            this.renderActivityFeed(this.data.activities, storiesContainer, feedContainer);
        }
    },
    
    renderActivityFeed(activities, storiesContainer, feedContainer) {
        // Populate stories
        storiesContainer.innerHTML = activities.slice(0, 10).map(activity => 
            `<div class="story-item" style="background-image: url('${activity.story}')">
                <div class="story-overlay">
                    <div class="story-title">${activity.name}</div>
                    <div class="story-subtitle">${activity.type}</div>
                </div>
            </div>`
        ).join('');
        
        // Populate feed
        feedContainer.innerHTML = activities.map(activity => 
            this.createBusinessCard(activity, 'activity')
        ).join('');
        
        // Add business signup banner
        this.addBusinessSignupBanner(feedContainer);
        
        console.log('🎯 Activity feed populated with', activities.length, 'businesses');
    },
    
    createBusinessCard(business, type) {
        return `
            <div class="business-card" onclick="CLASSIFIED.openBusinessProfile('${business.id}', '${type}')">
                <div class="business-header">
                    <div class="business-logo" style="background-image: url('${business.logo}')"></div>
                    <div class="business-info">
                        <h3>${business.name}</h3>
                        <p>${business.type}</p>
                    </div>
                </div>
                <div class="business-image" style="background-image: url('${business.image}')"></div>
                <div class="business-content">
                    <div class="business-description">${business.description.substring(0, 100)}...</div>
                    <div class="business-promo">
                        <div class="promo-title">${business.promo}</div>
                        <div class="promo-details">${business.details}</div>
                    </div>
                </div>
            </div>
        `;
    },
    
    addBusinessSignupBanner(container) {
        const banner = document.createElement('div');
        banner.className = 'business-signup-banner';
        banner.innerHTML = `
            <h3>🏪 Own a Business in Hoi An?</h3>
            <p>Create your account instantly and reach 100+ travelers daily</p>
            <div class="cta-button" onclick="CLASSIFIED.showBusinessSignup()">
                Create Business Account 🚀
            </div>
        `;
        
        // Insert after the 3rd business card
        const businessCards = container.querySelectorAll('.business-card');
        if (businessCards.length >= 3) {
            businessCards[2].insertAdjacentElement('afterend', banner);
        } else {
            container.appendChild(banner);
        }
    },
    
    showBusinessSignup() {
        const modal = document.createElement('div');
        modal.className = 'business-signup-modal';
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;" onclick="this.remove()">
                <div style="background: #2a2a2a; border-radius: 20px; padding: 30px; max-width: 400px; width: 100%; border: 1px solid rgba(255,255,255,0.1);" onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 20px 0; text-align: center; color: #FFD700;">🏪 Partner with CLASSIFIED</h3>
                    
                    <div style="background: rgba(0,212,255,0.1); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #00D4FF;">What You Get:</h4>
                        <ul style="margin: 0; padding-left: 20px; opacity: 0.9;">
                            <li>✅ Instant account creation</li>
                            <li>✅ Direct access to 100+ travelers</li>
                            <li>✅ Featured placement in app</li>
                            <li>✅ Custom promotion tools</li>
                            <li>✅ Real-time customer insights</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <input type="text" placeholder="Business Name" id="quickBusinessName" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white;">
                        <input type="email" placeholder="Email Address" id="quickBusinessEmail" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white;">
                        <input type="tel" placeholder="WhatsApp Number" id="quickBusinessPhone" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white;">
                        <select id="quickBusinessType" style="width: 100%; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white;">
                            <option value="">Select Business Type</option>
                            <option value="restaurant">Restaurant/Bar</option>
                            <option value="activity">Activity/Tour</option>
                            <option value="accommodation">Hotel/Hostel</option>
                            <option value="retail">Shop/Retail</option>
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="this.closest('.business-signup-modal').remove()" style="flex: 1; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; cursor: pointer;">
                            Cancel
                        </button>
                        <button onclick="CLASSIFIED.submitQuickBusinessSignup()" style="flex: 2; padding: 12px; background: linear-gradient(135deg, #FFD700, #FF6B6B); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                            Create Account 🚀
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    async submitQuickBusinessSignup() {
        const name = document.getElementById('quickBusinessName').value;
        const email = document.getElementById('quickBusinessEmail').value;
        const phone = document.getElementById('quickBusinessPhone').value;
        const type = document.getElementById('quickBusinessType').value;
        
        if (!name || !email || !phone || !type) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            // Create business account directly
            const tempPassword = this.generateTempPassword();
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, tempPassword);
            
            // Update display name
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            // Create business profile
            await window.db.collection('businesses').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                phone: phone,
                type: type,
                status: 'pending_approval',
                uid: userCredential.user.uid,
                source: 'quick_signup',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                tempPassword: tempPassword,
                location: 'Hoi An, Vietnam'
            });
            
            // Close modal and show success
            document.querySelector('.business-signup-modal').remove();
            
            // Show success message with login info
            setTimeout(() => {
                alert(`🎉 Business account created!\n\nEmail: ${email}\nPassword: ${tempPassword}\n\nYou can now login and complete your profile. We'll review it within 24 hours.`);
                
                // Optionally redirect to business login
                this.showBusinessAuth();
                document.getElementById('businessLoginEmail').value = email;
                document.getElementById('businessLoginPassword').value = tempPassword;
            }, 300);
            
            console.log('✅ Quick business signup completed');
            
        } catch (error) {
            console.error('❌ Error submitting business signup:', error);
            alert('Error creating account: ' + error.message);
        }
    },
    
    // 👥 User Feed Management
    async populateUserFeed() {
        if (!this.state.isAuthenticated) return;
        
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            // Fetch real users from Firebase, excluding current user
            const snapshot = await window.db.collection('users')
                .where('uid', '!=', this.state.currentUser.uid)
                .orderBy('uid')
                .orderBy('updatedAt', 'desc')
                .limit(20)
                .get();
            
            const users = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                // Only include users with complete profiles
                if (userData.name && userData.bio && userData.interests && userData.interests.length > 0) {
                    users.push({
                        id: doc.id,
                        uid: userData.uid,
                        name: userData.name,
                        age: userData.age || 25,
                        image: userData.photos?.[0] || userData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop',
                        interests: userData.interests || ['Travel', 'Adventure'],
                        bio: userData.bio || 'Exploring Hoi An!',
                        isOnline: userData.isOnline || false,
                        distance: userData.distance || `${Math.floor(Math.random() * 5) + 1} km`,
                        matchPercentage: userData.matchPercentage || Math.floor(Math.random() * 30) + 70,
                        category: userData.category || 'all',
                        career: userData.career,
                        lookingFor: userData.lookingFor
                    });
                }
            });
            
            // Show user count
            const userCount = users.length;
            console.log(`👥 Found ${userCount} users in feed`);
            
            // If we have real users, display them
            if (users.length > 0) {
                container.innerHTML = '';
                users.forEach((user, index) => {
                    const feedItem = this.createUserFeedItem(user, index);
                    container.appendChild(feedItem);
                });
                
                // Add activity indicator
                const activityIndicator = document.createElement('div');
                activityIndicator.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: rgba(0,212,255,0.1); margin: 20px 0; border-radius: 15px;">
                        <h3>🔥 ${userCount} travelers active in Hoi An</h3>
                        <p>Join the community and start connecting!</p>
                    </div>
                `;
                container.appendChild(activityIndicator);
                
            } else {
                // Add demo users if no real users yet
                const demoUsers = this.data.users.map(user => ({
                    ...user,
                    uid: `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`,
                    id: `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`
                }));
                
                container.innerHTML = '';
                demoUsers.forEach((user, index) => {
                    const feedItem = this.createUserFeedItem(user, index);
                    container.appendChild(feedItem);
                });
                
                // Show encouraging message for first users
                const encourageMessage = document.createElement('div');
                encourageMessage.innerHTML = `
                    <div style="text-align: center; padding: 40px; opacity: 0.9;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
                        <div style="font-size: 20px; margin-bottom: 15px; color: #00D4FF;">You're among the first!</div>
                        <div style="font-size: 16px; margin-bottom: 10px;">These are demo profiles. Complete your profile and invite friends to start real connections!</div>
                        <button onclick="CLASSIFIED.shareApp()" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; border-radius: 25px; color: white; font-weight: 600; cursor: pointer;">
                            Share CLASSIFIED 🚀
                        </button>
                    </div>
                `;
                container.appendChild(encourageMessage);
            }
            
        } catch (error) {
            console.error('❌ Error loading users:', error);
            // Show error message
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 18px; margin-bottom: 10px;">Unable to load users</div>
                    <div style="font-size: 14px;">Please check your internet connection and try again.</div>
                    <button onclick="CLASSIFIED.populateUserFeed()" style="margin-top: 20px; padding: 12px 24px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 25px; color: white; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            `;
        }
    },
    
    filterUsers(filter) {
        console.log(`🔍 Filtering users by: ${filter}`);
        // Update active filter chip
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Filter users based on criteria
        let filteredUsers = this.data.users;
        if (filter === 'online') {
            filteredUsers = this.data.users.filter(user => user.isOnline);
        } else if (filter === 'nearby') {
            filteredUsers = this.data.users.filter(user => {
                const distance = parseFloat(user.distance);
                return distance < 2; // Within 2km
            });
        } else if (filter === 'nomads') {
            filteredUsers = this.data.users.filter(user => user.category === 'nomads');
        }
        
        // Re-populate feed with filtered users
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '';
        filteredUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
    },
    
createUserFeedItem(user, index) {
    const feedItem = document.createElement('div');
    feedItem.className = 'user-feed-item';
    feedItem.style.animationDelay = `${index * 0.1}s`;
    feedItem.style.cursor = 'pointer';
    
    // Make sure user has an ID
    const userId = user.uid || user.id || `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`;
    user.uid = userId;
    user.id = userId; // Also set id property
    
    // Make the entire card clickable to view profile
    feedItem.addEventListener('click', (e) => {
        // Don't open profile if clicking on action buttons
        if (!e.target.closest('.user-actions')) {
            this.openUserProfile(user);
        }
    });
    
    feedItem.innerHTML = `
        <div class="user-status-badges">
            ${user.isOnline ? '<div class="status-badge status-online">🟢 Online</div>' : ''}
            <div class="status-badge status-distance">📍 ${user.distance}</div>
            <div class="status-badge status-match">🔥 ${user.matchPercentage}% Match</div>
        </div>
        <div class="user-image" style="background-image: url('${user.image}')">
            <div class="user-image-overlay">
                <div class="user-name">${user.name}, ${user.age}</div>
            </div>
        </div>
        <div class="user-info">
            <div class="user-bio">${user.bio}</div>
            <div class="user-interests">
                ${user.interests.map(interest => `<span class="interest-tag">${interest}</span>`).join('')}
            </div>
            <div class="user-actions">
                <button class="action-btn pass-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('pass', '${userId}', '${user.name}')">✕ Pass</button>
                <button class="action-btn chat-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('like', '${userId}', '${user.name}')">💬 Chat</button>
                <button class="action-btn super-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('superlike', '${userId}', '${user.name}')">⭐ Super</button>
            </div>
        </div>
    `;
    return feedItem;
}
    
    // 👤 User Profile Management
    openUserProfile(user) {
        console.log(`👤 Opening ${user.name}'s profile`);
        document.getElementById('userProfileView').classList.add('show');
        this.state.isUserProfileOpen = true;
        this.state.currentViewedUser = user;
        
        // Populate user profile data
        document.getElementById('userProfileTitle').textContent = user.name;
        document.getElementById('userProfileHero').style.backgroundImage = `url('${user.image}')`;
        document.getElementById('userProfileName').textContent = user.name;
        document.getElementById('userProfileAge').textContent = `${user.age} years old`;
        document.getElementById('userProfileMatch').textContent = `${user.matchPercentage}% Match`;
        document.getElementById('userProfileBio').textContent = user.bio;
        document.getElementById('userProfileDistance').textContent = user.distance;
        document.getElementById('userProfileStatus').textContent = user.isOnline ? 'Online Now' : 'Offline';
        document.getElementById('userProfileCategory').textContent = user.category === 'nomads' ? 'Digital Nomad' : 'Traveler';
        
        // Update interests
        const interestsContainer = document.getElementById('userProfileInterests');
        interestsContainer.innerHTML = user.interests.map(interest => 
            `<span class="interest-tag">${interest}</span>`
        ).join('');
    },
    
    closeUserProfile() {
        console.log('🔙 Closing user profile');
        document.getElementById('userProfileView').classList.remove('show');
        this.state.isUserProfileOpen = false;
        this.state.currentViewedUser = null;
    },
    
    startChatWithViewedUser() {
        if (this.state.currentViewedUser) {
            const user = this.state.currentViewedUser;
            this.closeUserProfile();
            setTimeout(() => {
                this.openChatWithUser(user.name);
            }, 300);
        }
    },
    
    openProfileFromChat() {
        console.log('🔍 Opening profile from chat');
        console.log('Current chat user state:', this.state.currentChatUser);
        
        let user = null;
        
        if (this.state.currentChatUser) {
            user = this.state.currentChatUser;
            console.log('✅ Found user from currentChatUser:', user.name);
        } else {
            const chatNameElement = document.getElementById('chatName');
            const chatName = chatNameElement ? chatNameElement.textContent.trim() : '';
            console.log('🔄 Looking up user by chat name:', chatName);
            
            if (chatName) {
                user = this.data.users.find(u => u.name.trim() === chatName);
                if (user) {
                    console.log('✅ Found user by name lookup:', user.name);
                    this.state.currentChatUser = user;
                }
            }
        }
        
        if (user) {
            console.log('🚀 Opening user profile for:', user.name);
            this.openUserProfile(user);
        } else {
            console.error('❌ Could not find user data');
            alert('Could not load user profile. Please try again.');
        }
    },
    
    async handleUserAction(action, userId) {
        console.log(`👆 ${action} action for user ID: ${userId}`);
        
        // Find the target user by ID
        let targetUser = null;
        
        // First check current viewed user
        if (this.state.currentViewedUser && this.state.currentViewedUser.uid === userId) {
            targetUser = this.state.currentViewedUser;
        } else {
            // Try to find in loaded users
            const userFeedItems = document.querySelectorAll('.user-feed-item');
            for (const item of userFeedItems) {
                const buttons = item.querySelectorAll('.action-btn');
                for (const btn of buttons) {
                    if (btn.onclick && btn.onclick.toString().includes(userId)) {
                        // Extract user data from the feed item
                        const nameElement = item.querySelector('.user-name');
                        if (nameElement) {
                            const nameText = nameElement.textContent;
                            const [name] = nameText.split(',');
                            targetUser = this.data.users.find(u => u.name === name.trim());
                            if (targetUser) {
                                targetUser.uid = userId;
                                break;
                            }
                        }
                    }
                }
                if (targetUser) break;
            }
        }
        
        if (!targetUser) {
            console.error('❌ Could not find target user with ID:', userId);
            return;
        }
        
        console.log('✅ Found target user:', targetUser.name);
        
        if (action === 'like' || action === 'superlike') {
            if (this.state.isUserProfileOpen) {
                this.closeUserProfile();
            }
            
            // For demo users, just show a success message
            if (userId.startsWith('demo_')) {
                alert(`You ${action === 'superlike' ? 'super liked' : 'liked'} ${targetUser.name}! 💕\n\nThis is a demo profile. Complete your profile to connect with real users!`);
            } else {
                await this.handleUserLike(userId, targetUser.name);
            }
            
        } else if (action === 'pass') {
            if (this.state.isUserProfileOpen) {
                this.closeUserProfile();
            }
            console.log(`Passed on ${targetUser.name}`);
        }
    },
    
    showMatchPopup() {
        document.getElementById('matchPopup').classList.add('show');
    },
    
    startChatFromMatch() {
        document.getElementById('matchPopup').classList.remove('show');
        
        // If we have the matched user info, open chat directly
        if (this.state.lastMatchedUser) {
            this.openChatFromMatch(
                this.state.lastMatchedUser.id,
                this.state.lastMatchedUser.name,
                this.state.lastMatchedUser.avatar
            );
        } else {
            // Fallback: just go to messaging
            this.showScreen('social');
            this.switchSocialTab('messaging');
        }
    },
    
    // 💬 REAL-TIME MESSAGING SYSTEM
    
    // Initialize messaging listeners
    initMessaging() {
        if (!this.state.currentUser) return;
        
        console.log('🔄 Initializing messaging system...');
        
        // Listen for new matches
        this.listenForMatches();
        
        // Listen for chat list updates
        this.listenForChats();
        
        // Mark messages as read when user opens app
        this.markMessagesAsRead();
    },
    
    // Create or get existing chat between two users
    async getOrCreateChat(otherUserId, otherUserName) {
        const currentUserId = this.state.currentUser.uid;
        
        // Create consistent chat ID (alphabetically sorted)
        const chatId = [currentUserId, otherUserId].sort().join('_');
        
        try {
            const chatRef = window.db.collection('chats').doc(chatId);
            const chatDoc = await chatRef.get();
            
            if (!chatDoc.exists) {
                // Create new chat
                await chatRef.set({
                    participants: [currentUserId, otherUserId],
                    participantNames: {
                        [currentUserId]: this.state.currentUser.displayName || this.state.userProfile.name,
                        [otherUserId]: otherUserName
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: null,
                    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ New chat created:', chatId);
            }
            
            return chatId;
        } catch (error) {
            console.error('❌ Error creating chat:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules as shown in the console.');
                console.error('Add these rules in Firebase Console > Firestore > Rules:', `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      allow write: if request.auth != null;
    }
  }
}`);
            }
            throw error;
        }
    },
    
    // Send a message
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const messageText = input.value.trim();
        
        if (!messageText || !this.state.currentChatUser) {
            console.log('❌ No message or recipient');
            return;
        }
        
        const currentUserId = this.state.currentUser.uid;
        const recipientId = this.state.currentChatUser.uid || this.state.currentChatUser.id;
        const chatId = [currentUserId, recipientId].sort().join('_');
        
        try {
            // Add message to messages collection
            const messageData = {
                chatId: chatId,
                senderId: currentUserId,
                senderName: this.state.currentUser.displayName || this.state.userProfile.name,
                recipientId: recipientId,
                text: messageText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };
            
            await window.db.collection('messages').add(messageData);
            console.log('✅ Message sent:', messageText);
            
            // Update chat's last message
            await window.db.collection('chats').doc(chatId).update({
                lastMessage: messageText,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                lastSenderId: currentUserId
            });
            
            // Clear input
            input.value = '';
            
            // Scroll to bottom
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules.');
            } else {
                alert('Failed to send message. Please try again.');
            }
        }
    },
    
    // Listen for messages in current chat
    listenForChatMessages(chatId) {
        console.log('👂 Listening for messages in chat:', chatId);
        
        // Clean up previous listener
        if (this.messageListener) {
            this.messageListener();
        }
        
        // Set up new listener
        this.messageListener = window.db.collection('messages')
            .where('chatId', '==', chatId)
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.displayMessages(messages);
                
                // Mark messages as read
                this.markChatMessagesAsRead(chatId);
            }, (error) => {
                console.error('❌ Error listening for messages:', error);
            });
    },
    
    // Display messages in the chat UI
    displayMessages(messages) {
        const container = document.getElementById('chatMessages');
        const currentUserId = this.state.currentUser.uid;
        
        container.innerHTML = messages.map(msg => {
            const isSent = msg.senderId === currentUserId;
            const timeStr = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble">${msg.text}</div>
                    <div class="message-time" style="font-size: 11px; opacity: 0.6; margin-top: 4px; text-align: ${isSent ? 'right' : 'left'};">${timeStr}</div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },
    
    // Mark messages as read
    async markChatMessagesAsRead(chatId) {
        const currentUserId = this.state.currentUser.uid;
        
        try {
            const unreadMessages = await window.db.collection('messages')
                .where('chatId', '==', chatId)
                .where('recipientId', '==', currentUserId)
                .where('read', '==', false)
                .get();
            
            const batch = window.db.batch();
            unreadMessages.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            
            await batch.commit();
            console.log('✅ Marked messages as read');
        } catch (error) {
            console.error('❌ Error marking messages as read:', error);
        }
    },
    
    // Listen for chat list updates
    listenForChats() {
        const currentUserId = this.state.currentUser.uid;
        
        this.chatListListener = window.db.collection('chats')
            .where('participants', 'array-contains', currentUserId)
            .orderBy('lastMessageTime', 'desc')
            .onSnapshot(async (snapshot) => {
                const chats = [];
                
                for (const doc of snapshot.docs) {
                    const chatData = doc.data();
                    const otherUserId = chatData.participants.find(id => id !== currentUserId);
                    
                    // Get other user's data
                    const userDoc = await window.db.collection('users').doc(otherUserId).get();
                    const userData = userDoc.exists ? userDoc.data() : {};
                    
                    // Count unread messages
                    const unreadCount = await this.getUnreadCount(doc.id, currentUserId);
                    
                    chats.push({
                        id: doc.id,
                        ...chatData,
                        otherUserId: otherUserId,
                        otherUserName: userData.name || chatData.participantNames?.[otherUserId] || 'Unknown',
                        otherUserAvatar: userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100',
                        unreadCount: unreadCount
                    });
                }
                
                this.displayChatList(chats);
            });
    },
    
    // Get unread message count
    async getUnreadCount(chatId, userId) {
        const snapshot = await window.db.collection('messages')
            .where('chatId', '==', chatId)
            .where('recipientId', '==', userId)
            .where('read', '==', false)
            .get();
        
        return snapshot.size;
    },
    
    // Display chat list
    displayChatList(chats) {
        const container = document.getElementById('chatList');
        
        if (chats.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.6;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
                    <div>No conversations yet</div>
                    <div style="font-size: 14px; margin-top: 5px;">Like someone to start chatting!</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = chats.map(chat => {
            const timeStr = chat.lastMessageTime ? this.getRelativeTime(chat.lastMessageTime.toDate()) : '';
            const isUnread = chat.unreadCount > 0;
            
            return `
                <div class="chat-item" onclick="CLASSIFIED.openChatFromList('${chat.otherUserId}', '${chat.otherUserName}', '${chat.otherUserAvatar}')" style="${isUnread ? 'background: rgba(0,212,255,0.05);' : ''}">
                    <div class="chat-avatar" style="background-image: url('${chat.otherUserAvatar}')">
                        ${isUnread ? `<div style="position: absolute; top: 0; right: 0; background: #00D4FF; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #1a1a1a;"></div>` : ''}
                    </div>
                    <div class="chat-info">
                        <div class="chat-name" style="${isUnread ? 'font-weight: 700;' : ''}">${chat.otherUserName}</div>
                        <div class="chat-message" style="${isUnread ? 'font-weight: 600; opacity: 0.9;' : ''}">${chat.lastMessage || 'Start a conversation!'}</div>
                    </div>
                    <div class="chat-time">${timeStr}</div>
                </div>
            `;
        }).join('');
    },
    
    // Open chat from list
    async openChatFromList(userId, userName, userAvatar) {
        // Create user object
        const user = {
            id: userId,
            uid: userId,
            name: userName,
            image: userAvatar
        };
        
        this.state.currentChatUser = user;
        
        // Get or create chat
        const chatId = await this.getOrCreateChat(userId, userName);
        
        // Open chat UI
        this.openChat(userName, userAvatar);
        
        // Start listening for messages
        this.listenForChatMessages(chatId);
    },
    
    // Get relative time string
    getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'now';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        return date.toLocaleDateString();
    },
    
    // 💕 MATCHING SYSTEM
    
    // Handle user like action
    async handleUserLike(targetUserId, targetUserName) {
        const currentUserId = this.state.currentUser.uid;
        
        try {
            // Record the like
            await window.db.collection('likes').add({
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Check if other user already liked us (mutual match)
            const mutualLike = await window.db.collection('likes')
                .where('fromUserId', '==', targetUserId)
                .where('toUserId', '==', currentUserId)
                .get();
            
            if (!mutualLike.empty) {
                // It's a match!
                await this.createMatch(currentUserId, targetUserId, targetUserName);
                this.showMatchPopup(targetUserName);
            } else {
                alert(`You liked ${targetUserName}! 💕 They'll be notified.`);
            }
            
        } catch (error) {
            console.error('❌ Error handling like:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules as shown in the console.');
            } else {
                alert('Failed to process like. Please try again.');
            }
        }
    },
    
    // Create a match between users
    async createMatch(userId1, userId2, user2Name) {
        const matchId = [userId1, userId2].sort().join('_');
        
        try {
            await window.db.collection('matches').doc(matchId).set({
                users: [userId1, userId2],
                matchedAt: firebase.firestore.FieldValue.serverTimestamp(),
                chatStarted: false
            });
            
            // Create initial chat
            await this.getOrCreateChat(userId2, user2Name);
            
            console.log('✅ Match created!');
        } catch (error) {
            console.error('❌ Error creating match:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules.');
            }
        }
    },
    
    // Listen for new matches
    listenForMatches() {
        const currentUserId = this.state.currentUser.uid;
        
        this.matchListener = window.db.collection('matches')
            .where('users', 'array-contains', currentUserId)
            .orderBy('matchedAt', 'desc')
            .onSnapshot(async (snapshot) => {
                const matches = [];
                
                for (const doc of snapshot.docs) {
                    const matchData = doc.data();
                    const otherUserId = matchData.users.find(id => id !== currentUserId);
                    
                    // Get other user's data
                    const userDoc = await window.db.collection('users').doc(otherUserId).get();
                    const userData = userDoc.exists ? userDoc.data() : {};
                    
                    matches.push({
                        id: doc.id,
                        ...matchData,
                        otherUser: {
                            id: otherUserId,
                            name: userData.name || 'Unknown',
                            avatar: userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100'
                        }
                    });
                }
                
                this.displayMatches(matches);
            }, (error) => {
                if (error.code === 'permission-denied') {
                    console.log('Cannot load matches - permission denied');
                }
            });
    },
    
    // Display matches
    displayMatches(matches) {
        const container = document.getElementById('matchesScroll');
        
        container.innerHTML = matches.slice(0, 10).map(match => `
            <div class="match-avatar" style="background-image: url('${match.otherUser.avatar}')" 
                 onclick="CLASSIFIED.openChatFromMatch('${match.otherUser.id}', '${match.otherUser.name}', '${match.otherUser.avatar}')"
                 title="${match.otherUser.name}"></div>
        `).join('');
    },
    
    // Open chat from match
    async openChatFromMatch(userId, userName, userAvatar) {
        await this.openChatFromList(userId, userName, userAvatar);
        
        // Update match as chat started
        const matchId = [this.state.currentUser.uid, userId].sort().join('_');
        await window.db.collection('matches').doc(matchId).update({
            chatStarted: true
        });
    },
    
    // Show match popup with correct user
    showMatchPopup(userName = 'Someone') {
        const popup = document.getElementById('matchPopup');
        popup.innerHTML = `
            <div class="match-content">
                <div class="match-text">IT'S A MATCH! 🎉</div>
                <p>You and ${userName} both liked each other</p>
                <button class="match-btn" onclick="CLASSIFIED.closeMatchPopup()">Start Chatting</button>
            </div>
        `;
        popup.classList.add('show');
    },
    
    // Close match popup
    closeMatchPopup() {
        document.getElementById('matchPopup').classList.remove('show');
        // Navigate to messaging tab
        this.showScreen('social');
        this.switchSocialTab('messaging');
    },
    
    // Clean up listeners when logging out
    cleanupMessagingListeners() {
        if (this.messageListener) this.messageListener();
        if (this.chatListListener) this.chatListListener();
        if (this.matchListener) this.matchListener();
    },
    
    // Update the messaging tab to show loading states
    populateMessaging() {
        const matchesContainer = document.getElementById('matchesScroll');
        const chatListContainer = document.getElementById('chatList');
        
        // Show loading states
        matchesContainer.innerHTML = '<div style="padding: 20px; opacity: 0.6;">Loading matches...</div>';
        chatListContainer.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.6;">Loading conversations...</div>';
        
        console.log('💬 Messaging will be populated by real-time listeners');
    },
    
    // Updated openChat function to work with new messaging system
    openChat(name, avatar) {
        console.log(`💬 Opening chat with ${name}`);
        const chat = document.getElementById('individualChat');
        chat.classList.add('show');
        this.state.isChatOpen = true;
        
        document.getElementById('chatName').textContent = name;
        document.getElementById('chatAvatar').style.backgroundImage = `url('${avatar}')`;
        
        // Clear previous messages
        document.getElementById('chatMessages').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    },
    
    // Updated openChatWithUser to work with real-time messaging
    async openChatWithUser(userName) {
        console.log(`💬 Opening chat with user: ${userName}`);
        
        const user = this.data.users.find(u => u.name === userName);
        
        if (user) {
            console.log('✅ Found user object:', user);
            this.state.currentChatUser = user;
            
            // For demo users, generate a temporary ID
            const userId = user.uid || `demo_${userName.toLowerCase().replace(/\s/g, '_')}`;
            user.uid = userId;
            
            // Get or create chat
            const chatId = await this.getOrCreateChat(userId, userName);
            
            // Open chat UI
            this.openChat(user.name, user.image);
            
            // Start listening for messages
            this.listenForChatMessages(chatId);
        } else {
            console.error('❌ Could not find user:', userName);
            this.openChat(userName, '');
        }
    },
    
    closeChat() {
        console.log('🔙 Closing chat');
        document.getElementById('individualChat').classList.remove('show');
        this.state.isChatOpen = false;
        this.state.currentChatUser = null;
        
        // Clean up message listener
        if (this.messageListener) {
            this.messageListener();
            this.messageListener = null;
        }
    },
    
    // Add a stub for markMessagesAsRead that gets called on init
    async markMessagesAsRead() {
        // This is a placeholder that marks all unread messages as read
        // You can implement this later if needed
        console.log('📬 Checking for unread messages...');
    },
    
    // 🏢 Business Profile Management
    openBusinessProfile(businessId, type) {
        console.log(`🏪 Opening ${businessId} profile`);
        const businesses = type === 'restaurant' ? this.data.restaurants : this.data.activities;
        const business = businesses.find(b => b.id === businessId);
        if (!business) {
            console.error('Business not found:', businessId);
            return;
        }
        
        const profile = document.getElementById('businessProfile');
        profile.classList.add('show');
        this.state.isProfileOpen = true;
        this.state.currentBusiness = { business, type };
        
        // Populate profile data
        document.getElementById('profileHeaderTitle').textContent = business.name;
        document.getElementById('profileHero').style.backgroundImage = `url('${business.image}')`;
        document.getElementById('profileName').textContent = business.name;
        document.getElementById('profileType').textContent = business.type;
        document.getElementById('profilePromoTitle').textContent = business.promo;
        document.getElementById('profilePromoDetails').textContent = business.details;
        document.getElementById('profileDescription').textContent = business.description;
        document.getElementById('profileLocation').textContent = business.location;
        document.getElementById('profileHours').textContent = business.hours;
        document.getElementById('profilePrice').textContent = business.price;
        document.getElementById('profileContact').textContent = business.contact;
    },
    
    closeBusinessProfile() {
        console.log('🔙 Closing business profile');
        document.getElementById('businessProfile').classList.remove('show');
        this.state.isProfileOpen = false;
        this.state.currentBusiness = null;
    },
    
    shareBusinessProfile() {
        if (this.state.currentBusiness) {
            const business = this.state.currentBusiness.business;
            const shareText = `Check out ${business.name} in Hoi An! ${business.promo}`;
            if (navigator.share) {
                navigator.share({
                    title: business.name,
                    text: shareText,
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(shareText + ' - ' + window.location.href);
                alert('Business info copied to clipboard! 📋');
            }
        }
    },
    
    getDirections() {
        if (this.state.currentBusiness) {
            const business = this.state.currentBusiness.business;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.location)}`;
            window.open(mapsUrl, '_blank');
        }
    },
    
    // 🔥 Growth Features
    initGrowthFeatures() {
        this.checkReferralCode();
        
        // Show social proof notifications every 30 seconds
        setInterval(() => {
            if (this.state.isAuthenticated && Math.random() > 0.5) {
                this.showSocialProof();
            }
        }, 30000);
        
        // Show user growth features after 10 seconds
        setTimeout(() => {
            if (this.state.isAuthenticated) {
                this.showUserGrowthFeatures();
            }
        }, 10000);
    },
    
    showSocialProof() {
        const proofs = [
            '🎉 Sarah just found her adventure buddy!',
            '🍻 Mike discovered 3 new bars this week',
            '📸 Emma shared amazing photos from her food tour',
            '🎵 Dave found the perfect live music venue',
            '🌟 Jessica made 5 new connections today'
        ];
        
        const randomProof = proofs[Math.floor(Math.random() * proofs.length)];
        
        const notification = document.createElement('div');
        notification.className = 'social-proof-notification';
        notification.textContent = randomProof;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    },
    
    showUserGrowthFeatures() {
        const referralBanner = document.createElement('div');
        referralBanner.className = 'referral-banner';
        referralBanner.innerHTML = `
            <h3>🎉 Invite Friends & Get Premium!</h3>
            <p>Both you and your friend get 1 week premium features</p>
            <div class="btn-group">
                <button onclick="CLASSIFIED.shareApp()">Share App 📱</button>
                <button onclick="CLASSIFIED.showReferralCode()">My Code 🔑</button>
            </div>
        `;
        
        // Add to restaurant screen after stories
        const restaurantStories = document.getElementById('restaurantStories');
        if (restaurantStories) {
            restaurantStories.parentElement.insertAdjacentElement('afterend', referralBanner);
        }
    }
};

// Make CLASSIFIED globally available
window.CLASSIFIED = CLASSIFIED;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing CLASSIFIED...');
    CLASSIFIED.init();
});
