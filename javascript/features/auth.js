
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
