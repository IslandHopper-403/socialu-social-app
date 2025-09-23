// javascript/features/feed.js - Enhanced version with GUEST MODE UI added

import {
    collection,
    query,
    where,
    limit,
    getDocs,
    orderBy
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Enhanced Feed Manager with Guest Mode Support
 * Handles user feed, business feeds, and guest mode preview
 */
export class FeedManager {
    constructor(firebaseServices, appState, mockData) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.mockData = mockData;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.profileManager = null;
        
        // Current filter state
        this.currentFilter = 'all';
        this.currentSocialTab = 'userFeed';
        
        // Guest mode configuration
        this.guestModeConfig = {
            maxPreviewUsers: 3,
            showBlurred: true,
            showSignupPrompt: true
        };
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
    }
    
    /**
     * Initialize feed manager
     */
    async init() {
        console.log('📰 Initializing feed manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial feeds
        this.populateRestaurantFeed();
        this.populateActivityFeed();
        
        // Check auth state and load appropriate user feed
        const isAuthenticated = this.state.get('isAuthenticated');
        const isGuestMode = this.state.get('isGuestMode');
        
        if (isAuthenticated) {
            this.populateUserFeed();
        } else if (isGuestMode) {
            this.populateGuestUserFeed();
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Social tabs
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabType = tab.dataset.tab;
                this.switchSocialTab(tabType);
            });
        });
        
        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const filter = chip.dataset.filter;
                this.filterUsers(filter);
            });
        });
    }
    
    /**
     * Switch social tab
     */
    switchSocialTab(tabType) {
        if (this.state.get('isGuestMode') && tabType === 'messaging') {
            this.showGuestModeRestriction('messaging');
            return;
        }
        
        this.currentSocialTab = tabType;
        
        // Update tab UI
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.social-content').forEach(content => {
            content.classList.remove('active');
        });
        
        document.getElementById(`${tabType}Content`).classList.add('active');
    }
    
    /**
     * Populate user feed with guest mode support
     */
    async populateUserFeed() {
        const container = document.getElementById('userFeedContainer');
        if (!container) return;
        
        const isGuestMode = this.state.get('isGuestMode');
        
        if (isGuestMode) {
            this.populateGuestUserFeed();
            return;
        }
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            // Try to fetch real users from Firebase
            const users = await this.fetchUsersFromFirebase();
            
            // If no real users, supplement with mock data
            if (users.length === 0) {
                const mockUsers = this.mockData.getUsers();
                this.renderUserFeed(mockUsers);
            } else {
                this.renderUserFeed(users);
            }
            
        } catch (error) {
            console.error('Error loading users:', error);
            // Fallback to mock data
            const mockUsers = this.mockData.getUsers();
            this.renderUserFeed(mockUsers);
        }
    }
    
    /**
     * Populate guest user feed with preview and restrictions
     */
    populateGuestUserFeed() {
        const container = document.getElementById('userFeedContainer');
        if (!container) return;
        
        console.log('👀 Populating guest user feed...');
        
        container.innerHTML = '';
        
        // Get limited demo users
        const demoUsers = this.mockData.getUsers().slice(0, this.guestModeConfig.maxPreviewUsers);
        
        // Render guest preview cards
        demoUsers.forEach((user, index) => {
            const guestCard = this.createGuestUserCard(user, index);
            container.appendChild(guestCard);
        });
        
        // Add signup prompt
        if (this.guestModeConfig.showSignupPrompt) {
            const signupPrompt = this.createSignupPrompt();
            container.appendChild(signupPrompt);
        }
    }
    
    /**
     * Create guest user card (blurred with limitations)
     */
    createGuestUserCard(user, index) {
        const feedItem = document.createElement('div');
        feedItem.className = 'user-feed-item guest-mode-card';
        feedItem.style.animationDelay = `${index * 0.1}s`;
        
        // Add click handler for guest restriction
        feedItem.addEventListener('click', (e) => {
            if (!e.target.closest('.user-actions')) {
                this.showGuestModeRestriction('profile');
            }
        });
        
        feedItem.innerHTML = `
            <div class="user-status-badges">
                <div class="status-badge guest-mode-badge">
                    🔒 Guest Mode
                </div>
            </div>
            <div class="user-image guest-blurred" style="background-image: url('${user.image}');">
                <div class="guest-overlay">
                    <div class="guest-lock-icon">🔒</div>
                    <div class="guest-message">Sign up to view</div>
                </div>
                <div class="user-image-overlay">
                    <div class="user-name">${user.name}, ${user.age}</div>
                </div>
            </div>
            <div class="user-info">
                <div class="user-bio guest-blur-text">${user.bio.substring(0, 50)}...</div>
                <div class="user-interests">
                    ${user.interests.slice(0, 3).map(interest => `<span class="interest-tag guest-faded">${interest}</span>`).join('')}
                </div>
                <div class="user-actions">
                    <button class="action-btn guest-action-btn" onclick="event.stopPropagation(); window.CLASSIFIED.showGuestSignupPrompt()">
                        <span>🚀</span> Sign Up to Connect
                    </button>
                </div>
            </div>
        `;
        
        return feedItem;
    }
    
    /**
     * Create signup prompt for guest users
     */
    createSignupPrompt() {
        const promptElement = document.createElement('div');
        promptElement.className = 'guest-signup-prompt';
        promptElement.innerHTML = `
            <div class="signup-prompt-content">
                <div class="signup-icon">🌟</div>
                <h3>Want to see more amazing people?</h3>
                <p>Join CLASSIFIED to browse all users, chat with matches, and discover Hoi An's hidden gems!</p>
                <div class="signup-benefits">
                    <div class="benefit-item">
                        <span class="benefit-icon">💬</span>
                        <span>Chat with travelers</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">🔍</span>
                        <span>Full user browsing</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">🎯</span>
                        <span>Get matched</span>
                    </div>
                </div>
                <div class="signup-actions">
                    <button class="signup-btn primary" onclick="window.CLASSIFIED.showRegister()">
                        Create Account
                    </button>
                    <button class="signup-btn secondary" onclick="window.CLASSIFIED.showLogin()">
                        Sign In
                    </button>
                </div>
            </div>
        `;
        
        return promptElement;
    }
    
    /**
     * Render user feed (for authenticated users)
     */
    renderUserFeed(users) {
        const container = document.getElementById('userFeedContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (users.length === 0) {
            const emptyState = this.createEmptyState();
            container.appendChild(emptyState);
            return;
        }
        
        users.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
    }
    
    /**
     * Create user feed item (for authenticated users)
     */
    createUserFeedItem(user, index) {
        const feedItem = document.createElement('div');
        feedItem.className = 'user-feed-item';
        feedItem.style.animationDelay = `${index * 0.1}s`;
        feedItem.style.cursor = 'pointer';
        
        feedItem.addEventListener('click', (e) => {
            if (!e.target.closest('.user-actions')) {
                window.CLASSIFIED.openUserProfile(user);
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
                    <button class="action-btn pass-btn" onclick="event.stopPropagation(); window.CLASSIFIED.handleUserAction('pass', '${user.id || user.name}')">✕ Pass</button>
                    <button class="action-btn chat-btn" onclick="event.stopPropagation(); window.CLASSIFIED.handleUserAction('like', '${user.id || user.name}')">💬 Chat</button>
                    <button class="action-btn super-btn" onclick="event.stopPropagation(); window.CLASSIFIED.handleUserAction('superlike', '${user.id || user.name}')">⭐ Super</button>
                </div>
            </div>
        `;
        
        return feedItem;
    }
    
    /**
     * Show guest mode restriction message
     */
    showGuestModeRestriction(feature) {
        const messages = {
            messaging: 'Sign up to chat with people! 💬',
            profile: 'Sign up to view full profiles! 👤',
            connect: 'Sign up to connect with travelers! 🌟'
        };
        
        const message = messages[feature] || 'Sign up for full access! 🚀';
        
        const notification = document.createElement('div');
        notification.className = 'guest-restriction-notification';
        notification.innerHTML = `
            <div class="restriction-content">
                <div class="restriction-icon">🔒</div>
                <div class="restriction-message">${message}</div>
                <div class="restriction-actions">
                    <button onclick="window.CLASSIFIED.showRegister(); this.parentElement.parentElement.parentElement.remove();">
                        Sign Up
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" class="secondary">
                        Maybe Later
                    </button>
                </div>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 999;
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * Filter users
     */
    filterUsers(filter) {
        this.currentFilter = filter;
        
        // Update filter UI
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // If guest mode, just show message
        if (this.state.get('isGuestMode')) {
            this.showGuestModeRestriction('connect');
            return;
        }
        
        // Apply filter logic for authenticated users
        this.applyUserFilter(filter);
    }
    
    /**
     * Apply user filter
     */
    async applyUserFilter(filter) {
        const container = document.getElementById('userFeedContainer');
        if (!container) return;
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            let filteredUsers = [];
            
            if (filter === 'all') {
                filteredUsers = await this.fetchUsersFromFirebase();
            } else {
                // Apply specific filters
                filteredUsers = await this.fetchFilteredUsers(filter);
            }
            
            // Fallback to mock data if needed
            if (filteredUsers.length === 0) {
                filteredUsers = this.getFilteredMockUsers(filter);
            }
            
            this.renderUserFeed(filteredUsers);
            
        } catch (error) {
            console.error('Error filtering users:', error);
            // Fallback to mock data
            const filteredUsers = this.getFilteredMockUsers(filter);
            this.renderUserFeed(filteredUsers);
        }
    }
    
    /**
     * Get filtered mock users
     */
    getFilteredMockUsers(filter) {
        const allUsers = this.mockData.getUsers();
        
        switch (filter) {
            case 'online':
                return allUsers.filter(user => user.isOnline);
            case 'nearby':
                return allUsers.filter(user => {
                    const distance = parseFloat(user.distance);
                    return distance < 2;
                });
            case 'nomads':
                return allUsers.filter(user => user.category === 'nomads');
            default:
                return allUsers;
        }
    }
    
    /**
     * Fetch users from Firebase
     */
    async fetchUsersFromFirebase() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return [];
        
        try {
            const usersQuery = query(
                collection(this.db, 'users'),
                where('uid', '!=', currentUser.uid),
                where('userType', '!=', 'business'),
                limit(10)
            );
            
            const snapshot = await getDocs(usersQuery);
            const users = [];
            
            snapshot.forEach(doc => {
                const userData = doc.data();
                users.push({
                    id: doc.id,
                    name: userData.name || 'Anonymous',
                    age: userData.age || 25,
                    image: userData.photos?.[0] || userData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop',
                    interests: userData.interests || ['Travel', 'Adventure'],
                    bio: userData.bio || 'Exploring Hoi An and meeting new people!',
                    isOnline: Math.random() > 0.5, // Random for demo
                    distance: `${Math.floor(Math.random() * 5) + 1} km`,
                    matchPercentage: Math.floor(Math.random() * 30) + 70,
                    category: userData.category || 'all'
                });
            });
            
            return users;
            
        } catch (error) {
            console.error('Error fetching users:', error);
            return [];
        }
    }
    
    /**
     * Populate restaurant feed
     */
    populateRestaurantFeed() {
        const restaurants = this.mockData.getRestaurants();
        this.populateRestaurantFeedWithData(restaurants);
    }
    
    /**
     * Populate restaurant feed with data
     */
    populateRestaurantFeedWithData(restaurants) {
        const storiesContainer = document.getElementById('restaurantStories');
        const feedContainer = document.getElementById('restaurantFeed');
        
        if (!storiesContainer || !feedContainer) return;
        
        // Remove loading if present
        const loadingElement = feedContainer.querySelector('.loading');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        // Populate stories
        storiesContainer.innerHTML = restaurants.map(restaurant => `
            <div class="story-item" style="background-image: url('${restaurant.story}')">
                <div class="story-overlay">
                    <div class="story-title">${restaurant.name}</div>
                    <div class="story-subtitle">${restaurant.type}</div>
                </div>
            </div>
        `).join('');
        
        // Populate feed
        feedContainer.innerHTML = restaurants.map(restaurant => 
            this.createBusinessCard(restaurant, 'restaurant')
        ).join('');
    }
    
    /**
     * Populate activity feed
     */
    populateActivityFeed() {
        const activities = this.mockData.getActivities();
        this.populateActivityFeedWithData(activities);
    }
    
    /**
     * Populate activity feed with data
     */
    populateActivityFeedWithData(activities) {
        const storiesContainer = document.getElementById('activityStories');
        const feedContainer = document.getElementById('activityFeed');
        
        if (!storiesContainer || !feedContainer) return;
        
        // Remove loading if present
        const loadingElement = feedContainer.querySelector('.loading');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        // Populate stories
        storiesContainer.innerHTML = activities.map(activity => `
            <div class="story-item" style="background-image: url('${activity.story}')">
                <div class="story-overlay">
                    <div class="story-title">${activity.name}</div>
                    <div class="story-subtitle">${activity.type}</div>
                </div>
            </div>
        `).join('');
        
        // Populate feed
        feedContainer.innerHTML = activities.map(activity => 
            this.createBusinessCard(activity, 'activity')
        ).join('');
    }
    
    /**
     * Create business card
     */
    createBusinessCard(business, type) {
        return `
            <div class="business-card" onclick="window.CLASSIFIED.openBusinessProfile('${business.id}', '${type}')">
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
    }
    
    /**
     * Create empty state
     */
    createEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div style="font-size: 48px;">🔍</div>
            <h3>No users found</h3>
            <p>Try adjusting your filters or check back later</p>
        `;
        return emptyState;
    }
}
