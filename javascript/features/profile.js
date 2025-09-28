// javascript/features/profile.js

import { 
    sanitizeProfile, sanitizeText 
} from '../utils/security.js';

import { profileValidator } from '../utils/validation.js';

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Profile Manager
 * Handles all profile-related functionality for users and businesses
 */
export class ProfileManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.photoUploadManager = null;
        this.referralManager = null;
        this.feedManager = null;
        
        // Track current editing state
        this.isEditing = false;
        this.currentViewedUser = null;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.photoUploadManager = managers.photoUpload;
        this.referralManager = managers.referral;
        this.feedManager = managers.feed;
    }
    
    /**
     * Initialize profile system
     */
    async init() {
        console.log('👤 Initializing profile manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load user profile if authenticated
        if (this.state.get('isAuthenticated')) {
            await this.loadCurrentUserProfile();
        }
    }
    
    /**
     * Set up event listeners for profile interactions
     */
    setupEventListeners() {
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
        
        // Profile save buttons
       // Profile save buttons - bind to the instance methods
        const saveUserBtn = document.querySelector('.save-profile-btn[onclick*="saveUserProfile"]');
        if (saveUserBtn) {
            // Keep the onclick but ensure it calls through CLASSIFIED
            saveUserBtn.removeAttribute('onclick');
            saveUserBtn.addEventListener('click', () => this.saveUserProfile());
        }
        
        const saveBusinessBtn = document.querySelector('.save-profile-btn[onclick*="saveBusinessProfile"]');
        if (saveBusinessBtn) {
            saveBusinessBtn.removeAttribute('onclick');
            saveBusinessBtn.addEventListener('click', () => this.saveBusinessProfile());
        }
    }
    
    /**
     * Handle user login - load profile
     */
    async onUserLogin(user) {
        console.log('👤 Loading profile for logged in user...');
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
                console.log('✅ User profile loaded');
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
        }
    }
    
    /**
     * Open profile editor
     */
    openProfileEditor() {
        console.log('✏️ Opening profile editor');
        this.navigationManager.showOverlay('profileEditor');
        this.loadProfileDataIntoForm();
        this.isEditing = true;
    }
    
    /**
     * Close profile editor
     */
    closeProfileEditor() {
        console.log('🔙 Closing profile editor');
        this.navigationManager.closeOverlay('profileEditor');
        this.isEditing = false;
    }
    
    /**
     * Load profile data into form
     */
    loadProfileDataIntoForm() {
        const profile = this.state.get('userProfile');
        
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
    }
    
    /**
     * Save user profile
     */
      async saveUserProfile() {
        const user = this.state.get('currentUser');
        if (!user) {
            alert('Please log in first');
            return;
        }
        
        try {
            // Clear previous errors
            profileValidator.clearErrors();
            
            // Gather form data
            const rawProfileData = this.gatherUserProfileData();
            
            // Add name from current user
            rawProfileData.name = user.displayName || rawProfileData.name || '';
            
            // Validate profile
            const validation = profileValidator.validateProfile(rawProfileData);
            
            if (!validation.isValid) {
                // Show all validation errors
                profileValidator.showAllErrors();
                
                // Scroll to first error
                const firstError = document.querySelector('.field-error');
                if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                console.log('❌ Validation failed:', validation.errors);
                return;
            }
            
            this.navigationManager.showLoading();
            
            // Use sanitized data from validator
            const profileData = validation.sanitizedData;
            
            // Add system fields
            profileData.uid = user.uid;
            profileData.email = user.email;
            profileData.updatedAt = serverTimestamp();
            profileData.isOnline = true;
            profileData.lastSeen = serverTimestamp();
            profileData.location = 'Hoi An, Vietnam';
            profileData.matchPercentage = Math.floor(Math.random() * 30) + 70;
            profileData.distance = `${Math.floor(Math.random() * 5) + 1} km`;
            profileData.category = profileData.career === 'Digital Nomad' ? 'nomads' : 'all';
            
            // Generate referral code if not exists
            if (!profileData.referralCode) {
                profileData.referralCode = this.generateReferralCode();
            }
            
            // Save to Firebase
            await setDoc(doc(this.db, 'users', user.uid), profileData, { merge: true });
            
            // Update local state
            this.state.set('userProfile', profileData);
            
            console.log('💾 Profile saved successfully');
            this.navigationManager.hideLoading();
            
            alert('Profile saved successfully! 🎉 You\'ll now appear in the user feed.');
            
            // Refresh user feed
            this.closeProfileEditor();
            if (this.feedManager) {
                await this.feedManager.populateUserFeed();
            }
            
            // Show referral code
            if (this.referralManager) {
                setTimeout(() => {
                    this.referralManager.showReferralCode();
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ Error saving profile:', error);
            this.navigationManager.hideLoading();
            alert('Error saving profile: ' + error.message);
        }
    }
    
       /**
     * Gather and sanitize user profile data
     */
    gatherUserProfileData() {
        const profile = { ...this.state.get('userProfile') };
        
        // Gather raw data
        const rawData = {
            ...profile,
            bio: document.getElementById('profileBio').value,
            birthday: document.getElementById('profileBirthday').value,
            height: document.getElementById('profileHeight').value,
            name: this.state.get('currentUser').displayName || profile.name,
            // Ensure all required fields are included
            career: profile.career || '',
            lookingFor: profile.lookingFor || '',
            interests: profile.interests || [],
            photos: profile.photos || []
        };
        
        // Calculate age
        if (rawData.birthday) {
            const today = new Date();
            const birthDate = new Date(rawData.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            rawData.age = age;
        }
        
        // Return raw data - sanitization happens in validator
        return rawData;
    }
    
    /**
     * View my profile
     */
    viewMyProfile() {
        console.log('👤 Viewing my profile');
        this.closeProfileEditor();
        this.navigationManager.showOverlay('myProfileView');
        this.updateMyProfileView();
    }
    
    /**
     * Update my profile view
     */
    updateMyProfileView() {
        const profile = this.state.get('userProfile');
        
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
        
        // Update hero image
        if (profile.photos && profile.photos.length > 0 && profile.photos[0]) {
            document.getElementById('myProfileHero').style.backgroundImage = `url('${profile.photos[0]}')`;
        }
    }
    
    /**
     * Open user profile view
     */
    openUserProfile(user) {
        console.log(`👤 Opening ${user.name}'s profile`);
        this.currentViewedUser = user;
        this.state.set('currentViewedUser', user);
        
        this.navigationManager.showOverlay('userProfileView');
        this.updateUserProfileView(user);
    }
    
    /**
     * Update user profile view
     */
    updateUserProfileView(user) {
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
    }
    
    /**
     * Open business profile editor
     */
    async openBusinessProfileEditor() {
        console.log('🏢 Opening business profile editor');
        this.navigationManager.showOverlay('businessProfileEditor');
        await this.loadBusinessProfileData();
    }
    
    /**
     * Close business profile editor
     */
    closeBusinessProfileEditor() {
        console.log('🔙 Closing business profile editor');
        this.navigationManager.closeOverlay('businessProfileEditor');
    }
    
    /**
     * Load business profile data
     */
    async loadBusinessProfileData() {
        const user = this.state.get('currentUser');
        if (!user) return;
        
        try {
            const businessDoc = await getDoc(doc(this.db, 'businesses', user.uid));
            if (businessDoc.exists()) {
                const businessData = businessDoc.data();
                this.state.set('businessProfile', businessData);
                this.loadBusinessDataIntoForm(businessData);
            }
        } catch (error) {
            console.error('❌ Error loading business profile:', error);
        }
    }
    
    /**
     * Load business data into form
     */
    loadBusinessDataIntoForm(profile) {
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
    }
    
    /**
     * Save business profile
     */
    async saveBusinessProfile() {
        const user = this.state.get('currentUser');
        if (!user) {
            alert('Please log in first');
            return;
        }
        
        try {
            this.navigationManager.showLoading();
            
            // Gather form data
            const businessData = this.gatherBusinessProfileData();
            
            // Add system fields
            businessData.uid = user.uid;
            businessData.email = user.email;
            businessData.updatedAt = serverTimestamp();
            
            // Update status if profile is complete
            if (businessData.name && businessData.description && businessData.type) {
                businessData.status = 'active'; // In real app, this would be 'pending_approval'
            }
            
            // Save to Firebase
            await setDoc(doc(this.db, 'businesses', user.uid), businessData, { merge: true });
            
            // Update local state
            this.state.set('businessProfile', businessData);
            
            console.log('💾 Business profile saved successfully');
            this.navigationManager.hideLoading();
            
            alert('Business profile saved successfully! 🎉 Your business will appear in the feeds.');
            
            // Refresh feeds
            this.closeBusinessProfileEditor();
            if (this.feedManager) {
                await this.feedManager.populateRestaurantFeed();
                await this.feedManager.populateActivityFeed();
            }
            
        } catch (error) {
            console.error('❌ Error saving business profile:', error);
            this.navigationManager.hideLoading();
            alert('Error saving business profile: ' + error.message);
        }
    }
    
    /**
     * Gather business profile data from form
     */
    gatherBusinessProfileData() {
        const profile = { ...this.state.get('businessProfile') };
        
        profile.name = document.getElementById('businessName').value;
        profile.type = document.getElementById('businessType').value;
        profile.description = document.getElementById('businessDescription').value;
        profile.address = document.getElementById('businessAddress').value;
        profile.phone = document.getElementById('businessPhone').value;
        profile.hours = document.getElementById('businessHours').value;
        profile.priceRange = document.getElementById('businessPriceRange').value;
        profile.promoTitle = document.getElementById('businessPromoTitle').value;
        profile.promoDetails = document.getElementById('businessPromoDetails').value;
        
        return profile;
    }
    
    /**
     * Select choice button
     */
    selectChoice(choiceType, value, buttonElement) {
        // Remove active from siblings
        const siblings = buttonElement.parentElement.querySelectorAll('.choice-btn');
        siblings.forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        buttonElement.classList.add('active');
        
        // Update state
        const profileKey = this.state.get('isBusinessProfileEditorOpen') ? 'businessProfile' : 'userProfile';
        const profile = this.state.get(profileKey);
        profile[choiceType] = value;
        this.state.set(profileKey, profile);
        
        console.log(`Selected ${choiceType}: ${value}`);
    }
    
    /**
     * Select choice by value
     */
    selectChoiceByValue(choiceType, value) {
        const btn = document.querySelector(`[data-choice="${choiceType}"][data-value="${value}"]`);
        if (btn) {
            this.selectChoice(choiceType, value, btn);
        }
    }
    
    /**
     * Toggle interest selection
     */
    toggleInterest(buttonElement) {
        const interest = buttonElement.dataset.interest;
        const isActive = buttonElement.classList.contains('active');
        
        const profile = this.state.get('userProfile');
        if (!profile.interests) {
            profile.interests = [];
        }
        
        if (isActive) {
            buttonElement.classList.remove('active');
            profile.interests = profile.interests.filter(i => i !== interest);
        } else {
            if (profile.interests.length < 8) {
                buttonElement.classList.add('active');
                profile.interests.push(interest);
            } else {
                alert('You can select up to 8 interests!');
            }
        }
        
        this.state.set('userProfile', profile);
        console.log('Current interests:', profile.interests);
    }
    
    /**
     * Share my profile
     */
    shareMyProfile() {
        const profile = this.state.get('userProfile');
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
    }
    
    /**
     * Generate referral code
     */
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}
