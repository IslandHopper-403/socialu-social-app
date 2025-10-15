// javascript/features/business.js

import { sanitizeText, escapeHtml } from '../utils/security.js';
import { BusinessDashboardManager } from './business/businessDashboard.js';
import { BusinessAnalyticsManager } from './business/businessAnalytics.js';

import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';


/**
 * Business Manager
 * Handles business profile management, viewing, and dashboard functionality
 */
export class BusinessManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;

        // Get mock data if available
        this.mockData = null;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.profileManager = null;
        this.authManager = null;
        this.messagingManager = null; 
        this.storyManager = null;  // Reference to BusinessStoryManager
        
       // Initialize dashboard sub-manager
        this.dashboard = new BusinessDashboardManager(firebaseServices, appState);
        console.log('✅ [BUSINESS] Dashboard sub-manager initialized');
        
        // Initialize analytics sub-manager
        this.analytics = new BusinessAnalyticsManager(firebaseServices, appState);
        console.log('✅ [BUSINESS] Analytics sub-manager initialized');
        
        // Real-time listeners for Promotions overlays
        // NOTE: Dashboard listeners (stats/messages) managed by dashboard sub-manager
        // NOTE: Analytics listeners managed by analytics sub-manager
        this.promotionsListener = null;   // Section 3.4: Promotions overlay
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
        this.authManager = managers.auth;
        this.messagingManager = managers.messaging; 
        this.storyManager = managers.businessStory;  // Add story manager reference
        
        // Pass manager references to dashboard sub-manager
        this.dashboard.setManagers({
            navigation: managers.navigation,
            messaging: managers.messaging,
            business: this  // Parent reference
        });
        console.log('✅ [BUSINESS] Dashboard manager references set');
        
        // Pass manager references to analytics sub-manager
        this.analytics.setManagers({
            navigation: managers.navigation,
            business: this  // Parent reference
        });
        console.log('✅ [BUSINESS] Analytics manager references set');
        
        // Get mock data reference from the main app
        if (window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
            console.log('✅ MockData loaded in BusinessManager');
        }
    }
    
    /**
     * Initialize business manager
     */
    async init() {
        console.log('🏢 Initializing business manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check if current user is a business
        if (this.state.get('isBusinessUser')) {
            await this.loadBusinessDashboard();
        }
    }
    
  setupEventListeners() {
        // DON'T set up back button - navigation manager handles ALL back buttons
        // Removed duplicate handler that was causing the loop
    }
    
   /**
     * Handle business login
     * DELEGATION: Passes to dashboard sub-manager
     */
    async handleBusinessLogin(businessData) {
        console.log('🏢 [BUSINESS] Business user logged in');
        
        // Store business data locally (for backward compatibility)
        this.currentBusinessData = businessData;
        
        // Delegate to dashboard
        await this.dashboard.handleBusinessLogin(businessData);
    }
    
    /**
     * Initialize business dashboard
     * DELEGATION: Auth check + delegate to dashboard
     */
    async initializeDashboard() {
        console.log('📊 [BUSINESS] Initializing dashboard');
        
        // SECURITY: Auth check at manager level
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ [BUSINESS] Business authentication required');
            return;
        }
        
        // Delegate to dashboard sub-manager
        await this.dashboard.initializeDashboard();
    }
    
    /**
     * Load business dashboard data
     * DELEGATION: Simple pass-through
     */
    async loadBusinessDashboard() {
       return this.dashboard.loadBusinessDashboard();
    }
    
    /**
     * Update dashboard UI
     * DELEGATION: Simple pass-through
     */
    updateDashboardUI() {
        return this.dashboard.updateDashboardUI();
    }
    
    /**
     * Open business messages overlay
     * DELEGATION: Auth check + delegate
     */
    openBusinessMessages() {
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ [BUSINESS] Business authentication required');
            return;
        }
        return this.dashboard.openBusinessMessages();
    }
    
    /**
     * Close business messages overlay
     * DELEGATION: Simple pass-through
     */
    closeBusinessMessages() {
        return this.dashboard.closeBusinessMessages();
    }
    
    /**
     * Set up real-time listeners for dashboard stats
     * DELEGATION: Auth check + delegate (called by initializeDashboard)
     */

    setupDashboardListeners() {
        // DELEGATION: Called internally by dashboard.initializeDashboard()
        // No direct call needed - dashboard handles its own listeners
        console.log('🔗 [BUSINESS] Dashboard listeners managed by sub-manager');
    }
    
    /**
     * Cleanup dashboard listeners
     * DELEGATION: Simple pass-through
     */
   cleanupDashboardListeners() {
        return this.dashboard.cleanupDashboardListeners();
    }
    
    /**
        
        /**
         * Open business profile by slug or ID
         */
        async openBusinessProfileBySlugOrId(slugOrId, businessType = 'restaurant') {
            console.log('🔍 Looking up business by slug/ID:', slugOrId);
            
            // First, try to find by slug
            const business = await this.findBusinessBySlug(slugOrId);
            
            if (business) {
                console.log('✅ Found business by slug:', business.name);
                return this.openBusinessProfile(business, businessType);
            }
            
            // Fallback: try as regular ID
            console.log('🔄 Trying as regular ID...');
            return this.openBusinessProfile(slugOrId, businessType);
        }
    
        /**
         * Find business by slug
         */
        async findBusinessBySlug(slug) {
            // Search in mock data
            if (window.classifiedApp && window.classifiedApp.mockData) {
                const mockData = window.classifiedApp.mockData;
                
                // Search restaurants
                const restaurants = mockData.getRestaurants?.() || [];
                for (const restaurant of restaurants) {
                    if (this.createBusinessSlug(restaurant) === slug) {
                        return restaurant;
                    }
                }
                
                // Search activities
                const activities = mockData.getActivities?.() || [];
                for (const activity of activities) {
                    if (this.createBusinessSlug(activity) === slug) {
                        return activity;
                    }
                }
            }
            
            // Search in Firebase (if needed)
            try {
                const snapshot = await getDocs(collection(this.db, 'businesses'));
                for (const doc of snapshot.docs) {
                    const business = { id: doc.id, ...doc.data() };
                    if (this.createBusinessSlug(business) === slug) {
                        return business;
                    }
                }
            } catch (error) {
                console.error('Error searching businesses:', error);
            }
            
            return null;
        }
        
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
        
        console.log(`🏢 Opening ${businessType} profile:`, businessId);
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
            console.error('Business not found for ID:', businessId);
            console.log('Attempted Firebase lookup:', businessId);
            
            const restaurants = this.mockData?.getRestaurants?.() || [];
            const activities = this.mockData?.getActivities?.() || [];
            console.log('Available restaurant IDs:', restaurants.map(r => ({ id: r.id, name: r.name })));
            console.log('Available activity IDs:', activities.map(a => ({ id: a.id, name: a.name })));
            console.log('Looking for ID:', businessId);
            
            // Try to find the business
            const foundRestaurant = restaurants.find(r => r.id === businessId);
            const foundActivity = activities.find(a => a.id === businessId);
            console.log('Found in restaurants?', foundRestaurant);
            console.log('Found in activities?', foundActivity);
            
            alert(`Business not found (ID: ${businessId})`);
            this.navigationManager.hideLoading();
            return;
        }
            
            // Update state
            this.state.set('currentBusiness', businessData);
            
            // Update UI
            this.updateBusinessProfileUI(businessData);
            
           // FIXED: Always track that business profile came from feed
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
            
           // Track view - delegate to analytics
            await this.analytics.trackBusinessView(businessId);
            
            this.navigationManager.hideLoading();
            
        } catch (error) {
            console.error('❌ Error opening business profile:', error);
            this.navigationManager.hideLoading();
            alert('Failed to load business profile');
        }
    }
    
    /**
     * Fetch business from Firebase
     */
    async fetchBusinessFromFirebase(businessId) {
        try {
            const businessDoc = await getDoc(doc(this.db, 'businesses', businessId));
            if (businessDoc.exists()) {
                return { id: businessDoc.id, ...businessDoc.data() };
            }
        } catch (error) {
            console.error('Error fetching business:', error);
        }
        return null;
    }
    
    /**
     * Get business from mock data
     */
      getBusinessFromMockData(businessId, businessType) {
        // Access mock data through the app instance
        if (window.classifiedApp && window.classifiedApp.mockData) {
            const mockData = window.classifiedApp.mockData;
            
            // Try to find in restaurants first
            const restaurant = mockData.getRestaurantById(businessId);
            if (restaurant) return restaurant;
            
            // Then try activities
            const activity = mockData.getActivityById(businessId);
            if (activity) return activity;
        }
        return null;
    }
    
    /**
     * Update business profile UI
     */
      updateBusinessProfileUI(business) {
       // Safety check
        if (!business) {
            console.error('No business data provided to updateBusinessProfileUI');
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
        console.log('Final imageUrl:', imageUrl);
        
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
    }
    
   closeBusinessProfile() {
        console.log('🔙 Closing business profile');
        
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
        console.log('📱 Returned to', currentScreen, 'feed from business profile');
    }



        // Add photo counter to hero image
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
    }
    
    // Open photo viewer
    openPhotoViewer(business) {
        if (!business.photos || business.photos.length === 0) return;
        
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
        
        // Touch/swipe handling
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        const updateSlide = (index) => {
            swiper.style.transform = `translateX(-${index * 100}%)`;
            counter.textContent = `${index + 1}/${business.photos.length}`;
            currentIndex = index;
        };
        
        const handleStart = (e) => {
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            isDragging = true;
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        };
        
        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentX - startX;
            if (Math.abs(diff) > 50) {
                if (diff > 0 && currentIndex > 0) {
                    updateSlide(currentIndex - 1);
                } else if (diff < 0 && currentIndex < business.photos.length - 1) {
                    updateSlide(currentIndex + 1);
                }
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
        swiper.addEventListener('touchend', this.photoViewerListeners.touchend);
        swiper.addEventListener('mousedown', this.photoViewerListeners.mousedown);
        swiper.addEventListener('mousemove', this.photoViewerListeners.mousemove);
        swiper.addEventListener('mouseup', this.photoViewerListeners.mouseup);
        swiper.addEventListener('mouseleave', this.photoViewerListeners.mouseleave);
        
        // Show viewer
        viewer.classList.add('show');
    }
    
        closePhotoViewer() {
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
    }

    
    /**
     * Show business signup modal
     */
    showBusinessSignup() {
        console.log('🏢 Showing business signup');
        
        // For now, redirect to business auth screen
        if (this.authManager) {
            this.authManager.showBusinessAuth();
        }
    }
    
    /**
     * Submit quick business signup
     */
    async submitQuickBusinessSignup() {
        // This would handle a quick signup form if implemented
        console.log('🏢 Quick business signup submitted');
        
        // For now, show the full business auth screen
        this.showBusinessSignup();
    }

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
        
        const address = business.location || business.address || business.name;
        const encodedAddress = encodeURIComponent(`${address}, Hoi An, Vietnam`);
        
        // Open Google Maps
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
    
    /**
     * Show business UI elements
     */
    showBusinessUI() {
        // Add business-specific navigation items or UI elements
        // This could include a dashboard button, analytics, etc.
        console.log('🏢 Showing business UI elements');
        
        // You could add a business dashboard button to the navigation
        // or modify the UI to show business-specific features
    }
    
    /**
     * Update business promotion
     */
    async updateBusinessPromotion(promoData) {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            throw new Error('Not authorized');
        }
        
        try {
            await updateDoc(doc(this.db, 'businesses', user.uid), {
                promoTitle: promoData.title,
                promoDetails: promoData.details,
                promoStartDate: promoData.startDate,
                promoEndDate: promoData.endDate,
                updatedAt: serverTimestamp()
            });
            
            console.log('🎯 Promotion updated');
            
            // Update local state
            const businessProfile = this.state.get('businessProfile');
            Object.assign(businessProfile, {
                promoTitle: promoData.title,
                promoDetails: promoData.details
            });
            this.state.set('businessProfile', businessProfile);
            
        } catch (error) {
            console.error('❌ Error updating promotion:', error);
            throw error;
        }
    }
    
    /**
     * Get business insights
     */
    async getBusinessInsights() {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            return null;
        }
        
        try {
            // Get views by date
            const viewsQuery = query(
                collection(this.db, 'businessViews'),
                where('businessId', '==', user.uid),
                where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
            );
            
            const viewsSnapshot = await getDocs(viewsQuery);
            const dailyViews = {};
            
            viewsSnapshot.forEach(doc => {
                const data = doc.data();
                const date = data.timestamp.toDate().toDateString();
                dailyViews[date] = (dailyViews[date] || 0) + 1;
            });
            
            return {
                totalViews: this.dashboardData.views,
                totalClicks: this.dashboardData.clicks,
                dailyViews: dailyViews,
                conversionRate: this.dashboardData.views > 0 
                    ? (this.dashboardData.clicks / this.dashboardData.views * 100).toFixed(1) 
                    : 0
            };
            
        } catch (error) {
            console.error('Error getting insights:', error);
            return null;
        }
    }
    
    /**
     * Check if user is business owner
     */
    isBusinessOwner() {
        return this.state.get('isBusinessUser');
    }
    
    /**
     * Get business status
     */
    getBusinessStatus() {
        const businessProfile = this.state.get('businessProfile');
        return businessProfile?.status || 'unknown';
    }


