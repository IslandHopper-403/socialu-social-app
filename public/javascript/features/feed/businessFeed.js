// javascript/features/feed/businessFeed.js

import { sanitizeText, escapeHtml, createSafeElement } from '../../utils/security.js';
import { getOptimizedImageURL } from '../../utils/imageUtils.js';

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Business Feed Manager
 * Handles all business feed displays - restaurants and activities
 */
export class BusinessFeedManager {
    constructor(firebaseServices, appState, mockData) {
        console.log('🏢 [BusinessFeedManager] Initializing...');
        
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.mockData = mockData;
        
        // Cache for story viewer
        this.cachedRestaurants = null;
        this.cachedActivities = null;
        
        // References to other managers (set later)
        this.uiComponents = null;
        this.adminManager = null;
        this.favoritesCarousel = null;
        
        console.log('✅ [BusinessFeedManager] Initialized');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🏢 [BusinessFeedManager] Setting manager references...');
        
        this.uiComponents = managers.ui;
        this.adminManager = managers.admin;
        this.favoritesCarousel = managers.favoritesCarousel;
        
        // Get mockData from global app instance if not available
        if (!this.mockData && window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
            console.log('✅ [BusinessFeedManager] MockData retrieved from global app instance');
        }
        
        console.log('✅ [BusinessFeedManager] Manager references set');
    }
    
    /**
     * Initialize business feed system
     */
    async init() {
        console.log('🏢 [BusinessFeedManager] Setting up business feeds...');
        
        // Load initial demo feeds immediately for better UX
        this.loadInitialFeeds();
        
        console.log('✅ [BusinessFeedManager] Business feeds initialized');
    }
    
    /**
     * Load initial feeds on app start
     */
    loadInitialFeeds() {
        console.log('🏢 [BusinessFeedManager] Loading initial demo feeds...');
        
        // Always load restaurant and activity feeds with demo data initially
        this.populateRestaurantFeedWithData(this.mockData.getRestaurants());
        this.populateActivityFeedWithData(this.mockData.getActivities());
        
        console.log('✅ [BusinessFeedManager] Initial demo feeds loaded');
    }
    
    /**
     * Handle user login - refresh business feeds
     */
    async onUserLogin(user) {
        console.log('🏢 [BusinessFeedManager] User logged in, refreshing business feeds...');
        console.log('🏢 [BusinessFeedManager] User:', {
            uid: user.uid,
            email: user.email
        });
        
        // Load business feeds
        await Promise.all([
            this.populateRestaurantFeed(),
            this.populateActivityFeed()
        ]);
        
        console.log('✅ [BusinessFeedManager] Business feeds refreshed for logged-in user');
    }
    
    /**
     * Show demo data for guest mode
     */
    async showDemoData() {
        console.log('🏢 [BusinessFeedManager] Loading businesses for guest mode...');
        
        // Try to fetch real Firebase businesses first (no auth required for reading)
        try {
            const restaurants = await this.fetchRestaurantsFromFirebase();
            const activities = await this.fetchActivitiesFromFirebase();
            
            // Use Firebase data if available, otherwise fallback to mock data
            this.populateRestaurantFeedWithData(restaurants.length > 0 ? restaurants : this.mockData.getRestaurants());
            this.populateActivityFeedWithData(activities.length > 0 ? activities : this.mockData.getActivities());
            
            console.log('✅ [BusinessFeedManager] Guest mode data loaded');
        } catch (error) {
            console.error('❌ [BusinessFeedManager] Error loading Firebase data in guest mode:', error);
            // Fallback to mock data
            this.populateRestaurantFeedWithData(this.mockData.getRestaurants());
            this.populateActivityFeedWithData(this.mockData.getActivities());
        }
    }
    
