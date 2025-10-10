// javascript/features/feed.js


import { sanitizeText, escapeHtml, createSafeElement } from '../utils/security.js';

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
 * Feed Manager
 * Handles all feed displays - restaurants, activities, and user feeds
 */
export class FeedManager {
    constructor(firebaseServices, appState, mockData) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.mockData = mockData;
        
        // References to other managers (set later)
        this.uiComponents = null;
        this.adminManager = null;
        
        // Current filters
        this.currentUserFilter = 'all';
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.uiComponents = managers.ui;
        this.adminManager = managers.admin;


        // ADD THIS: Get mockData from global app instance if not available
    if (!this.mockData && window.classifiedApp && window.classifiedApp.mockData) {
        this.mockData = window.classifiedApp.mockData;
        console.log('✅ MockData retrieved from global app instance');
        }    
    }
    
    /**
     * Initialize feed system
     */
    async init() {
        console.log('📊 Initializing feed manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial demo feeds immediately for better UX
        this.loadInitialFeeds();
    }
    
    /**
     * Load initial feeds on app start
     */
    loadInitialFeeds() {
        console.log('📊 Loading initial feeds...');
        
        // Always load restaurant and activity feeds with demo data initially
        this.populateRestaurantFeedWithData(this.mockData.getRestaurants());
        this.populateActivityFeedWithData(this.mockData.getActivities());
        
        // Don't load user feed until auth state is determined
        console.log('📊 Initial feeds loaded, waiting for auth state for user feed');
    }
    
    /**
     * Set up event listeners for feed interactions
     */
    setupEventListeners() {
        // Social tab listeners - Remove existing onclick handlers first
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.onclick = null;
            tab.addEventListener('click', (e) => {
                const tabType = tab.dataset.tab;
                this.switchSocialTab(tabType);
            });
        });
        
        // Filter chip listeners - Remove existing onclick handlers first
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.onclick = null;
            chip.addEventListener('click', (e) => {
                const filter = chip.dataset.filter;
                this.filterUsers(filter);
            });
        });
    }
    
    /**
     * Load all feeds
     */
    async loadAllFeeds() {
        if (this.state.get('isAuthenticated')) {
            await Promise.all([
                this.populateRestaurantFeed(),
                this.populateActivityFeed(),
                this.populateUserFeed()
            ]);
        } else if (this.state.get('isGuestMode')) {
            this.showDemoData();
        }
    }
    
    /**
     * Handle user login - refresh feeds
     */
    async onUserLogin(user) {
        console.log('📊 User logged in, refreshing feeds...');
        await this.loadAllFeeds();
    }
    
    /**
     * Show demo data for guest mode
     */
    async showDemoData() {
        console.log('📊 Loading businesses for guest mode...');
        
        // Try to fetch real Firebase businesses first (no auth required for reading)
        try {
            const restaurants = await this.fetchRestaurantsFromFirebase();
            const activities = await this.fetchActivitiesFromFirebase();
            
            // Use Firebase data if available, otherwise fallback to mock data
            this.populateRestaurantFeedWithData(restaurants.length > 0 ? restaurants : this.mockData.getRestaurants());
            this.populateActivityFeedWithData(activities.length > 0 ? activities : this.mockData.getActivities());
        } catch (error) {
            console.error('Error loading Firebase data in guest mode:', error);
            // Fallback to mock data
            this.populateRestaurantFeedWithData(this.mockData.getRestaurants());
            this.populateActivityFeedWithData(this.mockData.getActivities());
        }
        
        this.populateGuestUserFeed();
         
        // Show full user feed with "Sign up to connect" overlays
        const users = this.mockData.getUsers();
        const container = document.getElementById('userFeedContainer');
        if (container) {
            container.innerHTML = '';
            users.forEach((user, index) => {
                const feedItem = this.createUserFeedItem(user, index);
                container.appendChild(feedItem);
            });
        }
    }
    
    /**
     * Populate restaurant feed
     */
    async populateRestaurantFeed() {
        const storiesContainer = document.getElementById('restaurantStories');
        const feedContainer = document.getElementById('restaurantFeed');
        
        try {
            // Show loading
            feedContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Try to fetch from Firebase first
            if (this.state.get('isAuthenticated') && this.db) {
                const restaurants = await this.fetchRestaurantsFromFirebase();
                
                if (restaurants.length > 0) {
                    this.populateRestaurantFeedWithData(restaurants, storiesContainer, feedContainer);
                    return;
                }
            }
            
            // Fallback to demo data
            this.populateRestaurantFeedWithData(this.mockData.getRestaurants(), storiesContainer, feedContainer);
            
        } catch (error) {
            console.error('❌ Error loading restaurants:', error);
            // Fallback to demo data
            this.populateRestaurantFeedWithData(this.mockData.getRestaurants(), storiesContainer, feedContainer);
        }
    }
    
    /**
     * Fetch restaurants from Firebase
     */
      async fetchRestaurantsFromFirebase() {
            const restaurants = [];
            
            try {
                const q = query(
                    collection(this.db, 'businesses'),
                    where('type', '==', 'restaurant'),
                    where('status', 'in', ['active', 'pending_approval']),
                    orderBy('updatedAt', 'desc'),
                );
                
                const snapshot = await getDocs(q);
                
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
                
                console.log(`✅ Fetched ${restaurants.length} restaurants from Firebase`);
                return restaurants;
                
            } catch (error) {
                console.error('❌ Error fetching restaurants from Firebase:', error);
                return [];
            }
        }
        
    
    /**
     * Populate restaurant feed with data
     */
    populateRestaurantFeedWithData(restaurants, storiesContainer = null, feedContainer = null) {
        storiesContainer = storiesContainer || document.getElementById('restaurantStories');
        feedContainer = feedContainer || document.getElementById('restaurantFeed');
        
        // Cache restaurants for story viewer
        this.cachedRestaurants = restaurants;
        console.log('💾 Cached', restaurants.length, 'restaurants for story viewer');
        
        // Populate stories
        if (storiesContainer) {
            this.populateStories('restaurantStories', restaurants);
        }
        
        // Populate feed
        if (feedContainer) {
            feedContainer.innerHTML = restaurants.map(restaurant => 
                this.createBusinessCard(restaurant, 'restaurant')
            ).join('');
            
            // Add business signup banner
            this.addBusinessSignupBanner(feedContainer);
            
            // Add admin notice if applicable
            if (this.adminManager && this.adminManager.isAdmin()) {
                this.addAdminNotice(feedContainer);
            }
        }
        
       console.log('🍽️ Restaurant feed populated with', restaurants.length, 'restaurants');
        
        // Set up logo click handlers after feed is rendered
        setTimeout(() => this.setupLogoClickHandlers(), 100);
    }
    
    /**
     * Populate activity feed
     */
    async populateActivityFeed() {
        const storiesContainer = document.getElementById('activityStories');
        const feedContainer = document.getElementById('activityFeed');
        
        try {
            feedContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Try to fetch from Firebase first
            if (this.state.get('isAuthenticated') && this.db) {
                const activities = await this.fetchActivitiesFromFirebase();
                
                if (activities.length > 0) {
                    this.populateActivityFeedWithData(activities, storiesContainer, feedContainer);
                    return;
                }
            }
            
            // Fallback to demo data
            this.populateActivityFeedWithData(this.mockData.getActivities(), storiesContainer, feedContainer);
            
        } catch (error) {
            console.error('❌ Error loading activities:', error);
            this.populateActivityFeedWithData(this.mockData.getActivities(), storiesContainer, feedContainer);
        }
    }
    
    /**
     * Fetch activities from Firebase
     */
    async fetchActivitiesFromFirebase() {
        const activities = [];
        
        const q = query(
            collection(this.db, 'businesses'),
            where('type', '==', 'activity'),
            where('status', 'in', ['active', 'pending_approval']),
            orderBy('updatedAt', 'desc'),
        );
        
        const snapshot = await getDocs(q);
        console.log(`🔍 Found ${snapshot.size} activities in Firebase`);
        
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
        
        return activities;
    }
    
   /**
     * Populate activity feed with data
     */
    populateActivityFeedWithData(activities, storiesContainer = null, feedContainer = null) {
        storiesContainer = storiesContainer || document.getElementById('activityStories');
        feedContainer = feedContainer || document.getElementById('activityFeed');
        
        console.log('🎯 Populating activity feed with', activities.length, 'activities');
        
        // Cache activities for story viewer
        this.cachedActivities = activities;
        console.log('💾 Cached', activities.length, 'activities for story viewer');
        
        // Populate stories
        if (storiesContainer) {
            this.populateStories('activityStories', activities);
        }
        
        // Populate feed
        if (feedContainer) {
            feedContainer.innerHTML = activities.map(activity => 
                this.createBusinessCard(activity, 'activity')
            ).join('');
            
            // Add business signup banner
            this.addBusinessSignupBanner(feedContainer);
        }
        
        console.log('🎯 Activity feed populated with', activities.length, 'activities');
        
       // Set up logo click handlers after feed is rendered
       setTimeout(() => this.setupLogoClickHandlers(), 100);
    }
    
    /**
     * Populate user feed
     */
    async populateUserFeed() {
        if (!this.state.get('isAuthenticated')) return;
        
        const container = document.getElementById('userFeedContainer');
        
        // CRITICAL: Check if container exists (Social screen might not be active yet)
        if (!container) {
            console.warn('⚠️ userFeedContainer not found - Social screen may not be active yet');
            return;
        }
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            const users = await this.fetchUsersFromFirebase();
            
            if (users.length > 0) {
                this.populateUserFeedWithData(users, container);
            } else {
                // Show demo users with encouraging message
                this.populateDemoUserFeed(container);
            }
            
        } catch (error) {
            console.error('❌ Error loading users:', error);
           this.showUserFeedError(container);
        }
    }
    
    /**
     * Fetch users from Firebase
     */
    async fetchUsersFromFirebase() {
        const users = [];
        const currentUserId = this.state.get('currentUser')?.uid;
        
        if (!currentUserId) return users;
        
        // Create query that excludes current user
        const q = query(
            collection(this.db, 'users'),
            orderBy('updatedAt', 'desc'),
        );
        
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            // Skip current user and incomplete profiles
            if (doc.id === currentUserId || 
                !userData.name || 
                !userData.bio || 
                !userData.interests?.length) {
                return;
            }
            
        users.push({
        id: doc.id,
        uid: doc.id,
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
        lookingFor: userData.lookingFor,
        height: userData.height,
        zodiac: userData.zodiac,
        showHoroscope: userData.showHoroscope || false
    });
        });
        
        return users;
    }
    
    /**
     * Populate user feed with data
     */
    populateUserFeedWithData(users, container) {
        container.innerHTML = '';
        
        users.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
        
        // Add activity indicator
        const activityIndicator = document.createElement('div');
        activityIndicator.innerHTML = `
            <div style="text-align: center; padding: 20px; background: rgba(0,212,255,0.1); margin: 20px 0; border-radius: 15px;">
                <h3>🔥 ${users.length} travelers active in Hoi An</h3>
                <p>Join the community and start connecting!</p>
            </div>
        `;
        container.appendChild(activityIndicator);
    }
    
    /**
     * Populate demo user feed
     */
    populateDemoUserFeed(container) {
        const demoUsers = this.mockData.getUsers();
        
        container.innerHTML = '';
        demoUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
        
        // Show encouraging message
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
    
    /**
     * Populate guest user feed
     */
    populateGuestUserFeed() {
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '';
        
        // Show first 3 users to guests
        const guestUsers = this.mockData.getUsers().slice(0, 3);
        guestUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            
            // Add guest overlay
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
                <p style="margin: 0 0 20px 0; opacity: 0.9;">Join ${this.mockData.getUsers().length}+ travelers already using CLASSIFIED</p>
                <button onclick="CLASSIFIED.showRegister()" style="background: rgba(255,255,255,0.2); border: none; padding: 12px 24px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer; margin-right: 10px;">
                    Sign Up Free
                </button>
                <button onclick="CLASSIFIED.showLogin()" style="background: transparent; border: 2px solid rgba(255,255,255,0.3); padding: 10px 22px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer;">
                    Login
                </button>
            </div>
        `;
        container.appendChild(signupCard);
    }
    
    /**
     * Filter users
     */
    filterUsers(filter) {
        console.log(`🔍 Filtering users by: ${filter}`);
        this.currentUserFilter = filter;
        
        // Update active filter chip
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
        
        // Get appropriate users based on filter
        let filteredUsers;
        if (filter === 'online') {
            filteredUsers = this.mockData.getOnlineUsers();
        } else if (filter === 'nearby') {
            filteredUsers = this.mockData.getNearbyUsers();
        } else if (filter === 'nomads') {
            filteredUsers = this.mockData.getUsersByCategory('nomads');
        } else {
            filteredUsers = this.mockData.getUsers();
        }
        
        // Re-populate feed
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '';
        filteredUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
    }
    
 
     /**
     * Create business card HTML - SECURED
     */
    createBusinessCard(business, type) {
        // Check if business is favorited
        const isFavorited = window.classifiedApp?.managers?.favoritesCarousel?.isBusinessFavorited(business.id) || false;
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
        const logoUrl = business.logo || business.photos?.[0] || '';
        logo.style.backgroundImage = `url("${logoUrl}")`;  // Use double quotes
        
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
        
        // Add all available images
        const photos = business.photos || [business.image];
        photos.slice(0, 5).forEach((photo) => {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'carousel-image';
            imageDiv.style.cssText = `
                min-width: 100%;
                width: 100%;
                height: 100%;
                flex-shrink: 0;
                scroll-snap-align: start;
                background-image: url("${photo}");
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
        
        // Track current image
        let currentIndex = 0;
        
        // Touch handling
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
       // Touch AND mouse handling for better compatibility
        const handleStart = (e) => {
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            isDragging = true;
            imageContainer.style.cursor = 'grabbing';
        };
        
        const handleMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const diff = currentX - startX;
            scrollWrapper.style.transform = `translateX(${-currentIndex * 100 + (diff / imageContainer.offsetWidth * 100)}%)`;
        };
        
        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            imageContainer.style.cursor = 'grab';
            const diff = currentX - startX;
            
            if (Math.abs(diff) > 50) { // Swipe threshold
                if (diff > 0 && currentIndex > 0) {
                    currentIndex--;
                } else if (diff < 0 && currentIndex < photos.length - 1) {
                    currentIndex++;
                }
            }
            
            // Update position and dots
            scrollWrapper.style.transform = `translateX(${-currentIndex * 100}%)`;
            dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, i) => {
                dot.style.background = i === currentIndex ? 'white' : 'rgba(255,255,255,0.5)';
            });
            
            // Reset for next swipe
            startX = 0;
            currentX = 0;
        };
        
        // Add both touch and mouse events
        imageContainer.addEventListener('touchstart', handleStart, { passive: true });
        imageContainer.addEventListener('touchmove', handleMove, { passive: false });
        imageContainer.addEventListener('touchend', handleEnd);
        
        // Mouse events for desktop testing
        imageContainer.addEventListener('mousedown', handleStart);
        imageContainer.addEventListener('mousemove', handleMove);
        imageContainer.addEventListener('mouseup', handleEnd);
        imageContainer.addEventListener('mouseleave', handleEnd);
        
        // Prevent card click on swipe
        imageContainer.addEventListener('click', (e) => {
            if (Math.abs(currentX - startX) > 5) {
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
     * Create user feed item
     */
    
 createUserFeedItem(user, index) {
    // Sanitize user data FIRST
    const safeName = sanitizeText(user.name || 'User');
    const safeBio = sanitizeText(user.bio || 'No bio');
    const safeAge = parseInt(user.age) || 25;
    
    // Define userId BEFORE using it
    const userId = user.uid || user.id || `demo_${safeName.toLowerCase().replace(/\s/g, '_')}`;
    
    // Now create the element with userId available
    const feedItem = document.createElement('div');
    feedItem.className = 'user-feed-item';
    feedItem.style.animationDelay = `${index * 0.1}s`;
    feedItem.style.cursor = 'pointer';
    feedItem.dataset.userId = userId; // Now this works!
        
        const userWithId = {
            ...user,
            uid: userId,
            id: userId,
            name: safeName,
            bio: safeBio,
            age: safeAge
        };
        
        feedItem.addEventListener('click', (e) => {
            if (!e.target.closest('.user-actions')) {
                window.CLASSIFIED.openUserProfile(userWithId);
            }
        });
        
        // Build HTML safely - only using sanitized data
        feedItem.innerHTML = `
            <div class="user-status-badges">
                ${user.isOnline ? '<div class="status-badge status-online">🟢 Online</div>' : ''}
                <div class="status-badge status-distance">📍 ${escapeHtml(user.distance)}</div>
                <div class="status-badge status-match">🔥 ${parseInt(user.matchPercentage) || 75}% Match</div>
            </div>
            <div class="user-image" style="background-image: url('${escapeHtml(user.image)}')">
                <div class="user-image-overlay">
                    <div class="user-name">${escapeHtml(safeName)}, ${safeAge}</div>
                </div>
            </div>
            <div class="user-info">
                <div class="user-bio">${escapeHtml(safeBio)}</div>
                <div class="user-interests">
                    ${(user.interests || []).map(interest => 
                        `<span class="interest-tag">${escapeHtml(sanitizeText(interest))}</span>`
                    ).join('')}
                </div>
              <div class="user-actions">
                    <button class="action-btn pass-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('pass', '${userId}')">
                        <span style="font-size: 24px;">✕</span>
                        <span style="font-size: 12px; margin-top: 4px;">Pass</span>
                    </button>
                    <button class="action-btn like-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('like', '${userId}')">
                        <span style="font-size: 24px;">⭐️</span>
                        <span style="font-size: 12px; margin-top: 4px;">Like</span>
                    </button>
                </div>
            </div>
        `;
        
        return feedItem;
    }

    /**
     * Add business signup banner
     */
    addBusinessSignupBanner(container) {
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
    }

    /**
     * ==========================================
     * DAILY STORIES IMPLEMENTATION
     * ==========================================
     */
    
    /**
     * Populate stories carousel with businesses
     */
    async populateStories(storiesContainerId, businesses) {
        console.log('📖 [populateStories] Called with:', {
            containerId: storiesContainerId,
            businessCount: businesses?.length || 0,
            businesses: businesses
        });
        
        const container = document.getElementById(storiesContainerId);
        if (!container) {
            console.error('❌ [populateStories] Container not found:', storiesContainerId);
            return;
        }
        if (!businesses || businesses.length === 0) {
            console.warn('⚠️ [populateStories] No businesses to display');
            return;
        }
        
        console.log('📖 [populateStories] Creating story items for businesses:', 
            businesses.map(b => ({ name: b.name, id: b.id, hasPhoto: !!b.photos?.[0] }))
        );
        
       // Create story items
        container.innerHTML = businesses.map((business, index) => {
            const image = business.image || business.photos?.[0] || business.logo || '';
            const name = sanitizeText(business.name || 'Unknown');
            const type = sanitizeText(business.type || business.cuisine || 'Business');
            
            console.log(`📖 [populateStories] Creating carousel item ${index}:`, {
                index,
                businessId: business.id,
                name: business.name,
                type: business.type || business.cuisine,
                imageSource: business.image ? 'business.image' : business.photos?.[0] ? 'business.photos[0]' : business.logo ? 'business.logo' : 'none',
                imageUrl: image,
                hasAboutUs: !!business.aboutUs,
                aboutUsPreview: business.aboutUs?.substring(0, 50),
                hasDescription: !!business.description,
                descriptionPreview: business.description?.substring(0, 50),
                rawBusinessData: business
            });
            
            return `
                <div class="story-item" 
                     style="background-image: url('${escapeHtml(image)}')"
                     onclick="window.CLASSIFIED.openStoryViewer('${storiesContainerId}', ${index})"
                     data-business-id="${business.id}"
                     data-business-name="${escapeHtml(name)}"
                     data-index="${index}">
                    <div class="story-overlay">
                        <div class="story-title">${name}</div>
                        <div class="story-subtitle">${type}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log(`📖 Populated ${businesses.length} stories in ${storiesContainerId}`);
    }
    
    /**
     * Open story viewer
     */
    openStoryViewer(feedType, startIndex) {
        console.log('📖 [openStoryViewer] Opening story viewer:', {
            feedType,
            startIndex,
            timestamp: new Date().toISOString()
        });
        
        const businesses = this.getCurrentBusinesses(feedType);
        console.log('📖 [openStoryViewer] Retrieved businesses:', {
            count: businesses?.length || 0,
            businesses: businesses?.map(b => ({ name: b.name, hasAboutUs: !!b.aboutUs, hasDescription: !!b.description }))
        });
        
        if (!businesses || businesses.length === 0) {
            console.error('❌ [openStoryViewer] No businesses found for feedType:', feedType);
            return;
        }
        
        this.currentStories = businesses;
        this.currentStoryIndex = startIndex;
        
        console.log('📖 [openStoryViewer] Set current stories:', {
            totalStories: this.currentStories.length,
            startingAt: this.currentStoryIndex
        });
        
        // Show overlay
        const overlay = document.getElementById('storyViewerOverlay');
        if (!overlay) {
            console.error('❌ [openStoryViewer] Story viewer overlay not found in DOM');
            return;
        }
        
        console.log('📖 [openStoryViewer] Showing overlay and initializing viewer');
        overlay.style.display = 'flex';
        
        // Create progress bars
        console.log('📖 [openStoryViewer] Creating progress bars for', businesses.length, 'stories');
        this.createStoryProgressBars(businesses.length);
        
        // Show first story
        console.log('📖 [openStoryViewer] About to display story at startIndex:', startIndex);
        this.showStory(startIndex);
        
        console.log('✅ [openStoryViewer] Story viewer opened successfully');
    }

    /**
 * Open story by business ID (for deep linking)
 */
openStoryByBusinessId(businessId) {
    console.log('📖 [openStoryByBusinessId] Opening story for business:', businessId);
    
    // Get all businesses from both feeds
    const restaurants = this.cachedRestaurants || this.mockData.getRestaurants();
    const activities = this.cachedActivities || this.mockData.getActivities();
    const allBusinesses = [...restaurants, ...activities];
    
    // Find the business
    const businessIndex = allBusinesses.findIndex(b => b.id === businessId);
    
    if (businessIndex === -1) {
        console.error('❌ Business not found:', businessId);
        return;
    }
    
    // Set current stories to all businesses
    this.currentStories = allBusinesses;
    this.currentStoryIndex = businessIndex;
    
    // Show overlay
    const overlay = document.getElementById('storyViewerOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        this.createStoryProgressBars(allBusinesses.length);
        this.showStory(businessIndex);
    }
}
    
    /**
     * Get current businesses based on feed type
     */
    getCurrentBusinesses(feedType) {
        console.log('📖 [getCurrentBusinesses] Getting businesses for:', feedType);
        
        // Store businesses in memory when populating feeds
        let businesses = [];
        
        if (feedType === 'restaurantStories') {
            // Use cached Firebase restaurants if available
            businesses = this.cachedRestaurants || this.mockData.getRestaurants();
            console.log('📖 [getCurrentBusinesses] Retrieved restaurants:', {
                count: businesses.length,
                source: this.cachedRestaurants ? 'Firebase cache' : 'mock data'
            });
        } else if (feedType === 'activityStories') {
            // Use cached Firebase activities if available
            businesses = this.cachedActivities || this.mockData.getActivities();
            console.log('📖 [getCurrentBusinesses] Retrieved activities:', {
                count: businesses.length,
                source: this.cachedActivities ? 'Firebase cache' : 'mock data'
            });
        } else {
            console.warn('⚠️ [getCurrentBusinesses] Unknown feedType:', feedType);
        }
        
        return businesses;
    }
    
   /**
     * Create progress bars for stories
     */
    createStoryProgressBars(count) {
        console.log('📖 [createStoryProgressBars] Creating', count, 'progress bars');
        
        const container = document.getElementById('storyProgressBars');
        if (!container) {
            console.error('❌ [createStoryProgressBars] Progress bars container not found');
            return;
        }
        
        container.innerHTML = Array(count).fill(0).map((_, i) => `
            <div class="story-progress-bar">
                <div class="story-progress-fill" id="storyProgress${i}"></div>
            </div>
        `).join('');
        
        console.log('✅ [createStoryProgressBars] Created progress bars successfully');
    }
    
    /**
     * Show specific story
     */
    showStory(index) {
        console.log('📖 [showStory] Attempting to show story at index:', index, {
            hasCurrentStories: !!this.currentStories,
            totalStories: this.currentStories?.length,
            isValidIndex: index >= 0 && index < (this.currentStories?.length || 0)
        });
        
        if (!this.currentStories || index < 0 || index >= this.currentStories.length) {
            console.warn('⚠️ [showStory] Invalid index or no stories, closing viewer');
            this.closeStoryViewer();
            return;
        }
        
        const business = this.currentStories[index];
        this.currentStoryIndex = index;
        
        console.log('📖 [showStory] Displaying business story:', {
            index,
            businessName: business.name,
            businessId: business.id,
            hasPhoto: !!business.photos?.[0],
            photoUrl: business.photos?.[0],
            hasAboutUs: !!business.aboutUs,
            aboutUsLength: business.aboutUs?.length || 0,
            hasDescription: !!business.description,
            descriptionLength: business.description?.length || 0,
            hasStory: !!business.story,
            storyLength: business.story?.length || 0
        });
        
        // Update progress bars
        for (let i = 0; i < this.currentStories.length; i++) {
            const progressFill = document.getElementById(`storyProgress${i}`);
            if (progressFill) {
                if (i < index) {
                    progressFill.style.width = '100%';
                    progressFill.style.transition = 'none';
                } else if (i === index) {
                    progressFill.style.width = '0%';
                    progressFill.style.transition = 'none';
                    // Animate current story
                    setTimeout(() => {
                        progressFill.style.width = '100%';
                        progressFill.style.transition = 'width 5s linear';
                    }, 50);
                } else {
                    progressFill.style.width = '0%';
                    progressFill.style.transition = 'none';
                }
            }
        }
        
       // Update business info (SECURITY: using textContent)
        const logo = document.getElementById('storyBusinessLogo');
        const name = document.getElementById('storyBusinessName');
        const type = document.getElementById('storyBusinessType');
        
        const logoSrc = business.logo || business.photos?.[0] || '';
        const displayName = sanitizeText(business.name || 'Unknown');
        const displayType = sanitizeText(business.type || business.cuisine || 'Business');
        
        console.log('📖 [showStory] Setting header info:', {
            logoSrc,
            displayName,
            displayType,
            logoElement: !!logo,
            nameElement: !!name,
            typeElement: !!type
        });
        
        if (logo) logo.src = logoSrc;
        if (name) name.textContent = displayName;
        if (type) type.textContent = displayType;
        
        // Update story image
        const storyImage = document.getElementById('storyImage');
        const imageSrc = business.photos?.[0] || business.image || business.logo || '';
        
        console.log('📖 [showStory] Setting story image:', {
            imageSrc,
            imageSource: business.photos?.[0] ? 'photos[0]' : business.image ? 'image' : business.logo ? 'logo' : 'none',
            imageElement: !!storyImage
        });
        
        if (storyImage) {
            storyImage.src = imageSrc;
        } else {
            console.error('❌ [showStory] Story image element not found');
        }
        
       // Update story text (About Us) - SECURITY: using textContent
        const textOverlay = document.getElementById('storyTextOverlay');
        if (textOverlay) {
            const aboutUs = business.aboutUs || business.description || business.story || 'Welcome to our business!';
            
            // Truncate if too long (max 350 characters)
            const maxLength = 350;
            const truncatedText = aboutUs.length > maxLength 
                ? aboutUs.substring(0, maxLength) + '...' 
                : aboutUs;
            
            console.log('📖 [showStory] Setting text overlay:', {
                source: business.aboutUs ? 'aboutUs' : business.description ? 'description' : business.story ? 'story' : 'fallback',
                originalLength: aboutUs.length,
                truncated: aboutUs.length > maxLength,
                displayLength: truncatedText.length,
                preview: truncatedText.substring(0, 100)
            });
            
            textOverlay.textContent = sanitizeText(truncatedText);
        } else {
            console.error('❌ [showStory] Text overlay element not found');
        }

        // Reset paused state for new story
        this.storyPaused = false;
        
        // Store current business for profile viewing
        window.currentStoryBusiness = business;
        
        console.log('📖 [showStory] ===== DATA CONSISTENCY CHECK =====');
        console.log('📖 [showStory] Carousel showed:', {
            name: business.name,
            type: business.type || business.cuisine
        });
        console.log('📖 [showStory] Story overlay displays:', {
            headerName: displayName,
            headerType: displayType,
            textContent: textOverlay?.textContent?.substring(0, 100)
        });
       console.log('📖 [showStory] Data source mapping:', {
            nameMatch: business.name === displayName,
            typeMatch: (business.type || business.cuisine) === displayType,
            imageSource: business.photos?.[0] ? 'photos[0]' : business.image ? 'image' : 'logo',
            textSource: business.aboutUs ? 'aboutUs' : business.description ? 'description' : business.story ? 'story' : 'fallback',
            hasAboutUs: !!business.aboutUs,
            aboutUsLength: business.aboutUs?.length || 0
        });
        console.log('📖 [showStory] ===================================');
        
        // Auto-advance after 5 seconds (unless paused)
        if (this.storyTimeout) clearTimeout(this.storyTimeout);
        this.storyTimeout = setTimeout(() => {
            if (!this.storyPaused) {
                this.nextStory();
            }
        }, 5000);
        
        console.log(`📖 Showing story ${index + 1} of ${this.currentStories.length}: ${business.name}`);
    }

  /**
     * Toggle story pause on tap
     */
    toggleStoryPause() {
        this.storyPaused = !this.storyPaused;
        
        console.log(`📖 [toggleStoryPause] Story ${this.storyPaused ? 'PAUSED' : 'RESUMED'}`);
        
        const currentProgress = document.getElementById(`storyProgress${this.currentStoryIndex}`);
        if (currentProgress) {
            if (this.storyPaused) {
                currentProgress.style.animationPlayState = 'paused';
            } else {
                currentProgress.style.animationPlayState = 'running';
            }
        }
    }
      
   /**
     * Go to next story
     */
    nextStory() {
        console.log('📖 [nextStory] Moving to next story:', {
            currentIndex: this.currentStoryIndex,
            totalStories: this.currentStories?.length,
            hasNext: this.currentStoryIndex < (this.currentStories?.length - 1)
        });
        
        if (this.currentStoryIndex < this.currentStories.length - 1) {
            this.showStory(this.currentStoryIndex + 1);
        } else {
            console.log('📖 [nextStory] Reached end of stories, closing viewer');
            this.closeStoryViewer();
        }
    }
    
    /**
     * Go to previous story
     */
    previousStory() {
        if (this.currentStoryIndex > 0) {
            this.showStory(this.currentStoryIndex - 1);
        }
    }
    
    /**
     * Close story viewer
     */
    closeStoryViewer() {
        console.log('📖 [closeStoryViewer] Closing story viewer:', {
            hadTimeout: !!this.storyTimeout,
            hadStories: !!this.currentStories,
            lastIndex: this.currentStoryIndex
        });
        
        const overlay = document.getElementById('storyViewerOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            console.log('✅ [closeStoryViewer] Overlay hidden');
        } else {
            console.error('❌ [closeStoryViewer] Overlay element not found');
        }
        
        if (this.storyTimeout) {
            clearTimeout(this.storyTimeout);
            this.storyTimeout = null;
            console.log('✅ [closeStoryViewer] Timeout cleared');
        }
        
        this.currentStories = null;
        this.currentStoryIndex = 0;
        
        console.log('📖 [closeStoryViewer] Story viewer closed successfully');
    }
    
  /**
     * View full business profile from story
     */
    viewFullBusinessProfile() {
        console.log('📖 [viewFullBusinessProfile] ===== VIEW PROFILE BUTTON CLICKED =====');
        console.log('📖 [viewFullBusinessProfile] Current story business:', {
            exists: !!window.currentStoryBusiness,
            businessData: window.currentStoryBusiness
        });
        
        if (!window.currentStoryBusiness) {
            console.error('❌ [viewFullBusinessProfile] No current story business found');
            return;
        }
        
        const business = window.currentStoryBusiness;
        console.log('📖 [viewFullBusinessProfile] Opening profile for:', {
            businessId: business.id,
            businessName: business.name,
            businessType: business.type,
            hasWindowCLASSIFIED: !!window.CLASSIFIED,
            hasOpenBusinessProfile: !!window.CLASSIFIED?.openBusinessProfile
        });
        
        // Close story viewer first
        console.log('📖 [viewFullBusinessProfile] Closing story viewer...');
        this.closeStoryViewer();
        
        // Use window.CLASSIFIED.openBusinessProfile (same as clicking business card)
        if (window.CLASSIFIED && window.CLASSIFIED.openBusinessProfile) {
            console.log('📖 [viewFullBusinessProfile] Calling window.CLASSIFIED.openBusinessProfile');
            
            try {
                window.CLASSIFIED.openBusinessProfile(business, business.type);
                console.log('✅ [viewFullBusinessProfile] Successfully opened business profile');
            } catch (error) {
                console.error('❌ [viewFullBusinessProfile] Error opening business profile:', error);
            }
        } else {
            console.error('❌ [viewFullBusinessProfile] window.CLASSIFIED.openBusinessProfile not available');
        }
        
        console.log('📖 [viewFullBusinessProfile] =======================================');
    }
    
    /**
     * ==========================================
     * END DAILY STORIES IMPLEMENTATION
     * ==========================================
     */
    
    /**
     * Add admin notice for pending businesses
     */
    async addAdminNotice(container) {
        try {
            const q = query(
                collection(this.db, 'businesses'),
                where('status', '==', 'pending_approval')
            );
            
            const snapshot = await getDocs(q);
            
            if (snapshot.size > 0) {
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
            }
        } catch (error) {
            console.error('Error checking pending businesses:', error);
        }
    }
    
    /**
     * Show user feed error
     */
    showUserFeedError(container) {
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
    
    /**
     * Switch social tab
     */
    switchSocialTab(tabType) {
        console.log(`🔄 Switching to ${tabType} tab`);
        this.state.set('currentSocialTab', tabType);
        
        // Update tabs
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabType}"]`)?.classList.add('active');
        
        // Update content
        document.querySelectorAll('.social-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabType}Content`)?.classList.add('active');
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
        console.log('🔄 Refreshing activity feed...');
        await this.populateActivityFeed();
    }

    /**
     * Set up event listeners for logo clicks (event delegation)
     * Called from main.js after feed is populated
     */
    setupLogoClickHandlers() {
        console.log('🖱️ Setting up logo click handlers via event delegation');
        
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
                                console.log('📖 Logo clicked for business:', businessId);
                                
                                // Get business data and open story
                                const business = this.getBusinessById(businessId, type);
                                if (business && window.classifiedApp?.managers?.businessStory) {
                                    window.classifiedApp.managers.businessStory.showBusinessStory(business);
                                } else {
                                    console.warn('⚠️ Could not find business or story manager');
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
        
        console.log('✅ Logo click handlers attached');
    }
    
    /**
     * Get business data by ID
     */
    getBusinessById(businessId, type) {
        const businesses = type === 'restaurant' 
            ? (this.cachedRestaurants || this.mockData.getRestaurants())
            : (this.cachedActivities || this.mockData.getActivities());
        
        return businesses.find(b => b.id === businessId);
    }
}
