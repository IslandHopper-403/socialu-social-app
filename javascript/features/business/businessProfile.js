// javascript/features/business/businessProfile.js

import { sanitizeText, escapeHtml } from '../../utils/security.js';

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Business Profile Manager
 * Handles business profile viewing, editing, and marketing tools
 * 
 * RESPONSIBILITIES:
 * - Profile display (updateBusinessProfileUI, closeBusinessProfile)
 * - Photo management (addPhotoCounter, openPhotoViewer, closePhotoViewer)
 * - Profile editing (openBusinessProfileEditor, saveBusinessProfile)
 * - Marketing tools (QR codes, CSV export, social templates, mass upload)
 */
export class BusinessProfileManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // Manager references (set later)
        this.navigationManager = null;
        this.authManager = null;
        this.storyManager = null;
        this.analyticsManager = null;  // 🆕 For tracking business views
        
        // Mock data reference (for business lookups)
        this.mockData = null;  // 🆕 Set via setManagers
        
        // Instance variables for cleanup
        this.photoViewerListeners = null;
        this.specialsInterval = null;
        
        console.log('✅ [BUSINESS-PROFILE] BusinessProfileManager initialized');
    }
    
   /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.authManager = managers.auth;
        this.storyManager = managers.businessStory;
        
        // 🆕 Get analytics manager from parent business manager
        this.analyticsManager = managers.business?.analytics;
        
        // 🆕 Get mock data from parent business manager
        this.mockData = managers.business?.mockData;
        
        console.log('✅ [BUSINESS-PROFILE] Manager references set:', {
            navigation: !!this.navigationManager,
            auth: !!this.authManager,
            story: !!this.storyManager,
            analytics: !!this.analyticsManager,
            mockData: !!this.mockData
        });
    }
    
    // ========== PROFILE DISPLAY FUNCTIONS ==========
    
    /**
     * Update business profile UI
     * SECURITY: All user content sanitized
     */
    updateBusinessProfileUI(business) {
        console.log('🏢 [BUSINESS-PROFILE] Updating profile UI for:', business?.name);
        
        // Safety check
        if (!business) {
            console.error('❌ [BUSINESS-PROFILE] No business data provided');
            return;
        }
        
        // Clean up old special offer dots from previous profiles
        document.querySelectorAll('.special-dot').forEach(dot => dot.parentElement?.remove());
        
        // Update header - SAFE
        const headerTitle = document.getElementById('profileHeaderTitle');
        if (headerTitle) {
            headerTitle.textContent = sanitizeText(business.type || 'Business');
        }
        
        // Update hero - SAFE (CSS background) 
        const heroElement = document.getElementById('profileHero');
        const imageUrl = business.photos?.[0] || business.image || business.story;
        console.log('🖼️ [BUSINESS-PROFILE] Setting hero image:', imageUrl);
        
        if (heroElement && imageUrl) {
            heroElement.style.backgroundImage = `url('${escapeHtml(imageUrl)}')`;
            heroElement.style.backgroundSize = 'cover';
            heroElement.style.backgroundPosition = 'center';
        }
        
        // Add story avatar to hero (delegate to story manager)
        if (this.storyManager) {
            this.storyManager.addStoryAvatarToHero(business, heroElement);
        }
        
        // Add photo counter
        this.addPhotoCounter(business);
                
        // Update basic info - SAFE
        document.getElementById('profileName').textContent = sanitizeText(business.name || 'Business Name');
        document.getElementById('profileType').textContent = sanitizeText(business.type || 'Business Type');
        
        // Update rating display
        const starsElement = document.querySelector('#businessProfile .stars');
        const ratingSpan = document.querySelector('#businessProfile .profile-rating span');
        if (business.rating && starsElement) {
            // Display filled stars based on rating
            const fullStars = Math.floor(business.rating);
            const hasHalfStar = business.rating % 1 >= 0.5;
            let starsHTML = '★'.repeat(fullStars);
            if (hasHalfStar && fullStars < 5) {
                starsHTML += '☆';
                starsHTML += '☆'.repeat(4 - fullStars);
            } else {
                starsHTML += '☆'.repeat(5 - fullStars);
            }
            starsElement.textContent = starsHTML;
            starsElement.style.color = '#FFD700'; // Gold color for stars
        }
        
        if (business.reviewCount && ratingSpan) {
            ratingSpan.textContent = `${business.rating || 0} (${business.reviewCount} reviews)`;
        }
        
        // Update promotion - SAFE
        if (business.currentSpecials && business.currentSpecials.length > 0) {
            const promoTitle = document.getElementById('profilePromoTitle');
            const promoDetails = document.getElementById('profilePromoDetails');
            
            if (promoTitle && promoDetails) {
                // Set title
                promoTitle.textContent = 'Special Offer';
                
                // Create rotating specials
                let currentSpecialIndex = 0;
                const specials = business.currentSpecials;
                
                // Display first special
                promoDetails.textContent = sanitizeText(specials[0]);
                promoDetails.style.transition = 'opacity 0.5s ease-in-out';
                promoDetails.style.opacity = '1'; // Ensure it's visible
                
                // Add indicator dots if multiple specials
                if (specials.length > 1) {
                    const dotsContainer = document.createElement('div');
                    dotsContainer.style.cssText = `
                        text-align: center;
                        margin-top: 10px;
                    `;
                    
                    specials.forEach((_, index) => {
                        const dot = document.createElement('span');
                        dot.style.cssText = `
                            display: inline-block;
                            width: 6px;
                            height: 6px;
                            border-radius: 50%;
                            margin: 0 3px;
                            background: ${index === 0 ? 'white' : 'rgba(255,255,255,0.4)'}; 
                            transition: background 0.3s ease;
                        `;
                        dot.className = 'special-dot';
                        dotsContainer.appendChild(dot);
                    });
                    
                    promoDetails.parentElement.appendChild(dotsContainer);
                    
                    // Auto-rotate specials
                    const rotateSpecials = setInterval(() => {
                        // Fade out
                        promoDetails.style.opacity = '0';
                        
                        setTimeout(() => {
                            // Update index
                            currentSpecialIndex = (currentSpecialIndex + 1) % specials.length;
                            
                            // Update text
                            promoDetails.textContent = sanitizeText(specials[currentSpecialIndex]);
                            
                            // Update dots if they exist and dotsContainer is in scope
                            const dots = promoDetails.parentElement.querySelector('.special-dot')?.parentElement;
                            if (dots) {
                                dots.querySelectorAll('.special-dot').forEach((dot, i) => {
                                    dot.style.background = i === currentSpecialIndex ? 'white' : 'rgba(255,255,255,0.4)';
                                });
                            }
                                                        
                            // Fade in
                            promoDetails.style.opacity = '1';
                        }, 500);
                    }, 4000);
                    
                    // Store interval ID for cleanup
                    this.specialsInterval = rotateSpecials;
                }
            }
        } else if (business.promo) {
            document.getElementById('profilePromoTitle').textContent = sanitizeText(business.promo);
            document.getElementById('profilePromoDetails').textContent = sanitizeText(business.details || '');
        } else if (business.promoTitle) {
            document.getElementById('profilePromoTitle').textContent = sanitizeText(business.promoTitle);
            document.getElementById('profilePromoDetails').textContent = sanitizeText(business.promoDetails || '');
        }
        
        // Update description - SAFE
        document.getElementById('profileDescription').textContent = 
            sanitizeText(business.description || 'A great place to visit in Hoi An');
        
        // Update details - SAFE
        document.getElementById('profileLocation').textContent = 
            sanitizeText(business.location || business.address || 'Hoi An');
        document.getElementById('profileHours').textContent = 
            sanitizeText(business.hours || 'Check for current hours');
        document.getElementById('profilePrice').textContent = 
            sanitizeText(business.price || business.priceRange || '$$ - Moderate');
        document.getElementById('profileContact').textContent = 
            sanitizeText(business.contact || business.phone || 'Contact for details');
        
        console.log('✅ [BUSINESS-PROFILE] Profile UI updated successfully');
    }
    
    /**
     * Close business profile
     */
    closeBusinessProfile() {
        console.log('🔙 [BUSINESS-PROFILE] Closing business profile');
        
        // Clear business state first
        this.state.set('currentBusiness', null);

        // Clear any rotating specials interval
        if (this.specialsInterval) {
            clearInterval(this.specialsInterval);
            this.specialsInterval = null;
        }
        
        // Close the overlay
        this.navigationManager.closeOverlay('businessProfile');
        
        // SIMPLE: Always return to current feed screen
        const currentScreen = this.state.get('currentScreen') || 'restaurant';
        this.navigationManager.showScreen(currentScreen, false);
       console.log('📱 [BUSINESS-PROFILE] Returned to', currentScreen, 'feed');
}