    /**
     * Populate restaurant feed
     */
    async populateRestaurantFeed() {
        console.log('🏢 [BusinessFeedManager] populateRestaurantFeed() called');
        
        const storiesContainer = document.getElementById('restaurantStories');
        const feedContainer = document.getElementById('restaurantFeed');
        
        if (!feedContainer) {
            console.warn('⚠️ [BusinessFeedManager] restaurantFeed container not found');
            return;
        }
        
        try {
            // Show loading
            feedContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            console.log('🏢 [BusinessFeedManager] Loading restaurants...');
            
            // Try to fetch from Firebase first
            if (this.state.get('isAuthenticated') && this.db) {
                console.log('🏢 [BusinessFeedManager] Fetching from Firebase...');
                const restaurants = await this.fetchRestaurantsFromFirebase();
                
                if (restaurants.length > 0) {
                    console.log('✅ [BusinessFeedManager] Using Firebase data:', restaurants.length, 'restaurants');
                    this.populateRestaurantFeedWithData(restaurants, storiesContainer, feedContainer);
                    return;
                }
            }
            
            // Fallback to demo data
            console.log('🏢 [BusinessFeedManager] Using demo data');
            this.populateRestaurantFeedWithData(this.mockData.getRestaurants(), storiesContainer, feedContainer);
            
        } catch (error) {
            console.error('❌ [BusinessFeedManager] Error loading restaurants:', error);
            // Fallback to demo data
            this.populateRestaurantFeedWithData(this.mockData.getRestaurants(), storiesContainer, feedContainer);
        }
    }
    
