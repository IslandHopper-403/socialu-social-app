// javascript/features/feed.js


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
    showDemoData() {
        console.log('📊 Showing demo data for guest mode');
        this.populateRestaurantFeedWithData(this.mockData.getRestaurants());
        this.populateActivityFeedWithData(this.mockData.getActivities());
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
        
        const q = query(
            collection(this.db, 'businesses'),
            where('type', '==', 'restaurant'),
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc'),
            limit(20)
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
                promo: business.promoTitle || 'Special Offer',
                details: business.promoDetails || 'Ask about our current promotions',
                description: business.description || 'Great food and atmosphere in Hoi An',
                location: business.address || 'Hoi An Ancient Town',
                hours: business.hours || 'Daily 8am-10pm',
                price: this.formatPriceRange(business.priceRange),
                contact: business.phone || '+84 123 456 789'
            });
        });
        
        return restaurants;
    }
    
    /**
     * Populate restaurant feed with data
     */
    populateRestaurantFeedWithData(restaurants, storiesContainer = null, feedContainer = null) {
        storiesContainer = storiesContainer || document.getElementById('restaurantStories');
        feedContainer = feedContainer || document.getElementById('restaurantFeed');
        
        // Populate stories
        if (storiesContainer) {
            storiesContainer.innerHTML = restaurants.slice(0, 10).map(restaurant => 
                `<div class="story-item" style="background-image: url('${restaurant.story}')">
                    <div class="story-overlay">
                        <div class="story-title">${restaurant.name}</div>
                        <div class="story-subtitle">${restaurant.type}</div>
                    </div>
                </div>`
            ).join('');
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
        
        console.log('🍽️ Restaurant feed populated with', restaurants.length, 'businesses');
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
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc'),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        
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
                price: this.formatPriceRange(business.priceRange),
                contact: business.phone || '+84 123 456 789'
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
        
        // Populate stories
        if (storiesContainer) {
            storiesContainer.innerHTML = activities.slice(0, 10).map(activity => 
                `<div class="story-item" style="background-image: url('${activity.story}')">
                    <div class="story-overlay">
                        <div class="story-title">${activity.name}</div>
                        <div class="story-subtitle">${activity.type}</div>
                    </div>
                </div>`
            ).join('');
        }
        
        // Populate feed
        if (feedContainer) {
            feedContainer.innerHTML = activities.map(activity => 
                this.createBusinessCard(activity, 'activity')
            ).join('');
            
            // Add business signup banner
            this.addBusinessSignupBanner(feedContainer);
        }
        
        console.log('🎯 Activity feed populated with', activities.length, 'businesses');
    }
    
    /**
     * Populate user feed
     */
    async populateUserFeed() {
        if (!this.state.get('isAuthenticated')) return;
        
        const container = document.getElementById('userFeedContainer');
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
            limit(20)
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
                lookingFor: userData.lookingFor
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
     * Create business card HTML - FIXED VERSION
     */
    createBusinessCard(business, type) {
        // FIXED: Safely check authentication state
        const currentUser = this.state.get('currentUser');
        const isAuthenticated = this.state.get('isAuthenticated');
        
        // Check if business is favorited (only if user is authenticated)
        const isFavorited = isAuthenticated && 
            window.classifiedApp?.managers?.favoritesCarousel?.isBusinessFavorited(business.id) || false;
        const heartIcon = isFavorited ? '❤️' : '🤍';
        
        return `
            <div class="business-card" onclick="CLASSIFIED.openBusinessProfile('${business.id}', '${type}')">
                <div class="business-header">
                    <div class="business-logo" style="background-image: url('${business.logo}')"></div>
                    <div class="business-info">
                        <h3>${business.name}</h3>
                        <p>${business.type}</p>
                    </div>
                    ${isAuthenticated && currentUser ? `
                        <button class="quick-message-btn" 
                                onclick="event.stopPropagation(); CLASSIFIED.messageBusinessProfile('${business.id}', '${business.name}', '${business.image}')"
                                style="position: absolute; right: 15px; top: 15px; background: rgba(0,212,255,0.2); 
                                       border: 1px solid rgba(0,212,255,0.3); border-radius: 50%; width: 40px; height: 40px;
                                       display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            💬
                        </button>
                    ` : ''}
                </div>
                ${isAuthenticated ? `
                    <button class="business-favorite-btn" 
                            onclick="event.stopPropagation(); CLASSIFIED.toggleBusinessFavorite('${business.id}')"
                            style="background: none; border: none; font-size: 24px; cursor: pointer; 
                                   transition: transform 0.2s ease; position: absolute; right: 15px; top: 15px;"
                            title="Save this business">
                         ${heartIcon}
                    </button>
                ` : ''}
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
    }
    
    /**
     * Create user feed item
     */
    // In feed.js, find the createUserFeedItem method and ensure it starts like this:


// In feed.js, update the createUserFeedItem method:


createUserFeedItem(user, index) {
    const feedItem = document.createElement('div');
    feedItem.className = 'user-feed-item';
    feedItem.style.animationDelay = `${index * 0.1}s`;
    feedItem.style.cursor = 'pointer';
    
    // Ensure user has an ID properly set
    const userId = user.uid || user.id || `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`;
    
    // Create a properly formatted user object
    const userWithId = {
        ...user,
        uid: userId,
        id: userId
    };
    
    // Make entire card clickable
    feedItem.addEventListener('click', (e) => {
        if (!e.target.closest('.user-actions')) {
            window.CLASSIFIED.openUserProfile(userWithId);
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
                <button class="action-btn pass-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('pass', '${userId}')">✕ Pass</button>
                <button class="action-btn chat-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('like', '${userId}')">💬 Chat</button>
                <button class="action-btn super-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('superlike', '${userId}')">⭐ Super</button>
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
}
