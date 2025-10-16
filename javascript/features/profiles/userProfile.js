// javascript/features/profiles/userProfile.js

import { sanitizeText } from '../../utils/security.js';
import { profileValidator, sanitizeProfile } from '../../utils/validation.js';

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * User Profile Manager
 * Handles all user profile operations - viewing, editing, saving
 * 
 * RESPONSIBILITIES:
 * - User profile editing (openProfileEditor, saveUserProfile)
 * - User profile viewing (viewMyProfile, openUserProfile)
 * - Profile interactions (choices, interests)
 * - Zodiac calculation
 * - Profile sharing
 */
export class UserProfileManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.photoUploadManager = null;
        this.referralManager = null;
        this.feedManager = null;
        this.userFeedManager = null;
        
        // Track current viewing state
        this.isEditing = false;
        this.currentViewedUser = null;
        
        console.log('✅ [USER-PROFILE] UserProfileManager initialized');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('👤 [USER-PROFILE] setManagers() called');
        
        this.navigationManager = managers.navigation;
        this.photoUploadManager = managers.photoUpload;
        this.referralManager = managers.referral;
        this.feedManager = managers.feed;
        this.userFeedManager = managers.userFeed;
        
        console.log('👤 [USER-PROFILE] Manager references set:', {
            hasNavigation: !!this.navigationManager,
            hasPhotoUpload: !!this.photoUploadManager,
            hasReferral: !!this.referralManager,
            hasFeedManager: !!this.feedManager,
            hasUserFeedManager: !!this.userFeedManager
        });
    }
    
    // ========== PROFILE EDITOR FUNCTIONS ==========
    
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
     * CRITICAL FUNCTION - Contains complex feed refresh logic with 3 fallback paths
     */
    async saveUserProfile() {
        console.log('👤 [SAVE-PROFILE-1] saveUserProfile() called at:', Date.now());
        
        const user = this.state.get('currentUser');
        console.log('👤 [SAVE-PROFILE-1] Current user:', {
            uid: user?.uid,
            email: user?.email,
            displayName: user?.displayName
        });
        
        if (!user) {
            console.error('❌ [SAVE-PROFILE-1] No user found, aborting');
            alert('Please log in first');
            return;
        }
        
        console.log('👤 [SAVE-PROFILE-2] Manager availability:', {
            hasFeedManager: !!this.feedManager,
            hasUserFeedManager: !!this.userFeedManager,
            feedManagerHasUserFeed: !!(this.feedManager?.userFeed)
        });
        
        try {
            // CHECK: Ensure profile document exists
            const userDocRef = doc(this.db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                console.log('📝 Creating initial profile document...');
                // Create base profile first
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || 'User',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    photos: [],
                    interests: [],
                    businessFavorites: [],
                    offerFavorites: []
                });
            }
            
            // Clear previous errors
            profileValidator.clearErrors();
            
            // Gather form data
            const rawProfileData = this.gatherUserProfileData();
            
            // Add name from current user
            const profile = this.state.get('userProfile');
            rawProfileData.name = user.displayName || 
                                 profile.name ||
                                 rawProfileData.name || 
                                 '';
            
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
            
            // FIXED: Ensure required fields for Firebase rules
            if (!profileData.name) {
                profileData.name = 'User';
            }
            if (!profileData.email) {
                profileData.email = user.email;
            }
            
            // SANITIZE: Remove any undefined keys/values before saving
            const sanitizedProfileData = Object.entries(profileData).reduce((acc, [key, value]) => {
                // Only include fields where BOTH key and value are defined
                if (key !== undefined && key !== null && key !== '' &&
                    value !== undefined && value !== null) {
                    acc[key] = value;
                }
                return acc;
            }, {});
            
            console.log('🧹 Sanitized profile data:', sanitizedProfileData);

            // CRITICAL FIX: Remove undefined fields from sanitizedProfileData
            const cleanedData = {};
            for (const [key, value] of Object.entries(sanitizedProfileData)) {
                if (key && key !== 'undefined' && value !== undefined && value !== null) {
                    cleanedData[key] = value;
                }
            }
            
            // Save to Firebase - always use setDoc with merge for safety
            console.log('👤 [SAVE-PROFILE-4] Writing to Firebase at:', Date.now());
            console.log('👤 [SAVE-PROFILE-4] User ID:', user.uid);
            console.log('👤 [SAVE-PROFILE-4] Data keys being saved:', Object.keys(cleanedData));
            
            await setDoc(doc(this.db, 'users', user.uid), cleanedData, { merge: true });
            
            console.log('✅ [SAVE-PROFILE-5] Firebase write successful at:', Date.now());
            
            // Update local state
            this.state.set('userProfile', profileData);
            console.log('✅ [SAVE-PROFILE-5] Local state updated');
            
            console.log('💾 [SAVE-PROFILE-6] Profile saved successfully to Firebase at:', Date.now());
            this.navigationManager.hideLoading();
            
            alert('Profile saved successfully! 🎉 You\'ll now appear in the user feed.');
            
            // Close profile editor
            console.log('👤 [SAVE-PROFILE-7] Closing profile editor at:', Date.now());
            this.closeProfileEditor();
            
            // CRITICAL: Refresh user feed with multiple fallback paths
            console.log('👤 [SAVE-PROFILE-8] Starting feed refresh at:', Date.now());
            console.log('👤 [SAVE-PROFILE-8] Checking manager paths:', {
                path1_userFeedManager: !!this.userFeedManager,
                path2_feedManager_userFeed: !!(this.feedManager?.userFeed),
                path3_window_managers: !!(window.classifiedApp?.managers?.userFeed)
            });
            
            try {
                // Path 1: Direct userFeedManager reference (BEST)
                if (this.userFeedManager && typeof this.userFeedManager.populateUserFeed === 'function') {
                    console.log('✅ [SAVE-PROFILE-8] Using direct userFeedManager reference');
                    await this.userFeedManager.populateUserFeed();
                    console.log('✅ [SAVE-PROFILE-9] Feed refresh completed via path 1 at:', Date.now());
                }
                // Path 2: Through feedManager.userFeed (FALLBACK)
                else if (this.feedManager?.userFeed && typeof this.feedManager.userFeed.populateUserFeed === 'function') {
                    console.log('⚠️ [SAVE-PROFILE-8] Using feedManager.userFeed fallback path');
                    await this.feedManager.userFeed.populateUserFeed();
                    console.log('✅ [SAVE-PROFILE-9] Feed refresh completed via path 2 at:', Date.now());
                }
                // Path 3: Global app instance (EMERGENCY FALLBACK)
                else if (window.classifiedApp?.managers?.userFeed && typeof window.classifiedApp.managers.userFeed.populateUserFeed === 'function') {
                    console.log('⚠️ [SAVE-PROFILE-8] Using global app instance fallback path');
                    await window.classifiedApp.managers.userFeed.populateUserFeed();
                    console.log('✅ [SAVE-PROFILE-9] Feed refresh completed via path 3 at:', Date.now());
                }
                // No valid path found
                else {
                    console.error('❌ [SAVE-PROFILE-9] CRITICAL: No valid path to populateUserFeed found!');
                    console.error('❌ [SAVE-PROFILE-9] Available methods on userFeedManager:', 
                        this.userFeedManager ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.userFeedManager)) : 'null');
                    console.error('❌ [SAVE-PROFILE-9] Feed will NOT refresh - user may not appear in feed');
                }
            } catch (feedError) {
                console.error('❌ [SAVE-PROFILE-9] Feed refresh error:', feedError);
                console.error('❌ [SAVE-PROFILE-9] Error stack:', feedError.stack);
                // Don't throw - profile is saved, just feed didn't refresh
            }
            
            // Show referral code
            console.log('👤 [SAVE-PROFILE-10] Showing referral code at:', Date.now());
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
            zodiac: this.calculateZodiac(document.getElementById('profileBirthday').value),
            showHoroscope: document.getElementById('horoscopeYes')?.classList.contains('active') || false,
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
    
    // ========== PROFILE VIEWING FUNCTIONS ==========
    
    /**
     * View my profile
     */
    viewMyProfile() {
        console.log('👤 Viewing my profile');
        
        // Close any open overlays first
        this.closeProfileEditor();
        this.navigationManager.closeOverlay('settingsOverlay');
        
        // Then open profile view
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
        document.getElementById('myProfileLookingForDetail').textContent = profile.lookingFor || '-';
        
        // Show/hide horoscope based on user preference
        const zodiacItem = document.getElementById('myProfileZodiacItem');
        if (zodiacItem) {
            if (profile.showHoroscope && profile.zodiac) {
                zodiacItem.style.display = 'flex';
                document.getElementById('myProfileZodiacDetail').textContent = profile.zodiac;
            } else {
                zodiacItem.style.display = 'none';
            }
        }
        
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
        
        // Update details
        document.getElementById('userProfileAgeDetail').textContent = user.age || '-';
        document.getElementById('userProfileHeightDetail').textContent = user.height || '-';
        document.getElementById('userProfileCareerDetail').textContent = user.career || '-';
        document.getElementById('userProfileLookingForDetail').textContent = user.lookingFor || '-';
        
        // Show/hide horoscope based on user preference - EXACT SAME LOGIC AS myProfileView
        const zodiacItem = document.getElementById('userProfileZodiacItem');
        if (zodiacItem) {
            if (user.showHoroscope && user.zodiac) {
                zodiacItem.style.display = 'flex';
                document.getElementById('userProfileZodiacDetail').textContent = user.zodiac;
            } else {
                zodiacItem.style.display = 'none';
            }
        }
        
        // Update interests
        const interestsContainer = document.getElementById('userProfileInterests');
        if (interestsContainer && user.interests) {
            interestsContainer.innerHTML = user.interests.map(interest => 
                `<span class="interest-tag">${interest}</span>`
            ).join('');
        }
    }
    
    // ========== PROFILE INTERACTION FUNCTIONS ==========
    
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
        const profile = this.state.get('userProfile');
        profile[choiceType] = value;
        this.state.set('userProfile', profile);
        
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
    
    // ========== ZODIAC FUNCTIONS ==========
    
    /**
     * Calculate zodiac sign from birthday
     */
    calculateZodiac(birthday) {
        if (!birthday) return null;
        
        const date = new Date(birthday);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        
        const zodiacSigns = [
            { sign: '♑ Capricorn', start: [12, 22], end: [1, 19] },
            { sign: '♒ Aquarius', start: [1, 20], end: [2, 18] },
            { sign: '♓ Pisces', start: [2, 19], end: [3, 20] },
            { sign: '♈ Aries', start: [3, 21], end: [4, 19] },
            { sign: '♉ Taurus', start: [4, 20], end: [5, 20] },
            { sign: '♊ Gemini', start: [5, 21], end: [6, 20] },
            { sign: '♋ Cancer', start: [6, 21], end: [7, 22] },
            { sign: '♌ Leo', start: [7, 23], end: [8, 22] },
            { sign: '♍ Virgo', start: [8, 23], end: [9, 22] },
            { sign: '♎ Libra', start: [9, 23], end: [10, 22] },
            { sign: '♏ Scorpio', start: [10, 23], end: [11, 21] },
            { sign: '♐ Sagittarius', start: [11, 22], end: [12, 21] }
        ];
        
        for (const { sign, start, end } of zodiacSigns) {
            const [startMonth, startDay] = start;
            const [endMonth, endDay] = end;
            
            if (startMonth === endMonth) {
                if (month === startMonth && day >= startDay && day <= endDay) return sign;
            } else {
                if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
                    return sign;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Update zodiac display based on birthday
     */
    updateZodiacDisplay() {
        const birthday = document.getElementById('profileBirthday')?.value;
        const zodiacDisplay = document.getElementById('calculatedZodiac');
        const showHoroscope = document.getElementById('horoscopeYes')?.classList.contains('active');
        
        if (!zodiacDisplay) return;
        
        if (birthday && showHoroscope) {
            const zodiac = this.calculateZodiac(birthday);
            zodiacDisplay.textContent = zodiac ? `Your sign: ${zodiac}` : '';
        } else {
            zodiacDisplay.textContent = '';
        }
    }
    
    // ========== UTILITY FUNCTIONS ==========
    
    /**
     * Share my profile
     */
    shareMyProfile() {
        const profileUrl = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: 'My CLASSIFIED Profile',
                text: 'Check out my profile on CLASSIFIED Hoi An! 🌟',
                url: profileUrl
            });
        } else {
            // Copy ONLY the URL, no message
            navigator.clipboard.writeText(profileUrl);
            alert(`✅ Link copied!\n\n${profileUrl}`);
        }
    }
    
    /**
     * Generate referral code
     */
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}