    /**
     * Fetch restaurants from Firebase
     */
    async fetchRestaurantsFromFirebase() {
        console.log('🏢 [BusinessFeedManager] fetchRestaurantsFromFirebase() called');
        
        const restaurants = [];
        
        try {
            const q = query(
                collection(this.db, 'businesses'),
                where('type', '==', 'restaurant'),
                where('status', 'in', ['active', 'pending_approval']),
                orderBy('updatedAt', 'desc'),
            );
            
            const snapshot = await getDocs(q);
            console.log('🏢 [BusinessFeedManager] Firebase returned', snapshot.size, 'restaurants');
            
            snapshot.forEach(doc => {
                const business = doc.data();
                restaurants.push({
                    id: doc.id,
                    name: business.name,
                    type: business.type,
                    image: business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop',
                    logo: business.photos?.[1] || business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop',
                    story: business.photos?.[0] || 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=150&h=200&fit=crop',
                    promo: business.currentSpecials?.[0] || business.promoTitle || 'Special Offer',
                    details: business.currentSpecials?.[1] || business.promoDetails || 'Ask about our current promotions',
                    aboutUs: business.aboutUs || null,
                    description: business.description || 'Great food and atmosphere in Hoi An',
                    location: business.address || 'Hoi An Ancient Town',
                    hours: business.hours || 'Daily 8am-10pm',
                    price: this.formatPriceRange(business.priceRange),
                    contact: business.phone || '+84 123 456 789',
                    rating: business.rating || 4.5,
                    reviewCount: business.reviewCount || 0,
                    photos: business.photos || [business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop'],
                    cuisine: business.cuisine || business.category,
                    address: business.address || business.location
                });
            });
            
            console.log('✅ [BusinessFeedManager] Processed', restaurants.length, 'restaurants from Firebase');
            return restaurants;
            
        } catch (error) {
            console.error('❌ [BusinessFeedManager] Error fetching restaurants from Firebase:', error);
            return [];
        }
    }
    
    /**
     * Populate restaurant feed with data
     */
    populateRestaurantFeedWithData(restaurants, storiesContainer = null, feedContainer = null) {
        console.log('🏢 [BusinessFeedManager] populateRestaurantFeedWithData() called with', restaurants.length, 'restaurants');
        
        storiesContainer = storiesContainer || document.getElementById('restaurantStories');
        feedContainer = feedContainer || document.getElementById('restaurantFeed');
        
        if (!feedContainer) {
            console.warn('⚠️ [BusinessFeedManager] restaurantFeed container not found');
            return;
        }
        
        // Cache restaurants for story viewer
        this.cachedRestaurants = restaurants;
        console.log('💾 [BusinessFeedManager] Cached', restaurants.length, 'restaurants for story viewer');
        
        // Populate stories (if feed.js provides this method via delegation)
        if (storiesContainer && window.classifiedApp?.managers?.feed?.populateStories) {
            console.log('🏢 [BusinessFeedManager] Delegating story population to feed manager');
            window.classifiedApp.managers.feed.populateStories('restaurantStories', restaurants);
        }
        
        // Populate feed
        feedContainer.innerHTML = restaurants.map(restaurant => 
            this.createBusinessCard(restaurant, 'restaurant')
        ).join('');
        
        // Add business signup banner
        this.addBusinessSignupBanner(feedContainer);
        
        // Add admin notice if applicable
        if (this.adminManager && this.adminManager.isAdmin()) {
            this.addAdminNotice(feedContainer);
        }
        
        console.log('✅ [BusinessFeedManager] Restaurant feed populated with', restaurants.length, 'restaurants');

        // Set up logo click handlers after feed is rendered
        setTimeout(() => this.setupLogoClickHandlers(), 100);

        // Set up lazy loading for feed images
        setTimeout(() => {
            const lazyImages = feedContainer.querySelectorAll('img.lazy-load');
            if (lazyImages.length > 0 && window.classifiedApp?.managers?.feed?.lazyLoadManager) {
                // Vertical scroll - use viewport (null)
                window.classifiedApp.managers.feed.lazyLoadManager.observe(lazyImages, null);
                console.log(`👀 [BusinessFeedManager] Observing ${lazyImages.length} restaurant images for lazy load`);
            }
        }, 200);
    }
    
    /**
     * Populate activity feed
     */
    async populateActivityFeed() {
        console.log('🏢 [BusinessFeedManager] populateActivityFeed() called');
        
        const storiesContainer = document.getElementById('activityStories');
        const feedContainer = document.getElementById('activityFeed');
        
        if (!feedContainer) {
            console.warn('⚠️ [BusinessFeedManager] activityFeed container not found');
            return;
        }
        
        try {
            feedContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            console.log('🏢 [BusinessFeedManager] Loading activities...');
            
            // Try to fetch from Firebase first
            if (this.state.get('isAuthenticated') && this.db) {
                console.log('🏢 [BusinessFeedManager] Fetching from Firebase...');
                const activities = await this.fetchActivitiesFromFirebase();
                
                if (activities.length > 0) {
                    console.log('✅ [BusinessFeedManager] Using Firebase data:', activities.length, 'activities');
                    this.populateActivityFeedWithData(activities, storiesContainer, feedContainer);
                    return;
                }
            }
            
            // Fallback to demo data
            console.log('🏢 [BusinessFeedManager] Using demo data');
            this.populateActivityFeedWithData(this.mockData.getActivities(), storiesContainer, feedContainer);
            
        } catch (error) {
            console.error('❌ [BusinessFeedManager] Error loading activities:', error);
            this.populateActivityFeedWithData(this.mockData.getActivities(), storiesContainer, feedContainer);
        }
    }
    
    /**
     * Fetch activities from Firebase
     */
    async fetchActivitiesFromFirebase() {
        console.log('🏢 [BusinessFeedManager] fetchActivitiesFromFirebase() called');
        
        const activities = [];
        
        try {
            const q = query(
                collection(this.db, 'businesses'),
                where('type', '==', 'activity'),
                where('status', 'in', ['active', 'pending_approval']),
                orderBy('updatedAt', 'desc'),
            );
            
            const snapshot = await getDocs(q);
            console.log('🏢 [BusinessFeedManager] Firebase returned', snapshot.size, 'activities');
            
            snapshot.forEach(doc => {
                const business = doc.data();
                activities.push({
                    id: doc.id,
                    name: business.name,
                    type: business.type,
                    image: business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop',
                    logo: business.photos?.[1] || business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop',
                    story: business.photos?.[0] || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=150&h=200&fit=crop',
                    promo: business.currentSpecials?.[0] || business.promoTitle || 'Special Activity',
                    details: business.currentSpecials?.[1] || business.promoDetails || 'Book now for special rates',
                    aboutUs: business.aboutUs || null,
                    description: business.description || 'Amazing activity experience in Hoi An',
                    location: business.address || 'Hoi An, Vietnam',
                    hours: business.hours || 'Daily tours available',
                    price: this.formatPriceRange(business.priceRange),
                    contact: business.phone || '+84 123 456 789',
                    rating: business.rating || 4.5,
                    reviewCount: business.reviewCount || 0,
                    photos: business.photos || [business.photos?.[0] || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop']
                });
            });
            
            console.log('✅ [BusinessFeedManager] Processed', activities.length, 'activities from Firebase');
            return activities;
            
        } catch (error) {
            console.error('❌ [BusinessFeedManager] Error fetching activities from Firebase:', error);
            return [];
        }
    }
    
    /**
     * Populate activity feed with data
     */
    populateActivityFeedWithData(activities, storiesContainer = null, feedContainer = null) {
        console.log('🏢 [BusinessFeedManager] populateActivityFeedWithData() called with', activities.length, 'activities');
        
        storiesContainer = storiesContainer || document.getElementById('activityStories');
        feedContainer = feedContainer || document.getElementById('activityFeed');
        
        if (!feedContainer) {
            console.warn('⚠️ [BusinessFeedManager] activityFeed container not found');
            return;
        }
        
        // Cache activities for story viewer
        this.cachedActivities = activities;
        console.log('💾 [BusinessFeedManager] Cached', activities.length, 'activities for story viewer');
        
        // Populate stories (if feed.js provides this method via delegation)
        if (storiesContainer && window.classifiedApp?.managers?.feed?.populateStories) {
            console.log('🏢 [BusinessFeedManager] Delegating story population to feed manager');
            window.classifiedApp.managers.feed.populateStories('activityStories', activities);
        }
        
        // Populate feed
        feedContainer.innerHTML = activities.map(activity => 
            this.createBusinessCard(activity, 'activity')
        ).join('');
        
        // Add business signup banner
        this.addBusinessSignupBanner(feedContainer);
        
        console.log('✅ [BusinessFeedManager] Activity feed populated with', activities.length, 'activities');

        // Set up lazy loading for feed images
        setTimeout(() => {
            const lazyImages = feedContainer.querySelectorAll('img.lazy-load');
            if (lazyImages.length > 0 && window.classifiedApp?.managers?.feed?.lazyLoadManager) {
                // Vertical scroll - use viewport (null)
                window.classifiedApp.managers.feed.lazyLoadManager.observe(lazyImages, null);
                console.log(`👀 [BusinessFeedManager] Observing ${lazyImages.length} activity images for lazy load`);
            }
        }, 200);

        
        
        // Set up logo click handlers after feed is rendered
        setTimeout(() => this.setupLogoClickHandlers(), 100);
    }
    
    /**
     * Create business card HTML - SECURED
     */
    createBusinessCard(business, type) {
        console.log('🏢 [BusinessFeedManager] createBusinessCard() called for:', business.name);
        
        // Check if business is favorited
        const isFavorited = this.favoritesCarousel?.isBusinessFavorited(business.id) || false;
        const heartIcon = isFavorited ? '❤️' : '🤍';
        
        // Create card container safely
        const card = document.createElement('div');
        card.className = 'business-card';
        card.onclick = () => window.CLASSIFIED.openBusinessProfile(business, type);
        
        // Create header
        const header = document.createElement('div');
        header.className = 'business-header';

        const logo = document.createElement('div');
        logo.className = 'business-logo';
        
        // ✨ OPTIMIZED: Use medium size (800x800) for logo
        const logoPhoto = business.logo || business.photos?.[0] || '';
        const logoUrl = getOptimizedImageURL(logoPhoto, 'medium');
        
        console.log('🖼️ [BUSINESS-FEED] Logo URL:', {
            businessName: business.name,
            photoFormat: typeof logoPhoto,
            optimizedUrl: logoUrl.substring(0, 50) + '...'
        });
        
        // Create img tag instead of background-image for lazy loading
        const logoImg = document.createElement('img');
        logoImg.dataset.src = logoUrl; // Use data-src for lazy loading
        logoImg.alt = business.name;
        logoImg.className = 'business-logo-img lazy-load';
        logo.appendChild(logoImg);
        
        // Make logo clickable to open story (SECURITY: stopPropagation)
        logo.style.cursor = 'pointer';
        logo.onclick = (e) => {
            e.stopPropagation(); // Prevent card click
            const storyManager = window.classifiedApp?.managers?.businessStory;
            if (storyManager) {
                storyManager.showBusinessStory(business);
            }
        };
        
        const info = document.createElement('div');
        info.className = 'business-info';
        
        const name = document.createElement('h3');
        name.textContent = business.name; // Safe
        
        const typeEl = document.createElement('p');
        typeEl.textContent = business.type; // Safe
        
        info.appendChild(name);
        info.appendChild(typeEl);
        
        // Add rating and review count if available
        if (business.rating || business.reviewCount) {
            const ratingDiv = document.createElement('div');
            ratingDiv.className = 'business-rating-info';
            ratingDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 4px;';
            
            if (business.rating) {
                const stars = document.createElement('span');
                stars.className = 'rating-stars';
                stars.textContent = '⭐'.repeat(Math.round(business.rating));
                stars.style.cssText = 'font-size: 14px;';
                
                const ratingText = document.createElement('span');
                ratingText.className = 'rating-value';
                ratingText.textContent = business.rating;
                ratingText.style.cssText = 'font-weight: 600; font-size: 14px;';
                
                ratingDiv.appendChild(stars);
                ratingDiv.appendChild(ratingText);
            }
            
            if (business.reviewCount) {
                const reviews = document.createElement('span');
                reviews.className = 'review-count';
                reviews.textContent = `(${business.reviewCount} reviews)`;
                reviews.style.cssText = 'font-size: 12px; opacity: 0.8;';
                ratingDiv.appendChild(reviews);
            }
            
            info.appendChild(ratingDiv);
        }
        
        // Favorite button - Store ID safely in data attribute
        const favBtn = document.createElement('button');
        favBtn.className = 'business-favorite-btn';
        favBtn.textContent = heartIcon; // ✅ Using textContent (safe)
        favBtn.dataset.businessId = business.id; // ✅ Store ID in data attribute (safe)
        favBtn.setAttribute('onclick', 'event.stopPropagation(); window.CLASSIFIED.toggleBusinessFavoriteFromEvent(this); return false;');
        favBtn.style.cssText = `
            background: none; border: none; font-size: 24px; cursor: pointer; 
            transition: transform 0.2s ease; position: absolute; right: 15px; top: 15px;
        `;
        favBtn.title = 'Save this business';
        
        header.appendChild(logo);
        header.appendChild(info);
        header.appendChild(favBtn);
        
        // Create image carousel container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'business-image-carousel';
        imageContainer.style.cssText = `
            position: relative;
            overflow: hidden;
            height: 280px;
            width: 100%;
        `;
        
        // Create scrollable wrapper
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'carousel-scroll';
        scrollWrapper.style.cssText = `
            display: flex;
            flex-direction: row;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            height: 280px;
            width: 100%;
            -ms-overflow-style: none;
        `;
        scrollWrapper.style.WebkitScrollbar = 'display: none';
        
        // Hide scrollbar
        scrollWrapper.style.msOverflowStyle = 'none';
        scrollWrapper.style.webkitScrollbar = 'none';
        
         // Add all available images - OPTIMIZED: Only load first, lazy load rest
        const photos = business.photos || [business.image];
        photos.slice(0, 5).forEach((photo, photoIndex) => {
            // ✨ OPTIMIZED: Use medium size (800x800) for carousel
            const optimizedUrl = getOptimizedImageURL(photo, 'medium');
            
            const imageDiv = document.createElement('div');
            imageDiv.className = 'carousel-image';
            
           // Load all carousel images (simple and reliable)
            imageDiv.style.cssText = `
                min-width: 100%;
                width: 100%;
                height: 100%;
                flex-shrink: 0;
                scroll-snap-align: start;
                background-image: url("${optimizedUrl}");
                background-size: cover;
                background-position: center;
            `;
            
            scrollWrapper.appendChild(imageDiv);
        });
        
        imageContainer.appendChild(scrollWrapper);

        // Add dot indicators
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'carousel-dots';
        dotsContainer.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 6px;
        `;

        photos.slice(0, 5).forEach((_, index) => {
            const dot = document.createElement('span');
            dot.className = 'carousel-dot';
            dot.style.cssText = `
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${index === 0 ? 'white' : 'rgba(255,255,255,0.5)'};
                transition: background 0.3s;
            `;
            dotsContainer.appendChild(dot);
        });

        // Track scrolling state for click prevention
        let isScrolling = false;
        let scrollTimeout;

        // Combined scroll listener: lazy load + dots + track scrolling
        scrollWrapper.addEventListener('scroll', () => {
            // 1. LAZY LOAD images as they come into view
            const images = scrollWrapper.querySelectorAll('.carousel-image');
            images.forEach((img, idx) => {
                if (img.dataset.bgSrc && !img.dataset.loaded) {
                    const rect = img.getBoundingClientRect();
                    const containerRect = scrollWrapper.getBoundingClientRect();
                    
                    if (rect.left < containerRect.right + 100) {
                        img.style.backgroundImage = `url("${img.dataset.bgSrc}")`;
                        img.dataset.loaded = 'true';
                        console.log('🖼️ [BUSINESS-FEED] Lazy loaded carousel image', idx + 1, 'for:', business.name);
                    }
                }
            });
            
            // 2. UPDATE dots based on scroll position
            const scrollLeft = scrollWrapper.scrollLeft;
            const imageWidth = scrollWrapper.offsetWidth;
            const currentIndex = Math.round(scrollLeft / imageWidth);
            
            dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, i) => {
                dot.style.background = i === currentIndex ? 'white' : 'rgba(255,255,255,0.5)';
            });
            
            // 3. TRACK scrolling for click prevention
            isScrolling = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isScrolling = false;
            }, 150);
        });

        // Prevent card click when scrolling carousel
        imageContainer.addEventListener('click', (e) => {
            if (isScrolling) {
                e.stopPropagation();
            }
        });
                
        if (photos.length > 1) {
            imageContainer.appendChild(dotsContainer);
        }
        
        // Create content
        const content = document.createElement('div');
        content.className = 'business-content';
        
        const desc = document.createElement('div');
        desc.className = 'business-description';
        desc.textContent = business.description.substring(0, 100) + '...'; // Safe
        
        const promo = document.createElement('div');
        promo.className = 'business-promo';
        
        const promoTitle = document.createElement('div');
        promoTitle.className = 'promo-title';
        promoTitle.textContent = business.promo; // Safe
        
        const promoDetails = document.createElement('div');
        promoDetails.className = 'promo-details';
        promoDetails.textContent = business.details; // Safe
        
        promo.appendChild(promoTitle);
        promo.appendChild(promoDetails);
        
        content.appendChild(desc);
        content.appendChild(promo);
        
        // Assemble card
        card.appendChild(header);
        card.appendChild(imageContainer);
        card.appendChild(content);
        
        // Fix: Convert to HTML string but preserve onclick
        const html = card.outerHTML;
        // Add onclick directly to the HTML string
        return html.replace('<div class="business-card"', 
            `<div class="business-card" onclick="window.CLASSIFIED.openBusinessProfile('${business.id}', '${type}')"`);
    }
    
    /**
     * Add business signup banner
     */
    addBusinessSignupBanner(container) {
        console.log('🏢 [BusinessFeedManager] Adding business signup banner');
        
        const banner = document.createElement('div');
        banner.className = 'business-signup-banner';
        banner.innerHTML = `
            <h3>🤖 Own a Business in Hoi An?</h3>
            <p>Create your account instantly and reach 100+ travelers daily</p>
            <div class="cta-button" onclick="CLASSIFIED.showBusinessSignup()">
                🚀 Create Business Account 
            </div>
        `;
        
        // Insert after 3rd business card
        const businessCards = container.querySelectorAll('.business-card');
        if (businessCards.length >= 3) {
            businessCards[2].insertAdjacentElement('afterend', banner);
        } else {
            container.appendChild(banner);
        }
        
        console.log('✅ [BusinessFeedManager] Business signup banner added');
    }
    
    /**
     * Add admin notice for pending businesses
     */
    async addAdminNotice(container) {
        console.log('🏢 [BusinessFeedManager] Checking for pending businesses...');
        
        try {
            const q = query(
                collection(this.db, 'businesses'),
                where('status', '==', 'pending_approval')
            );
            
            const snapshot = await getDocs(q);
            
            if (snapshot.size > 0) {
                console.log('🏢 [BusinessFeedManager] Found', snapshot.size, 'pending businesses');
                
                const adminNotice = document.createElement('div');
                adminNotice.innerHTML = `
                    <div style="background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 15px; padding: 20px; margin: 20px 0; text-align: center;">
                        <h3 style="margin: 0 0 10px 0; color: #FF6B6B;">🛡️ Admin Notice</h3>
                        <p style="margin: 0 0 15px 0; font-size: 14px;">${snapshot.size} business${snapshot.size > 1 ? 'es' : ''} pending approval</p>
                        <button onclick="CLASSIFIED.openAdminPanel()" style="background: rgba(255,107,107,0.2); border: 1px solid rgba(255,107,107,0.3); border-radius: 20px; padding: 8px 16px; color: #FF6B6B; cursor: pointer; font-size: 12px;">
                            Review Applications
                        </button>
                    </div>
                `;
                container.appendChild(adminNotice);
                
                console.log('✅ [BusinessFeedManager] Admin notice added');
            }
        } catch (error) {
            console.error('❌ [BusinessFeedManager] Error checking pending businesses:', error);
        }
    }
    
    /**
     * Set up event listeners for logo clicks (event delegation)
     */
    setupLogoClickHandlers() {
        console.log('🏢 [BusinessFeedManager] Setting up logo click handlers via event delegation');
        
        const restaurantFeed = document.getElementById('restaurantFeed');
        const activityFeed = document.getElementById('activityFeed');
        
        [restaurantFeed, activityFeed].forEach(container => {
            if (!container) return;
            
            // Remove existing listener if any
            if (container._logoClickHandler) {
                container.removeEventListener('click', container._logoClickHandler);
            }
            
            // Create handler
            const handler = (e) => {
                // Check if clicked element is a business logo
                const logo = e.target.closest('.business-logo');
                if (logo) {
                    e.stopPropagation(); // Prevent card click
                    
                    // Find the business card
                    const card = logo.closest('.business-card');
                    if (card) {
                        // Extract business ID from card onclick
                        const onclickAttr = card.getAttribute('onclick');
                        if (onclickAttr) {
                            const match = onclickAttr.match(/openBusinessProfile\('([^']+)',\s*'([^']+)'/);
                            if (match) {
                                const [, businessId, type] = match;
                                console.log('🏢 [BusinessFeedManager] Logo clicked for business:', businessId);
                                
                                // Get business data and open story
                                const business = this.getBusinessById(businessId, type);
                                if (business && window.classifiedApp?.managers?.businessStory) {
                                    window.classifiedApp.managers.businessStory.showBusinessStory(business);
                                } else {
                                    console.warn('⚠️ [BusinessFeedManager] Could not find business or story manager');
                                }
                            }
                        }
                    }
                }
            };
            
            // Store reference and attach
            container._logoClickHandler = handler;
            container.addEventListener('click', handler);
        });
        
        console.log('✅ [BusinessFeedManager] Logo click handlers attached');
    }
    
    /**
     * Get business data by ID
     */
    getBusinessById(businessId, type) {
        console.log('🏢 [BusinessFeedManager] getBusinessById() called:', businessId, type);
        
        const businesses = type === 'restaurant' 
            ? (this.cachedRestaurants || this.mockData.getRestaurants())
            : (this.cachedActivities || this.mockData.getActivities());
        
        const business = businesses.find(b => b.id === businessId);
        
        if (business) {
            console.log('✅ [BusinessFeedManager] Found business:', business.name);
        } else {
            console.warn('⚠️ [BusinessFeedManager] Business not found:', businessId);
        }
        
        return business;
    }
    
    /**
     * Format price range
     */
    formatPriceRange(priceRange) {
        const priceMap = {
            'budget': '$ - Budget Friendly',
            'moderate': '$$ - Moderate',
            'expensive': '$$$ - Expensive'
        };
        return priceMap[priceRange] || '$$ - Moderate';
    }
    
    /**
     * Refresh activity feed (for debugging)
     */
    async refreshActivityFeed() {
        console.log('🏢 [BusinessFeedManager] Manual refresh triggered for activity feed');
        await this.populateActivityFeed();
    }
}