// ========== BUSINESS PROFILE OPENING & LOOKUP ==========
    
    /**
     * Open business profile by slug or ID
     * Tries slug lookup first, then falls back to regular ID
     */
    async openBusinessProfileBySlugOrId(slugOrId, businessType = 'restaurant') {
        console.log('🔍 [BUSINESS-PROFILE] Looking up business by slug/ID:', slugOrId);
        
        // First, try to find by slug
        const business = await this.findBusinessBySlug(slugOrId);
        
        if (business) {
            console.log('✅ [BUSINESS-PROFILE] Found business by slug:', business.name);
            return this.openBusinessProfile(business, businessType);
        }
        
        // Fallback: try as regular ID
        console.log('🔄 [BUSINESS-PROFILE] Trying as regular ID...');
        return this.openBusinessProfile(slugOrId, businessType);
    }
    
    /**
     * Find business by slug
     * Searches both mock data and Firebase
     */
    async findBusinessBySlug(slug) {
        console.log('🔎 [BUSINESS-PROFILE] Searching for slug:', slug);
        
        // Search in mock data (if available)
        if (window.classifiedApp && window.classifiedApp.mockData) {
            const mockData = window.classifiedApp.mockData;
            
            // Search restaurants
            const restaurants = mockData.getRestaurants?.() || [];
            for (const restaurant of restaurants) {
                if (this.createBusinessSlug(restaurant) === slug) {
                    console.log('✅ [BUSINESS-PROFILE] Found in restaurants:', restaurant.name);
                    return restaurant;
                }
            }
            
            // Search activities
            const activities = mockData.getActivities?.() || [];
            for (const activity of activities) {
                if (this.createBusinessSlug(activity) === slug) {
                    console.log('✅ [BUSINESS-PROFILE] Found in activities:', activity.name);
                    return activity;
                }
            }
        }
        
        // Search in Firebase (if needed)
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
            const snapshot = await getDocs(collection(this.db, 'businesses'));
            
            for (const doc of snapshot.docs) {
                const business = { id: doc.id, ...doc.data() };
                if (this.createBusinessSlug(business) === slug) {
                    console.log('✅ [BUSINESS-PROFILE] Found in Firebase:', business.name);
                    return business;
                }
            }
        } catch (error) {
            console.error('❌ [BUSINESS-PROFILE] Error searching businesses:', error);
        }
        
        console.log('📭 [BUSINESS-PROFILE] No business found for slug:', slug);
        return null;
    }
    
    /**
     * Open business profile (main method)
     * Handles both full business objects and business IDs
     */
    async openBusinessProfile(businessDataOrId, businessType) {
        let businessData;
        let businessId;
        
        // Handle both full object and ID
        if (typeof businessDataOrId === 'object' && businessDataOrId !== null) {
            businessData = businessDataOrId;
            businessId = businessData.id || businessData.uid;
        } else {
            businessId = businessDataOrId;
            businessData = null; // Will fetch below
        }
        
        console.log(`🏢 [BUSINESS-PROFILE] Opening ${businessType} profile:`, businessId);
        window.currentBusinessProfileId = businessId;
        
        try {
            this.navigationManager.showLoading();
            
            // FIXED: Only fetch if we don't already have business data from feed
            if (!businessData) {
                // Try to fetch from Firebase first
                businessData = await this.fetchBusinessFromFirebase(businessId);
                
                // Fallback to mock data
                if (!businessData) {
                    businessData = this.getBusinessFromMockData(businessId, businessType);
                }
            }
            
            if (!businessData) {
                console.error('❌ [BUSINESS-PROFILE] Business not found for ID:', businessId);
                
                // DEBUG logging for troubleshooting
                const mockData = window.classifiedApp?.mockData;
                if (mockData) {
                    const restaurants = mockData.getRestaurants?.() || [];
                    const activities = mockData.getActivities?.() || [];
                    console.log('📊 [BUSINESS-PROFILE] Available restaurant IDs:', restaurants.map(r => ({ id: r.id, name: r.name })));
                    console.log('📊 [BUSINESS-PROFILE] Available activity IDs:', activities.map(a => ({ id: a.id, name: a.name })));
                    console.log('🔍 [BUSINESS-PROFILE] Looking for ID:', businessId);
                    
                    const foundRestaurant = restaurants.find(r => r.id === businessId);
                    const foundActivity = activities.find(a => a.id === businessId);
                    console.log('🔍 [BUSINESS-PROFILE] Found in restaurants?', foundRestaurant);
                    console.log('🔍 [BUSINESS-PROFILE] Found in activities?', foundActivity);
                }
                
                alert(`Business not found (ID: ${businessId})`);
                this.navigationManager.hideLoading();
                return;
            }
            
            // Update state
            this.state.set('currentBusiness', businessData);
            
            // Update UI
            this.updateBusinessProfileUI(businessData);
            
            // Track that business profile came from feed
            if (this.navigationManager) {
                // Clear any previous overlay stack issues
                const stackIndex = this.navigationManager.overlayStack.indexOf('businessProfile');
                if (stackIndex > -1) {
                    this.navigationManager.overlayStack.splice(stackIndex, 1);
                }
                this.navigationManager.showOverlay('businessProfile');
            } else {
                // Fallback if navigation manager not available
                const profileOverlay = document.getElementById('businessProfile');
                if (profileOverlay) {
                    profileOverlay.classList.add('show');
                }
            }
            
            // Track view - delegate to analytics manager (if available)
            if (this.analyticsManager) {
                await this.analyticsManager.trackBusinessView(businessId);
            } else {
                console.log('⚠️ [BUSINESS-PROFILE] Analytics manager not available, skipping view tracking');
            }
            
            this.navigationManager.hideLoading();
            
        } catch (error) {
            console.error('❌ [BUSINESS-PROFILE] Error opening business profile:', error);
            this.navigationManager.hideLoading();
            alert('Failed to load business profile');
        }
    }
    
    /**
     * Fetch business from Firebase
     */
    async fetchBusinessFromFirebase(businessId) {
        console.log('🔥 [BUSINESS-PROFILE] Fetching business from Firebase:', businessId);
        
        try {
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
            const businessDoc = await getDoc(doc(this.db, 'businesses', businessId));
            
            if (businessDoc.exists()) {
                console.log('✅ [BUSINESS-PROFILE] Business found in Firebase');
                return { id: businessDoc.id, ...businessDoc.data() };
            }
        } catch (error) {
            console.error('❌ [BUSINESS-PROFILE] Error fetching business:', error);
        }
        
        console.log('📭 [BUSINESS-PROFILE] Business not found in Firebase');
        return null;
    }
    
    /**
     * Get business from mock data
     */
    getBusinessFromMockData(businessId, businessType) {
        console.log('🎭 [BUSINESS-PROFILE] Fetching business from mock data:', businessId);
        
        // Access mock data through the app instance
        if (window.classifiedApp && window.classifiedApp.mockData) {
            const mockData = window.classifiedApp.mockData;
            
            // Try to find in restaurants first
            const restaurant = mockData.getRestaurantById(businessId);
            if (restaurant) {
                console.log('✅ [BUSINESS-PROFILE] Found in mock restaurants:', restaurant.name);
                return restaurant;
            }
            
            // Then try activities
            const activity = mockData.getActivityById(businessId);
            if (activity) {
                console.log('✅ [BUSINESS-PROFILE] Found in mock activities:', activity.name);
                return activity;
            }
        }
        
        console.log('📭 [BUSINESS-PROFILE] Business not found in mock data');
        return null;
    }
    
      
  // ========== PHOTO MANAGEMENT FUNCTIONS ==========
    
    /**
     * Add photo counter to hero image
     */
    addPhotoCounter(business) {
        const heroElement = document.getElementById('profileHero');
        if (!heroElement || !business.photos || business.photos.length <= 1) return;
        
        // Remove existing counter if any
        const existingCounter = heroElement.querySelector('.hero-photo-counter');
        if (existingCounter) existingCounter.remove();
        
        // Add new counter
        const counter = document.createElement('div');
        counter.className = 'hero-photo-counter';
        counter.textContent = `1/${business.photos.length}`;
        counter.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 13px;
            font-weight: 500;
        `;
        heroElement.appendChild(counter);
        
        // Make hero clickable
        heroElement.style.cursor = 'pointer';
        heroElement.onclick = () => {
            const currentBusiness = this.state.get('currentBusiness');
            if (currentBusiness) {
                this.openPhotoViewer(currentBusiness);
            }
        };
        
        console.log('📸 [BUSINESS-PROFILE] Photo counter added');
    }
    
    /**
     * Open photo viewer
     */
    openPhotoViewer(business) {
        if (!business.photos || business.photos.length === 0) return;
        
        console.log('📸 [BUSINESS-PROFILE] Opening photo viewer');
        
        const viewer = document.getElementById('photoViewer');
        const swiper = document.getElementById('photoSwiper');
        const counter = document.getElementById('photoCounter');
        
        // Clear existing photos
        swiper.innerHTML = '';
        
        // Add all photos
        business.photos.forEach((photo, index) => {
            const slide = document.createElement('div');
            slide.className = 'photo-slide';
            slide.innerHTML = `<img src="${escapeHtml(photo)}" alt="${business.name} photo ${index + 1}">`;
            swiper.appendChild(slide);
        });
        
        // Initialize swipe tracking
        let currentIndex = 0;
        counter.textContent = `1/${business.photos.length}`;
        
      // Touch/swipe handling - restored simple working logic + click detection
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        console.log('🖼️ [PHOTO-VIEWER] Initializing navigation for', business.photos.length, 'photos');
        
        const updateSlide = (index) => {
            swiper.style.transform = `translateX(-${index * 100}%)`;
            counter.textContent = `${index + 1}/${business.photos.length}`;
            currentIndex = index;
            console.log('📸 [PHOTO-VIEWER] Navigated to photo', index + 1);
        };
        
        const handleStart = (e) => {
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            currentX = startX; // Initialize currentX to startX
            isDragging = true;
            console.log('🖱️ [PHOTO-VIEWER] Start at X:', startX);
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Always prevent default (like old working version)
            currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            console.log('🖱️ [PHOTO-VIEWER] Moving, diff:', (currentX - startX).toFixed(0));
        };
        
        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentX - startX;
            console.log('🏁 [PHOTO-VIEWER] End, total diff:', diff.toFixed(0));
            
          // SIMPLE LOGIC: Small movement = click, large movement = swipe
            if (Math.abs(diff) < 10) {
                // CLICK NAVIGATION (moved < 10px)
                // Use parent container for accurate measurements (swiper has transforms)
                const viewer = document.querySelector('.photo-viewer-content');
                const rect = viewer.getBoundingClientRect();
                const clickPosition = currentX - rect.left;
                const clickPercent = clickPosition / rect.width;
                
                console.log('👆 [PHOTO-VIEWER] Click detected at', (clickPercent * 100).toFixed(0), '%');
                
                // Left half = previous, right half = next
                if (clickPercent < 0.5 && currentIndex > 0) {
                    console.log('⬅️ [PHOTO-VIEWER] Click left -> previous photo');
                    updateSlide(currentIndex - 1);
                } else if (clickPercent >= 0.5 && currentIndex < business.photos.length - 1) {
                    console.log('➡️ [PHOTO-VIEWER] Click right -> next photo');
                    updateSlide(currentIndex + 1);
                } else {
                    console.log('⚠️ [PHOTO-VIEWER] At boundary, no navigation');
                }
            } else if (Math.abs(diff) > 50) {
                // SWIPE NAVIGATION (moved > 50px)
                console.log('🔄 [PHOTO-VIEWER] Swipe detected, diff:', diff);
                
                if (diff > 0 && currentIndex > 0) {
                    console.log('⬅️ [PHOTO-VIEWER] Swipe right -> previous photo');
                    updateSlide(currentIndex - 1);
                } else if (diff < 0 && currentIndex < business.photos.length - 1) {
                    console.log('➡️ [PHOTO-VIEWER] Swipe left -> next photo');
                    updateSlide(currentIndex + 1);
                } else {
                    console.log('⚠️ [PHOTO-VIEWER] At boundary, no navigation');
                }
            } else {
                // DEAD ZONE (moved 10-50px) - ignore, might be accidental
                console.log('⚪ [PHOTO-VIEWER] Movement too small for swipe, too large for click');
            }
        };
        
        // Store listeners for cleanup
        this.photoViewerListeners = {
            touchstart: handleStart,
            touchmove: handleMove,
            touchend: handleEnd,
            mousedown: handleStart,
            mousemove: handleMove,
            mouseup: handleEnd,
            mouseleave: handleEnd
        };
        
        // Add event listeners
        swiper.addEventListener('touchstart', this.photoViewerListeners.touchstart, { passive: true });
        swiper.addEventListener('touchmove', this.photoViewerListeners.touchmove, { passive: false });
        swiper.addEventListener('touchend', this.photoViewerListeners.touchend, { passive: true });
        swiper.addEventListener('mousedown', this.photoViewerListeners.mousedown, { passive: false });
        swiper.addEventListener('mousemove', this.photoViewerListeners.mousemove, { passive: false });
        swiper.addEventListener('mouseup', this.photoViewerListeners.mouseup, { passive: true });
        swiper.addEventListener('mouseleave', this.photoViewerListeners.mouseleave, { passive: true });
        
        // Show viewer
        viewer.classList.add('show');
        console.log('✅ [BUSINESS-PROFILE] Photo viewer opened');
    }
    
    /**
     * Close photo viewer
     */
    closePhotoViewer() {
        console.log('🔙 [BUSINESS-PROFILE] Closing photo viewer');
        
        const viewer = document.getElementById('photoViewer');
        const swiper = document.getElementById('photoSwiper');
        
        // Clean up event listeners
        if (this.photoViewerListeners && swiper) {
            Object.entries(this.photoViewerListeners).forEach(([event, handler]) => {
                swiper.removeEventListener(event, handler);
            });
            this.photoViewerListeners = null;
        }
        
        viewer.classList.remove('show');
        console.log('✅ [BUSINESS-PROFILE] Photo viewer closed');
    }
    
    // ========== PROFILE EDITING FUNCTIONS ==========
    
    /**
     * Open business profile editor
     */
    async openBusinessProfileEditor() {
        console.log('🏢 [BUSINESS-PROFILE] Opening business profile editor');
        this.navigationManager.showOverlay('businessProfileEditor');
        await this.loadBusinessProfileData();
    }
    
    /**
     * Close business profile editor
     */
    closeBusinessProfileEditor() {
        console.log('🔙 [BUSINESS-PROFILE] Closing business profile editor');
        this.navigationManager.closeOverlay('businessProfileEditor');
    }
    
    /**
     * Load business profile data
     */
    async loadBusinessProfileData() {
        const user = this.state.get('currentUser');
        if (!user) return;
        
        console.log('📥 [BUSINESS-PROFILE] Loading business profile data');
        
        try {
            const businessDoc = await getDoc(doc(this.db, 'businesses', user.uid));
            if (businessDoc.exists()) {
                const businessData = businessDoc.data();
                this.state.set('businessProfile', businessData);
                this.loadBusinessDataIntoForm(businessData);
                console.log('✅ [BUSINESS-PROFILE] Business profile data loaded');
            }
        } catch (error) {
            console.error('❌ [BUSINESS-PROFILE] Error loading business profile:', error);
        }
    }
    
    /**
     * Load business data into form
     */
    loadBusinessDataIntoForm(profile) {
        console.log('📝 [BUSINESS-PROFILE] Populating form fields');
        
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
        
        console.log('✅ [BUSINESS-PROFILE] Form populated successfully');
    }
    
    /**
     * Save business profile
     * FIXED: Removed broken validation reference
     */
    async saveBusinessProfile() {
        const user = this.state.get('currentUser');
        if (!user) {
            alert('Please log in first');
            return;
        }
        
        console.log('💾 [BUSINESS-PROFILE] Saving business profile');
        
        try {
            this.navigationManager.showLoading();
            
            // Gather form data
            const businessData = this.gatherBusinessProfileData();
            
            // Add system fields
            businessData.uid = user.uid;
            businessData.email = user.email;
            businessData.updatedAt = serverTimestamp();
            
            // Get current status from state (preserves existing status)
            const currentProfile = this.state.get('businessProfile');
            if (currentProfile && currentProfile.status) {
                businessData.status = currentProfile.status;
            } else {
                // Fallback for new businesses - use pending_approval
                businessData.status = 'pending_approval';
            }
            
            // Save to Firebase
            await setDoc(doc(this.db, 'businesses', user.uid), businessData, { merge: true });
            
            // Update local state
            this.state.set('businessProfile', businessData);
            
            console.log('✅ [BUSINESS-PROFILE] Business profile saved successfully');
            this.navigationManager.hideLoading();
            
            alert('Business profile saved successfully! 🎉 Your business will appear in the feeds.');
            
            // Close editor
            this.closeBusinessProfileEditor();
            
        } catch (error) {
            console.error('❌ [BUSINESS-PROFILE] Error saving business profile:', error);
            this.navigationManager.hideLoading();
            alert('Error saving business profile: ' + error.message);
        }
    }
    
    /**
     * Gather business profile data from form
     */
    gatherBusinessProfileData() {
        console.log('📋 [BUSINESS-PROFILE] Gathering form data');
        
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
    
    // ========== MARKETING TOOLS ==========
    
    /**
     * Create clean URL slug from business name
     */
    createBusinessSlug(business) {
        if (!business) return '';
        
        // Use business name to create slug
        const name = business.name || business.businessName || '';
        
        // Create clean slug: "Moon Restaurant" → "moonrestaurant"
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '') // Remove all non-alphanumeric chars
            .trim();
        
        // Fallback to ID if slug is empty
        return slug || business.id;
    }
    
    /**
     * Share business profile
     */
    shareBusinessProfile() {
        const business = this.state.get('currentBusiness');
        if (!business) return;
        
        console.log('📤 [BUSINESS-PROFILE] Sharing business profile:', business.name);
        
        // Create clean slug from business name
        const slug = this.createBusinessSlug(business);
        
        // Create direct URL to business profile
        const businessUrl = `${window.location.origin}${window.location.pathname}#business/${slug}`;
        
        if (navigator.share) {
            // Native share (mobile)
            navigator.share({
                title: business.name,
                text: `Check out ${business.name} on CLASSIFIED Hoi An!`,
                url: businessUrl
            }).catch(err => console.log('Share cancelled'));
        } else {
            // Clipboard fallback - URL ONLY
            navigator.clipboard.writeText(businessUrl).then(() => {
                alert(`✅ Link copied!\n\n${businessUrl}`);
            }).catch(err => {
                console.error('Copy failed:', err);
                alert('Unable to share. Please copy the URL manually.');
            });
        }
    }
    
    /**
     * Get directions to business
     */
    getDirections() {
        const business = this.state.get('currentBusiness');
        if (!business) return;
        
        console.log('🗺️ [BUSINESS-PROFILE] Opening directions for:', business.name);
        
        const address = business.location || business.address || business.name;
        const encodedAddress = encodeURIComponent(`${address}, Hoi An, Vietnam`);
        
        // Open Google Maps
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
    
    /**
     * Generate direct URL for any business (for outreach/marketing)
     */
    generateBusinessURL(businessId) {
        return `${window.location.origin}${window.location.pathname}#business/${businessId}`;
    }
    
    /**
     * Generate business URLs in multiple formats - REAL DATA ONLY
     * @param {string} format - 'csv', 'qr', 'social', or 'console'
     * @param {string} category - Category filter ('all', 'restaurant', 'activity')
     */
    async generateAllBusinessURLs(format = 'csv', category = 'all') {
        console.log(`📋 [BUSINESS-PROFILE] Generating business URLs (${format} format, ${category})...`);
        console.log('⚠️ REAL DATA ONLY - No mock data, no placeholders');
        
        // Collect ONLY real businesses from Firebase
        let businesses = [];
        
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
            const snapshot = await getDocs(collection(this.db, 'businesses'));
            
            if (snapshot.empty) {
                console.warn('⚠️ No businesses found in Firebase!');
                alert('❌ No businesses found in database.\n\nBusinesses must sign up first before generating marketing materials.');
                return;
            }
            
            snapshot.forEach(doc => {
                const b = doc.data();
                
                // ONLY skip if completely missing name (can't identify the business)
                if (!b.name) {
                    console.warn(`⚠️ Skipping business ${doc.id} - missing business name`);
                    return; // Skip this business
                }
                
                // DEBUG: Log what data exists (but don't skip if missing)
                console.log(`📱 Business: ${b.name}`);
                console.log(`   Contact Email: ${b.email || '⚠️ NONE'}`);
                console.log(`   Auth Email: ${b.authEmail || 'N/A'}`);
                console.log(`   Has Real Email: ${b.hasRealEmail ? 'YES ✅' : 'NO ❌'}`);
                console.log(`   Phone: ${b.phone || '⚠️ NONE'}`);
                console.log(`   ZaloID: ${b.zaloId || '⚠️ NONE'}`);
                console.log(`---`);
                
                const slug = this.createBusinessSlug(b);
                
                businesses.push({
                    name: b.name,
                    email: b.email,
                    phone: b.phone || '',
                    zaloId: b.zaloId || b.phone || '',
                    type: b.type || 'Business',
                    category: b.category || b.type || 'General',
                    url: `${window.location.origin}${window.location.pathname}#business/${slug}`,
                    shareUrl: `${window.location.origin}${window.location.pathname}#business/${slug}`,
                    location: b.location || b.address || 'Hoi An, Vietnam',
                    description: b.description || '',
                    currentSpecials: b.currentSpecials || [],
                    aboutUs: b.aboutUs || b.about || b.description || '',
                    id: doc.id
                });
            });
            
            console.log(`✅ Found ${businesses.length} valid businesses with complete data`);
            
            if (businesses.length === 0) {
                alert('❌ No valid businesses found.\n\nAll businesses must have:\n• Business name\n• Email address\n\nPlease ensure businesses complete their profiles.');
                return;
            }
            
        } catch (error) {
            console.error('❌ Failed to fetch businesses from Firebase:', error);
            alert('Failed to fetch businesses from database: ' + error.message);
            return;
        }
        
        // Filter by category if specified
        if (category !== 'all') {
            const categoryLower = category.toLowerCase();
            const beforeFilter = businesses.length;
            
            businesses = businesses.filter(b => {
                const type = b.type.toLowerCase();
                const cat = b.category.toLowerCase();
                return type.includes(categoryLower) || cat.includes(categoryLower);
            });
            
            console.log(`📊 Filtered from ${beforeFilter} to ${businesses.length} ${category} businesses`);
            
            if (businesses.length === 0) {
                alert(`❌ No businesses found in category: ${category}\n\nTry "all" to see all businesses.`);
                return;
            }
        }
        
        // Route to correct format
        switch(format) {
            case 'csv':
                return this.exportBusinessCSV(businesses);
            case 'qr':
                return this.generateQRCodes(businesses);
            case 'social':
                return this.generateSocialTemplates(businesses);
            default:
                return this.exportBusinessCSV(businesses);
        }
    }
    
    /**
     * Export businesses as CSV optimized for multi-channel marketing
     * REAL DATA ONLY - No placeholders or generated content
     * Supports: YAMM (Email), WhatsApp, SMS, Zalo
     */
    exportBusinessCSV(businesses) {
        console.log('📊 [BUSINESS-PROFILE] Exporting CSV for', businesses.length, 'businesses');
        
        // Multi-channel marketing optimized columns
        const csvRows = [
            [
                'Email',              // Column A - YAMM email campaigns (REQUIRED)
                'PhoneNumber',        // Column B - SMS/WhatsApp/Zalo (optional)
                'WhatsAppNumber',     // Column C - WhatsApp international format (optional)
                'ZaloID',             // Column D - Zalo messaging (optional)
                'BusinessName',       // Column E - {{BusinessName}} merge tag
                'ProfileURL',         // Column F - {{ProfileURL}} merge tag
                'ShortURL',           // Column G - Short link for SMS
                'ContactName',        // Column H - Personalization
                'Category',           // Column I - Segmentation
                'Type',               // Column J - Segmentation
                'Location',           // Column K - Geographic targeting
                'Description',        // Column L - Short description for outreach
                'AboutUs',            // Column M - Full About Us section for verification
                'Promotion1',         // Column N - First promotion from currentSpecials[0]
                'Promotion2',         // Column O - Second promotion from currentSpecials[1]
                'Promotion3',         // Column P - Third promotion from currentSpecials[2]
                'BusinessId',         // Column Q - Tracking
                'JoinDate',           // Column R - Engagement timing
                'Status',             // Column S - Campaign filtering
                'PreferredChannel'    // Column T - Communication preference
            ],
            ...businesses.map(b => {
                // ONLY use real contact emails (filter out fake auth emails)
                const isFakeEmail = !b.email || 
                                   b.email.includes('@business.com') ||
                                   b.email.includes('noemail') || 
                                   b.email === '';
                
                const email = (b.hasRealEmail === false) ? '' : 
                             (isFakeEmail ? '' : b.email);
                
                // Filter out fake/test phone numbers
                const isFakePhone = b.phone && (
                    b.phone.includes('123 4567') ||
                    b.phone === '+84 90 123 4567' ||
                    b.phone === '+84 905 123 456' ||
                    b.phone.match(/^\+84\s?90[0-9]\s?123\s?456[0-9]$/)
                );
                
                const phoneNumber = (b.phone && !isFakePhone) ? b.phone : '';
                const whatsAppNumber = phoneNumber ? phoneNumber.replace(/\s+/g, '') : '';
                const zaloID = b.zaloId || phoneNumber || '';
                
                // Extract contact name from business name
                const contactName = b.name
                    .replace(/\s+(Restaurant|Hotel|Café|Cafe|Bar|Spa|Shop|Store|Gallery|Studio|Team|&.*$).*$/i, '')
                    .trim() || b.name;
                
                const shortURL = b.url.replace(`${window.location.origin}${window.location.pathname}#business/`, 'socialu.app/b/');
                
                let preferredChannel = 'Email';
                if (phoneNumber) {
                    if (b.type.toLowerCase().includes('restaurant') || 
                        b.type.toLowerCase().includes('café') || 
                        b.type.toLowerCase().includes('cafe')) {
                        preferredChannel = 'WhatsApp';
                    }
                }
                if (b.type.toLowerCase().includes('hotel') || 
                    b.type.toLowerCase().includes('resort')) {
                    preferredChannel = 'Email';
                }
                
                const currentSpecials = b.currentSpecials || [];
                const promotion1 = currentSpecials[0] || 'No promotion';
                const promotion2 = currentSpecials[1] || '';
                const promotion3 = currentSpecials[2] || '';
                const aboutUs = b.aboutUs || b.about || b.description || 'No description provided';
                
                return [
                    `"${email}"`,
                    `"${phoneNumber}"`,
                    `"${whatsAppNumber}"`,
                    `"${zaloID}"`,
                    `"${b.name}"`,
                    `"${b.url}"`,
                    `"${shortURL}"`,
                    `"${contactName} team"`,
                    `"${b.category}"`,
                    `"${b.type}"`,
                    `"${b.location}"`,
                    `"${(b.description || '').substring(0, 150).replace(/"/g, '""')}"`,
                    `"${aboutUs.replace(/"/g, '""')}"`,
                    `"${promotion1.replace(/"/g, '""')}"`,
                    `"${promotion2.replace(/"/g, '""')}"`,
                    `"${promotion3.replace(/"/g, '""')}"`,
                    `"${b.id}"`,
                    `"${new Date().toISOString().split('T')[0]}"`,
                    `"Active"`,
                    `"${preferredChannel}"`
                ];
            })
        ];
        
        const csv = csvRows.map(row => row.join(',')).join('\n');
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().split('T')[0];
        
        link.setAttribute('href', url);
        link.setAttribute('download', `socialu-businesses-${date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ [BUSINESS-PROFILE] CSV downloaded: ${businesses.length} businesses`);
        alert(`✅ CSV downloaded!\n${businesses.length} businesses exported`);
        
        return csv;
    }
    
    /**
     * Generate QR codes for all businesses
     */
    generateQRCodes(businesses) {
        console.log('🔲 [BUSINESS-PROFILE] Generating QR codes for', businesses.length, 'businesses');
        
        const overlay = document.createElement('div');
        overlay.id = 'qrCodesOverlay';
        overlay.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.95); z-index: 10000; 
                        overflow-y: auto; padding: 20px;">
                <div style="max-width: 1200px; margin: 0 auto; background: white; 
                            border-radius: 12px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; 
                                align-items: center; margin-bottom: 24px; 
                                padding-bottom: 16px; border-bottom: 2px solid #eee;">
                        <h2 style="margin: 0; color: #FF6B6B;">Business QR Codes</h2>
                        <button onclick="this.closest('#qrCodesOverlay').remove()" 
                                style="background: none; border: none; font-size: 24px; 
                                       cursor: pointer; padding: 8px; color: #666;">✕</button>
                    </div>
                    <div id="qrGrid" style="display: grid; 
                                           grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
                                           gap: 20px; margin-bottom: 24px;"></div>
                    <div style="text-align: center; padding: 16px; background: #f0f0f0; 
                                border-radius: 8px; margin-top: 20px;">
                        <p style="margin: 0; color: #666;">💡 Right-click any QR code and select "Save image as..." to download</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        const qrGrid = document.getElementById('qrGrid');
        
        // Generate QR codes using canvas (no CORS issues)
        businesses.forEach(business => {
            const card = document.createElement('div');
            card.innerHTML = `
                <div style="border: 2px solid #eee; border-radius: 8px; 
                            padding: 16px; text-align: center; background: #fafafa;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">${business.name}</h3>
                    <div style="font-size: 12px; color: #666; margin-bottom: 12px;">${business.type} • ${business.category}</div>
                    <div class="qr-container-${business.id.replace(/[^a-z0-9]/gi, '')}" 
                         style="background: white; padding: 12px; border-radius: 8px; 
                                margin: 12px auto; width: 200px; height: 200px; 
                                display: flex; align-items: center; justify-content: center;"></div>
                    <div style="font-size: 10px; color: #999; word-break: break-all; margin-top: 8px;">
                        ${business.url}
                    </div>
                </div>
            `;
            qrGrid.appendChild(card);
            
            // Generate QR code as canvas
            const container = card.querySelector(`.qr-container-${business.id.replace(/[^a-z0-9]/gi, '')}`);
            const qr = new QRCode(container, {
                text: business.url,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "rgba(0,0,0,0)", // Transparent background
                correctLevel: QRCode.CorrectLevel.L
            });

            // Convert canvas to transparent PNG after generation
            setTimeout(() => {
                const canvas = container.querySelector('canvas');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    // Make white pixels transparent
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] === 255 && data[i+1] === 255 && data[i+2] === 255) {
                            data[i+3] = 0; // Set alpha to 0 (transparent)
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                }
            }, 100);
        });
        
        console.log(`✅ [BUSINESS-PROFILE] Generated ${businesses.length} QR codes`);
        alert(`QR Codes Generated!\n\n${businesses.length} codes ready.\n\nRight-click any code and "Save image as..." to download.`);
    }
    
    /**
     * Generate social media templates
     */
    generateSocialTemplates(businesses) {
        console.log('📱 [BUSINESS-PROFILE] Generating social templates for', businesses.length, 'businesses');
        
        const templates = [];
        
        templates.push('=== SOCIAL MEDIA OUTREACH TEMPLATES ===\n');
        templates.push('Copy & paste for Instagram, Facebook, WhatsApp, Email\n');
        templates.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
        
        businesses.forEach((business, index) => {
            if (index > 0) templates.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            templates.push(`📍 **${business.name.toUpperCase()}**\n`);
            templates.push(`🏷️ ${business.category} | ${business.type}`);
            templates.push(`📌 ${business.location}\n`);
            
            // Instagram/Facebook
            templates.push(`\n📸 INSTAGRAM/FACEBOOK:`);
            templates.push(`\n✨ Discover ${business.name} on SocialU! ✨`);
            templates.push(`\n\n${business.description.substring(0, 150)}...`);
            templates.push(`\n\n📍 ${business.location}`);
            templates.push(`\n🔗 ${business.url}`);
            templates.push(`\n\n#HoiAn #Vietnam #${business.type.replace(' ', '')}`);
            
            // WhatsApp
            templates.push(`\n\n💬 WHATSAPP:`);
            templates.push(`\nHi! 👋 Check out ${business.name} on SocialU:`);
            templates.push(`\n${business.url}`);
            templates.push(`\n\nPerfect for ${business.category.toLowerCase()}! 🌟`);
            
            // Email
            templates.push(`\n\n📧 EMAIL TEMPLATE:`);
            templates.push(`\nEmail: ${business.email || 'info@' + business.name.toLowerCase().replace(/\s+/g, '') + '.com'}`);
            templates.push(`\nSubject: Your ${business.name} profile on SocialU`);
            templates.push(`\n\nHi ${business.name} team,`);
            templates.push(`\n\nWe've created a profile for you on SocialU - Hoi An's social discovery app!`);
            templates.push(`\n\nView your profile: ${business.url}`);
            templates.push(`\n\nWould you like to claim and customize it?`);
            templates.push(`\n\nBest regards,`);
            templates.push(`\nSocialU Team`);
        });
        
        const output = templates.join('\n');
        
        // Copy to clipboard
        navigator.clipboard.writeText(output).then(() => {
            console.log('✅ [BUSINESS-PROFILE] Social templates copied!');
            alert(`✅ Social Templates Copied!\n\n${businesses.length} business templates ready to paste`);
        }).catch(() => {
            console.log(output);
            alert('Templates generated! Check console to copy.');
        });
        
        return output;
    }
    
    /**
     * ADMIN: Mass upload businesses from array
     * Use for bulk business creation with temp accounts
     */
    async massUploadBusinesses(businessesData) {
        if (!Array.isArray(businessesData) || businessesData.length === 0) {
            alert('❌ Please provide an array of business data');
            return;
        }
        
        console.log(`📤 [BUSINESS-PROFILE] Starting mass upload of ${businessesData.length} businesses...`);
        
        const results = {
            success: [],
            failed: []
        };
        
        for (let i = 0; i < businessesData.length; i++) {
            const business = businessesData[i];
            
            try {
                // Validate required fields
                if (!business.name || !business.phone) {
                    throw new Error('Missing required fields: name or phone');
                }
                
                console.log(`\n📝 [${i + 1}/${businessesData.length}] Processing: ${business.name}`);
                
                // Call businessSignup with the data
                const result = await this.authManager.businessSignup({
                    name: business.name,
                    email: business.email || '',
                    phone: business.phone,
                    type: business.type || 'Business',
                    location: business.location || 'Hoi An, Vietnam'
                });
                
                results.success.push({
                    name: business.name,
                    tempPassword: result.tempPassword,
                    authEmail: result.authEmail,
                    contactEmail: business.email || '',
                    phone: business.phone,
                    hasRealEmail: result.hasRealEmail
                });
                
                console.log(`✅ Uploaded: ${business.name}`);
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`❌ Failed: ${business.name}`, error);
                results.failed.push({
                    name: business.name,
                    error: error.message
                });
            }
        }
        
        console.log(`\n📊 Upload Summary:`);
        console.log(`   ✅ Success: ${results.success.length}`);
        console.log(`   ❌ Failed: ${results.failed.length}`);
        
        // Download credentials CSV
        if (results.success.length > 0) {
            this.downloadBusinessCredentials(results.success);
        }
        
        alert(`📊 Mass Upload Complete!\n\n✅ Success: ${results.success.length}\n❌ Failed: ${results.failed.length}\n\nCredentials CSV has been downloaded.`);
        
        return results;
    }
    
    /**
     * Download CSV of business credentials (for emailing to businesses)
     */
    downloadBusinessCredentials(businesses) {
        console.log('📥 [BUSINESS-PROFILE] Generating credentials CSV...');
        
        const csvRows = [
            [
                'BusinessName',
                'LoginEmail',
                'TempPassword',
                'ContactEmail',
                'Phone',
                'ClaimURL',
                'HasRealEmail'
            ],
            ...businesses.map(b => [
                `"${b.name}"`,
                `"${b.authEmail}"`,
                `"${b.tempPassword}"`,
                `"${b.contactEmail}"`,
                `"${b.phone}"`,
                `"https://www.socialu.app/#business-login"`,
                `"${b.hasRealEmail ? 'Yes' : 'No'}"`
            ])
        ];
        
        const csv = csvRows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().split('T')[0];
        
        link.setAttribute('href', url);
        link.setAttribute('download', `business-credentials-${date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ [BUSINESS-PROFILE] Credentials CSV downloaded: ${businesses.length} businesses`);
    }
    
    /**
     * Cleanup
     */
    cleanup() {
        console.log('🧹 [BUSINESS-PROFILE] Cleaning up resources');
        
        // Clear specials interval
        if (this.specialsInterval) {
            clearInterval(this.specialsInterval);
            this.specialsInterval = null;
        }
        
        // Clear photo viewer listeners
        if (this.photoViewerListeners) {
            const swiper = document.getElementById('photoSwiper');
            if (swiper) {
                Object.entries(this.photoViewerListeners).forEach(([event, handler]) => {
                    swiper.removeEventListener(event, handler);
                });
            }
            this.photoViewerListeners = null;
        }
        
        console.log('✅ [BUSINESS-PROFILE] Cleanup complete');
    }
}