// ========== ANALYTICS DELEGATION METHODS ==========
    
    /**
     * Open Business Analytics
     * DELEGATION: Passes to analytics sub-manager
     */
    openBusinessAnalytics() {
        return this.analytics.openBusinessAnalytics();
    }
    
    /**
     * Close Business Analytics
     * DELEGATION: Passes to analytics sub-manager
     */
    closeBusinessAnalytics() {
        return this.analytics.closeBusinessAnalytics();
    }
    
    /**
     * Change Analytics Range
     * DELEGATION: Passes to analytics sub-manager
     */
    changeAnalyticsRange(range, button) {
        return this.analytics.changeAnalyticsRange(range, button);
    }
    
    /**
     * Track business view
     * DELEGATION: Passes to analytics sub-manager
     */
    async trackBusinessView(businessId) {
        return this.analytics.trackBusinessView(businessId);
    }

// ========== PROMOTIONS OVERLAY METHODS ==========
    
    /**
     * Open Promotions Manager (SECURITY: Business only)
     */
    openPromotionsManager() {
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized: Business authentication required');
            return;
        }
        
        console.log('📢 Opening Promotions Manager');
        const overlay = document.getElementById('promotionsManager');
        if (overlay) {
            overlay.classList.add('show');
            this.loadPromotions('active');
        }
    }
    
    /**
     * Load Promotions (SECURITY: Firestore rules enforce ownership)
     */
    async loadPromotions(status) {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) return;
        
        try {
            // TODO: Implement Firestore query for promotions
            console.log(`Loading ${status} promotions for business ${user.uid}`);
            
            // Show empty state for now
            const emptyState = document.getElementById('promotionsEmptyState');
            if (emptyState) emptyState.style.display = 'block';
            
        } catch (error) {
            console.error('❌ Error loading promotions:', error);
        }
    }
    
    /**
     * Create Promotion (SECURITY: Show form with validation)
     */
    createPromotion() {
        const form = document.getElementById('promotionForm');
        const list = document.getElementById('promotionsList');
        const emptyState = document.getElementById('promotionsEmptyState');
        
        if (form) {
            form.style.display = 'block';
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
        }
    }
    
    /**
     * Save Promotion (SECURITY: Sanitized inputs from main.js)
     */
    async savePromotion(safeTitle, safeDescription) {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized');
            return;
        }
        
        // Additional validation
        if (!safeTitle || safeTitle.length > 50) {
            alert('Title is required (max 50 characters)');
            return;
        }
        
        if (!safeDescription || safeDescription.length > 200) {
            alert('Description is required (max 200 characters)');
            return;
        }
        
        try {
            // TODO: Save to Firestore with proper structure
            console.log('Saving promotion:', { safeTitle, safeDescription });
            
            // Close form
            this.cancelPromotion();
            
            // Reload promotions
            this.loadPromotions('active');
            
        } catch (error) {
            console.error('❌ Error saving promotion:', error);
            alert('Failed to save promotion');
        }
    }
    
    /**
     * Cancel Promotion Creation
     */
    cancelPromotion() {
        const form = document.getElementById('promotionForm');
        const list = document.getElementById('promotionsList');
        
        if (form) {
            form.style.display = 'none';
            // Clear form inputs
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => input.value = '');
        }
        
        if (list) list.style.display = 'block';
    }
    
    /**
     * Open Business Messages (SECURITY: Filter business messages only)
     * DELEGATION: Delegates to dashboard sub-manager
     */
    openBusinessMessages() {
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized: Business authentication required');
            return;
        }
        return this.dashboard.openBusinessMessages();
    }
    
    /**
     * Insert Quick Reply Template (SECURITY: Predefined templates only)
     */
    insertQuickReply(type) {
        const templates = {
            greeting: 'Hello! Thank you for your interest in our business.',
            hours: 'We are open Monday-Saturday 9AM-9PM, Sunday 10AM-6PM.',
            location: 'We are located at [Your Address]. Click here for directions: [Map Link]',
            promotion: 'Check out our current promotions! [Promotion Details]'
        };
        
        const template = templates[type];
        if (template) {
            // TODO: Insert into active chat input
            console.log('Quick reply:', template);
        }
    }
    
    /**
     * Load Business Insights
     */
    async loadInsights() {
        if (!this.state.get('isBusinessUser')) return;
        
        // TODO: Generate insights from analytics data
        console.log('Loading business insights...');
    }
    
    // NOTE: formatMessageTime() and fetchCustomerPhoto() moved to utils/helpers.js
    // Will be imported in Section 3.8: Utility extraction
    
    /**
     * Cleanup business dashboard resources
     * DELEGATION: Delegates to dashboard sub-manager
     */
   cleanup() {
        console.log('🧹 [BUSINESS] Cleaning up business manager');
        
        // Delegate dashboard cleanup to sub-manager
        if (this.dashboard) {
            this.dashboard.cleanup();
        }
        
        // Delegate analytics cleanup to sub-manager
        if (this.analytics) {
            this.analytics.cleanup();
        }
        
        // Clear local cached data
        this.currentBusinessData = null;
        
        console.log('✅ [BUSINESS] Cleanup complete');
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
    console.log(`📋 Generating business URLs (${format} format, ${category})...`);
    console.log('⚠️ REAL DATA ONLY - No mock data, no placeholders');
    
    // Collect ONLY real businesses from Firebase
    let businesses = [];
    
    try {
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
                email: b.email,                                    // Real email from signup
                phone: b.phone || '',                              // Real phone or empty
                zaloId: b.zaloId || b.phone || '',                // Real Zalo ID or phone
                type: b.type || 'Business',
                category: b.category || b.type || 'General',
                url: `${window.location.origin}${window.location.pathname}#business/${slug}`,
                shareUrl: `${window.location.origin}${window.location.pathname}#business/${slug}`,
                location: b.location || b.address || 'Hoi An, Vietnam',
                description: b.description || '',
                currentSpecials: b.currentSpecials || [],          // ✅ ADD: Promotions array
                aboutUs: b.aboutUs || b.about || b.description || '', // ✅ ADD: About Us section
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
                               b.email.includes('@business.com') ||     // Our fake domain
                               b.email.includes('noemail') || 
                               b.email === '';
            
            // Use the hasRealEmail flag if available, otherwise check email format
            const email = (b.hasRealEmail === false) ? '' : 
                         (isFakeEmail ? '' : b.email);
            
            // Filter out fake/test phone numbers
            const isFakePhone = b.phone && (
                b.phone.includes('123 4567') ||     // Common test pattern
                b.phone === '+84 90 123 4567' ||    // Exact fake number
                b.phone === '+84 905 123 456' ||    // Another test pattern
                b.phone.match(/^\+84\s?90[0-9]\s?123\s?456[0-9]$/)  // Pattern: +84 90X 123 456X
            );
            
            // Use ONLY real phone number or leave empty
            const phoneNumber = (b.phone && !isFakePhone) ? b.phone : '';
            
            // WhatsApp uses international format without spaces (only if phone exists)
            const whatsAppNumber = phoneNumber ? phoneNumber.replace(/\s+/g, '') : '';
            
            // Zalo ID - use real data or leave empty
            const zaloID = b.zaloId || phoneNumber || '';
            
            // Extract contact name from business name (remove suffixes)
            const contactName = b.name
                .replace(/\s+(Restaurant|Hotel|Café|Cafe|Bar|Spa|Shop|Store|Gallery|Studio|Team|&.*$).*$/i, '')
                .trim() || b.name;  // Fallback to full name
            
            // Create short URL for SMS/WhatsApp
            const shortURL = b.url.replace(`${window.location.origin}${window.location.pathname}#business/`, 'socialu.app/b/');
            
            // Determine preferred channel based on business type and available contact methods
            let preferredChannel = 'Email'; // Default
            if (phoneNumber) {
                // If has phone, prefer WhatsApp for restaurants/cafes
                if (b.type.toLowerCase().includes('restaurant') || 
                    b.type.toLowerCase().includes('café') || 
                    b.type.toLowerCase().includes('cafe')) {
                    preferredChannel = 'WhatsApp';
                }
   }
        // Hotels/Resorts always prefer email (formal)
        if (b.type.toLowerCase().includes('hotel') || 
            b.type.toLowerCase().includes('resort')) {
            preferredChannel = 'Email';
        }
        
        // Extract promotions from currentSpecials array (0, 1, 2)
        const currentSpecials = b.currentSpecials || [];
        const promotion1 = currentSpecials[0] || 'No promotion';
        const promotion2 = currentSpecials[1] || '';
        const promotion3 = currentSpecials[2] || '';
        
        // Get About Us section (full description, not truncated)
        const aboutUs = b.aboutUs || b.about || b.description || 'No description provided';
        
        return [
            `"${email}"`,                                    // Email (real)
            `"${phoneNumber}"`,                              // PhoneNumber (real or empty)
            `"${whatsAppNumber}"`,                           // WhatsAppNumber (real or empty)
            `"${zaloID}"`,                                   // ZaloID (real or empty)
            `"${b.name}"`,                                   // BusinessName
            `"${b.url}"`,                                    // ProfileURL
            `"${shortURL}"`,                                 // ShortURL
            `"${contactName} team"`,                         // ContactName
            `"${b.category}"`,                               // Category
            `"${b.type}"`,                                   // Type
            `"${b.location}"`,                               // Location
            `"${(b.description || '').substring(0, 150).replace(/"/g, '""')}"`, // Description (CSV-escaped)
            `"${aboutUs.replace(/"/g, '""')}"`,              // AboutUs (CSV-escaped, full text)
            `"${promotion1.replace(/"/g, '""')}"`,           // Promotion1 (CSV-escaped)
            `"${promotion2.replace(/"/g, '""')}"`,           // Promotion2 (CSV-escaped)
            `"${promotion3.replace(/"/g, '""')}"`,           // Promotion3 (CSV-escaped)
            `"${b.id}"`,                                     // BusinessId
            `"${new Date().toISOString().split('T')[0]}"`,   // JoinDate
            `"Active"`,                                      // Status
            `"${preferredChannel}"`                          // PreferredChannel
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
        
        console.log(`✅ CSV downloaded: ${businesses.length} businesses`);
        alert(`✅ CSV downloaded!\n${businesses.length} businesses exported`);
        
        return csv;
    }
    
    /**
     * Generate QR codes for all businesses
     */
generateQRCodes(businesses) {
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
    
    console.log(`Generated ${businesses.length} QR codes`);
    alert(`QR Codes Generated!\n\n${businesses.length} codes ready.\n\nRight-click any code and "Save image as..." to download.`);
}
    
    /**
     * Generate social media templates
     */
    generateSocialTemplates(businesses) {
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
            console.log('✅ Social templates copied!');
            console.log(output);
            alert(`✅ Social Templates Copied!\n\n${businesses.length} business templates ready to paste`);
        }).catch(() => {
            console.log(output);
            alert('Templates generated! Check console to copy.');
        });
        
        return output;
    }

    /**
     * Generate social media templates
     */
    generateSocialTemplates(businesses) {
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
            console.log('✅ Social templates copied!');
            console.log(output);
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
     * @param {Array} businessesData - Array of business objects
     * @example
     * [
     *   { name: "Red Dragon", phone: "+84 905 111 222", email: "info@red.com", type: "Restaurant" },
     *   { name: "Mystery Cafe", phone: "+84 905 333 444", email: "", type: "Cafe" },  // No email
     * ]
     */
    async massUploadBusinesses(businessesData) {
        if (!Array.isArray(businessesData) || businessesData.length === 0) {
            alert('❌ Please provide an array of business data');
            return;
        }
        
        console.log(`📤 Starting mass upload of ${businessesData.length} businesses...`);
        
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
                
                // Get auth manager reference
                const authManager = window.classifiedApp?.managers?.auth;
                if (!authManager) {
                    throw new Error('Auth manager not available');
                }
                
                // Call businessSignup with the data
                const result = await authManager.businessSignup({
                    name: business.name,
                    email: business.email || '',  // May be empty
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
        
        // Download credentials CSV for emailing to businesses
        if (results.success.length > 0) {
            this.downloadBusinessCredentials(results.success);
        }
        
        // Show results summary
        alert(`📊 Mass Upload Complete!\n\n✅ Success: ${results.success.length}\n❌ Failed: ${results.failed.length}\n\nCredentials CSV has been downloaded.`);
        
        return results;
    }
    
    /**
     * Download CSV of business credentials (for emailing to businesses)
     */
    downloadBusinessCredentials(businesses) {
        console.log('📥 Generating credentials CSV...');
        
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
        
        console.log(`✅ Credentials CSV downloaded: ${businesses.length} businesses`);
    }
    
}
