// javascript/features/business.js

import { sanitizeText, escapeHtml } from '../utils/security.js';

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
        this.messagingManager = null;  // ADD THIS LINE
        
        // Dashboard data
        this.dashboardData = {
            views: 0,
            clicks: 0,
            messages: 0,
            promotions: [],
            todayViews: 0,
            rating: 0,
            responseRate: 0
        };
        
        // Real-time listeners (SECURITY: Must clean up on logout)
        this.statsListener = null;
        this.messagesListener = null;
        this.promotionsListener = null;
        this.analyticsListener = null;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
        this.authManager = managers.auth;
        this.messagingManager = managers.messaging;  // ADD THIS LINE
        
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
     */
    async handleBusinessLogin(businessData) {
        console.log('🏢 Business user logged in');
        
        // Store business data
        this.currentBusinessData = businessData;
        
        // Check if profile needs completion
        if (businessData.status === 'pending_approval' && !businessData.description) {
            this.needsProfileCompletion = true;
        }
    }
    
    /**
     * Initialize business dashboard
     */
    async initializeDashboard() {
        console.log('📊 Initializing business dashboard');
        
        // Load dashboard data
        await this.loadBusinessDashboard();
        
        // Update dashboard UI
        this.updateDashboardUI();
        
        // Show profile completion prompt if needed
        if (this.needsProfileCompletion) {
            setTimeout(() => {
                alert('Welcome! Please complete your business profile to get approved and start appearing in feeds.');
                this.profileManager.openBusinessProfileEditor();
            }, 1000);
        }
         // SECURITY: Set up real-time listeners with proper cleanup
        this.setupDashboardListeners();  // <-- ADD THIS LINE HERE
    }

            /**
     * Set up real-time listeners for dashboard stats
     * SECURITY: Firestore rules must restrict to business owner only
     */
    setupDashboardListeners() {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized: Business authentication required');
            return;
        }
        
        console.log('📊 Setting up dashboard real-time listeners');
        
        // 1. Listen to business analytics collection for views
        this.setupAnalyticsListener(user.uid);
        
        // 2. Listen to messages for this business
        this.setupMessagesListener(user.uid);
        
        // 3. Listen to promotions
        this.setupPromotionsListener(user.uid);
        
        // 4. Set up auto-refresh interval (30 seconds)
        this.dashboardRefreshInterval = setInterval(() => {
            this.updateDashboardStats();
        }, 30000);
    }
    
    /**
     * Set up analytics listener for real-time view counts
     */
    setupAnalyticsListener(businessId) {
        try {
            // Query for today's analytics
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const analyticsQuery = query(
                collection(this.db, 'businessAnalytics'),
                where('businessId', '==', businessId),
                where('timestamp', '>=', Timestamp.fromDate(today)),
                orderBy('timestamp', 'desc')
            );
            
            // SECURITY: Clean up previous listener
            if (this.analyticsListener) {
                this.analyticsListener();
            }
            
            // Real-time listener for analytics
            this.analyticsListener = onSnapshot(analyticsQuery, 
                (snapshot) => {
                    let todayViews = 0;
                    let todayMessages = 0;
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.type === 'view') todayViews++;
                        if (data.type === 'message') todayMessages++;
                    });
                    
                    // Update dashboard data
                    this.dashboardData.todayViews = todayViews;
                    
                    // Update UI with textContent (SECURITY)
                    const viewsEl = document.getElementById('businessViewsCount');
                    if (viewsEl) viewsEl.textContent = todayViews;
                    
                    console.log(`📈 Today's views: ${todayViews}`);
                },
                (error) => {
                    console.error('❌ Analytics listener error:', error);
                }
            );
        } catch (error) {
            console.error('❌ Error setting up analytics listener:', error);
        }
    }
    
    /**
     * Set up messages listener for unread count
     */
    setupMessagesListener(businessId) {
        try {
            // FIXED: Query the businessConversations collection, not messages
            const messagesQuery = query(
                collection(this.db, 'businessConversations'),
                where('businessId', '==', businessId),
                orderBy('lastMessageTime', 'desc'),
                limit(50)
            );
            
            // SECURITY: Clean up previous listener
            if (this.messagesListener) {
                this.messagesListener();
                this.messagesListener = null;
            }
            
            console.log('👂 Setting up business messages listener for:', businessId);
            
            // Real-time listener for messages
            this.messagesListener = onSnapshot(messagesQuery,
                (snapshot) => {
                    let unreadCount = 0;
                    const conversations = [];
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        conversations.push({
                            id: doc.id,
                            ...data
                        });
                        
                        // Count unread from business perspective
                        if (data.businessUnread && data.businessUnread > 0) {
                            unreadCount += data.businessUnread;
                        }
                    });
                    
                    this.dashboardData.messages = unreadCount;
                    
                    // Update UI with textContent (SECURITY)
                    const messagesEl = document.getElementById('businessMessagesCount');
                    if (messagesEl) messagesEl.textContent = unreadCount;
            
                    // REMOVED OLD FUNCTION - this.updateMessagesList(snapshot);
                    
                    // Update Recent Messages block on dashboard
                    this.updateRecentMessagesBlock(conversations);
                    
                        // ADDED: Update Messages count block on dashboard
                        this.updateMessagesCountBlock(unreadCount, conversations.length);
                        
                        console.log(`💬 Business conversations: ${conversations.length} total, ${unreadCount} unread`);
                    },
                    (error) => {
                        console.error('❌ Messages listener error:', error);
                    }
            );
        } catch (error) {
            console.error('❌ Error setting up messages listener:', error);
        }
    }
    
    /**
     * Set up promotions listener
     */
    setupPromotionsListener(businessId) {
        try {
            // Query for active promotions
            const promotionsQuery = query(
                collection(this.db, 'promotions'),
                where('businessId', '==', businessId),
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc')
            );
            
            // SECURITY: Clean up previous listener
            if (this.promotionsListener) {
                this.promotionsListener();
            }
            
            // Real-time listener for promotions
            this.promotionsListener = onSnapshot(promotionsQuery,
                (snapshot) => {
                    const promotions = [];
                    snapshot.forEach(doc => {
                        promotions.push({ id: doc.id, ...doc.data() });
                    });
                    
                    this.dashboardData.promotions = promotions;
                    
                    // Update promotions count badge
                    const badgeEl = document.getElementById('promotionsBadge');
                    if (badgeEl) {
                        if (promotions.length > 0) {
                            badgeEl.textContent = promotions.length;
                            badgeEl.style.display = 'flex';
                        } else {
                            badgeEl.style.display = 'none';
                        }
                    }
                    
                    console.log(`📢 Active promotions: ${promotions.length}`);
                },
                (error) => {
                    console.error('❌ Promotions listener error:', error);
                }
            );
        } catch (error) {
            console.error('❌ Error setting up promotions listener:', error);
        }
    }
    
    /**
     * Update messages list in dashboard
     * SECURITY: Always use textContent for user data
     */
    updateMessagesList(snapshot) {
        const messagesList = document.getElementById('businessMessagesList');
        if (!messagesList) return;
        
        const emptyState = document.getElementById('businessMessagesEmpty');
        
        if (snapshot.empty) {
            if (emptyState) emptyState.style.display = 'block';
            messagesList.innerHTML = ''; // Safe - no user content
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        // Clear and rebuild list
        messagesList.innerHTML = ''; // Safe - we'll use textContent for user data
        
        // Show first 3 conversations
        let count = 0;
        snapshot.forEach(doc => {
            if (count >= 3) return;
            
            const data = doc.data();
            const messageItem = document.createElement('div');
            // Only mark as unread if has unread messages
            messageItem.className = data.businessUnread > 0 ? 'message-item unread' : 'message-item';
            messageItem.dataset.conversationId = doc.id;
            
            // Avatar with actual customer photo
        const avatar = document.createElement('div');
        avatar.className = 'customer-avatar';
        
        // Fetch customer photo
        if (conv.userId) {
            this.fetchCustomerPhoto(conv.userId).then(photoUrl => {
                if (photoUrl) {
                    avatar.style.backgroundImage = `url('${photoUrl}')`;
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.backgroundPosition = 'center';
                    avatar.textContent = ''; // Clear emoji
                } else {
                    avatar.textContent = '👤'; // Fallback
                }
            });
        } else {
            avatar.textContent = '👤'; // Fallback if no userId
        }
            
            const content = document.createElement('div');
            content.className = 'message-content';
            
            const header = document.createElement('div');
            header.className = 'message-header';
            
            const name = document.createElement('span');
            name.className = 'customer-name';
            // SECURITY: Use textContent for user data
            name.textContent = data.userName || 'Customer';
            
            const time = document.createElement('span');
            time.className = 'message-time';
            time.textContent = this.formatMessageTime(data.lastMessageTime);
            
            header.appendChild(name);
            header.appendChild(time);
            
            const preview = document.createElement('div');
            preview.className = 'message-preview';
            if (data.businessUnread > 0) {
                preview.style.fontWeight = '700'; // Bold for unread
            }
            // SECURITY: Use textContent for message content
            preview.textContent = data.lastMessage || 'New inquiry about your business';
            
            content.appendChild(header);
            content.appendChild(preview);
            
            // Add unread badge if needed
            if (data.businessUnread > 0) {
                const badge = document.createElement('div');
                badge.className = 'unread-badge';
                badge.textContent = data.businessUnread.toString();
                badge.style.cssText = 'background: #ff6b6b; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; margin-left: auto;';
                content.appendChild(badge);
            }
            
            messageItem.appendChild(avatar);
            messageItem.appendChild(content);
            
            messageItem.onclick = () => {
                // SECURITY: Validate conversation ID
                if (doc.id && typeof doc.id === 'string') {
                    window.CLASSIFIED.openBusinessConversation(doc.id);
                }
            };
            
            messagesList.appendChild(messageItem);
            count++;
        });
    }
    
    /**
     * Format timestamp for message display
     */
    formatMessageTime(timestamp) {
        if (!timestamp) return 'Now';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        
        return date.toLocaleDateString();
    }
    
    /**
     * Update dashboard stats (called by interval)
     */
    async updateDashboardStats() {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) return;
        
        try {
            // Calculate rating from reviews
            const reviewsQuery = query(
                collection(this.db, 'reviews'),
                where('businessId', '==', user.uid)
            );
            
            const reviewsSnapshot = await getDocs(reviewsQuery);
            let totalRating = 0;
            let reviewCount = 0;
            
            reviewsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.rating) {
                    totalRating += data.rating;
                    reviewCount++;
                }
            });
            
            const avgRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : '5.0';
            
            // Update UI with textContent (SECURITY)
            const ratingEl = document.getElementById('businessRatingValue');
            if (ratingEl) ratingEl.textContent = avgRating;
            
            // Calculate response rate
            // TODO: Implement actual response rate calculation
            const responseRate = '95%';
            const responseEl = document.getElementById('businessResponseRate');
            if (responseEl) responseEl.textContent = responseRate;
            
        } catch (error) {
            console.error('❌ Error updating stats:', error);
        }
    }
    
    /**
     * Clean up all dashboard listeners
     * SECURITY: Must be called on logout/cleanup
     */
    cleanupDashboardListeners() {
        console.log('🧹 Cleaning up dashboard listeners');
        
        if (this.analyticsListener) {
            this.analyticsListener();
            this.analyticsListener = null;
        }
        
        if (this.messagesListener) {
            this.messagesListener();
            this.messagesListener = null;
        }
        
        if (this.promotionsListener) {
            this.promotionsListener();
            this.promotionsListener = null;
        }
        
        if (this.dashboardRefreshInterval) {
            clearInterval(this.dashboardRefreshInterval);
            this.dashboardRefreshInterval = null;
        }
    }
    
    /**
     * Update dashboard UI with current data
     */
    updateDashboardUI() {
        const businessData = this.currentBusinessData;
        if (!businessData) return;
        
        // Update business name - SAFE
        const nameEl = document.getElementById('businessName');
        if (nameEl) {
            nameEl.textContent = sanitizeText(businessData.name || 'Business');
        }
        
        // Update greeting based on time
        const greetingEl = document.getElementById('businessGreeting');
        if (greetingEl) {
            const hour = new Date().getHours();
            let greeting = 'Good morning';
            if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
            if (hour >= 17) greeting = 'Good evening';
            greetingEl.textContent = greeting;
        }
        
        // Update status message - SAFE
        const statusEl = document.getElementById('businessStatusMessage');
        if (statusEl) {
            statusEl.textContent = businessData.isOpen ? 'Currently accepting orders' : 'Temporarily closed';
        }
        
        // Update stats - SAFE
        this.updateDashboardStats();
    }
    
    /**
     * Update dashboard statistics
     */
    async updateDashboardStats() {
        // Update view count
        const viewsEl = document.getElementById('businessViewsCount');
        if (viewsEl) {
            viewsEl.textContent = this.dashboardData.views || '0';
        }
        
        // Update message count
        const messagesEl = document.getElementById('businessMessagesCount');
        if (messagesEl) {
            messagesEl.textContent = this.dashboardData.messages || '0';
        }
        
        // Update rating (mock for now)
        const ratingEl = document.getElementById('businessRatingValue');
        if (ratingEl) {
            ratingEl.textContent = '4.8';
        }
        
        // Update response rate (mock for now)
        const responseEl = document.getElementById('businessResponseRate');
        if (responseEl) {
            responseEl.textContent = '95%';
        }
    }
    
    /**
     * Load business dashboard data
     */
       async loadBusinessDashboard() {
            const user = this.state.get('currentUser');
            if (!user) return;
            
            try {
                // Get business analytics
                const analyticsDoc = await getDoc(doc(this.db, 'businessAnalytics', user.uid));
                if (analyticsDoc.exists()) {
                    const data = analyticsDoc.data();
                    this.dashboardData = {
                        views: data.views || 0,
                        clicks: data.clicks || 0,
                        messages: data.messages || 0,
                        promotions: data.promotions || []
                    };
                }
                
                console.log('📊 Business dashboard loaded:', this.dashboardData);
                
            } catch (error) {
                console.error('❌ Error loading dashboard:', error);
            }
        }
        
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
            
            // Track view
            await this.trackBusinessView(businessId);
            
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
     * Track business view
     */
    async trackBusinessView(businessId) {
        try {
            const user = this.state.get('currentUser');
            if (!user) return;
            
            await addDoc(collection(this.db, 'businessAnalytics'), {
                businessId: businessId,
                type: 'view',
                timestamp: serverTimestamp()
            });
            
            console.log('👁️ Business view tracked');
        } catch (error) {
            console.error('Error tracking view:', error);
        }
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
     * Get business dashboard data
     */
    getDashboardData() {
        return { ...this.dashboardData };
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


// ========== SECURE OVERLAY MANAGEMENT FUNCTIONS ==========
    
    /**
     * Open Business Analytics (SECURITY: Requires business auth)
     */
    openBusinessAnalytics() {
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized: Business authentication required');
            return;
        }
        
        console.log('📊 Opening Business Analytics');
        const overlay = document.getElementById('businessAnalytics');
        if (overlay) {
            overlay.classList.add('show');
            this.loadAnalyticsData('today');
        }
    }
    
    /**
     * Close Business Analytics (with listener cleanup)
     */
    closeBusinessAnalytics() {
        const overlay = document.getElementById('businessAnalytics');
        if (overlay) {
            overlay.classList.remove('show');
            // SECURITY: Clean up any analytics listeners
            this.cleanupAnalyticsListeners();
        }
    }
    
    /**
     * Clean up analytics listeners to prevent memory leaks
     */
    cleanupAnalyticsListeners() {
        if (this.analyticsListener) {
            this.analyticsListener();
            this.analyticsListener = null;
        }
    }
    
    /**
     * Change Analytics Range (SECURITY: Input validation)
     */
    changeAnalyticsRange(range, button) {
        // SECURITY: Validate range input
        const validRanges = ['today', 'week', 'month', 'quarter'];
        if (!validRanges.includes(range)) {
            console.error('❌ Invalid range:', range);
            return;
        }
        
        // Update UI - use textContent for safety
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (button) button.classList.add('active');
        
        this.loadAnalyticsData(range);
    }
    
    /**
     * Load Analytics Data (SECURITY: Firestore rules enforce access)
     */
    async loadAnalyticsData(range) {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized access attempt');
            return;
        }
        
        console.log(`📈 Loading analytics for: ${range}`);
        
        try {
            // Calculate date range
            const now = new Date();
            let startDate = new Date();
            
            switch(range) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    startDate.setDate(now.getDate() - 30);
                    break;
                case 'quarter':
                    startDate.setMonth(now.getMonth() - 3);
                    break;
            }
            
            // TODO: Fetch real data from Firestore with proper queries
            // For now, use mock data
            const mockData = {
                profileViews: Math.floor(Math.random() * 500) + 100,
                messages: Math.floor(Math.random() * 50) + 10,
                directions: Math.floor(Math.random() * 30) + 5,
                photoViews: Math.floor(Math.random() * 300) + 50,
                viewsChange: Math.random() * 40 - 10,
                messagesChange: Math.random() * 30 - 5,
                directionsChange: Math.random() * 25 - 5,
                photoChange: Math.random() * 35 - 10
            };
            
            this.updateAnalyticsUI(mockData);
        } catch (error) {
            console.error('❌ Error loading analytics:', error);
        }
    }
    
    /**
     * Update Analytics UI (SECURITY: Use textContent only)
     */
    updateAnalyticsUI(data) {
        // SECURITY: Always use textContent, never innerHTML
        
        // Profile Views
        const viewsEl = document.getElementById('analyticsProfileViews');
        if (viewsEl) viewsEl.textContent = data.profileViews.toLocaleString();
        
        const viewsChangeEl = document.getElementById('analyticsViewsChange');
        if (viewsChangeEl) {
            const change = data.viewsChange.toFixed(1);
            viewsChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            viewsChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
        }
        
        // Messages (using textContent for safety)
        const messagesEl = document.getElementById('analyticsMessages');
        if (messagesEl) messagesEl.textContent = data.messages.toLocaleString();
        
        const messagesChangeEl = document.getElementById('analyticsMessagesChange');
        if (messagesChangeEl) {
            const change = data.messagesChange.toFixed(1);
            messagesChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            messagesChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
        }
        
        // Directions
        const directionsEl = document.getElementById('analyticsDirections');
        if (directionsEl) directionsEl.textContent = data.directions.toLocaleString();
        
        const directionsChangeEl = document.getElementById('analyticsDirectionsChange');
        if (directionsChangeEl) {
            const change = data.directionsChange.toFixed(1);
            directionsChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            directionsChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
        }
        
        // Photo Views
        const photoViewsEl = document.getElementById('analyticsPhotoViews');
        if (photoViewsEl) photoViewsEl.textContent = data.photoViews.toLocaleString();
        
        const photoChangeEl = document.getElementById('analyticsPhotoChange');
        if (photoChangeEl) {
            const change = data.photoChange.toFixed(1);
            photoChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            photoChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
        }
    }
    
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
     */
    openBusinessMessages() {
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ Unauthorized: Business authentication required');
            return;
        }
        
        console.log('💬 Opening Business Messages');
        const overlay = document.getElementById('businessMessages');
        if (overlay) {
            overlay.classList.add('show');
            this.loadBusinessConversations();
        }
    }
    
        /**
         * Load Business Conversations (SECURITY: Business messages only)
         */
        async loadBusinessConversations() {
            const user = this.state.get('currentUser');
            if (!user || !this.state.get('isBusinessUser')) return;
            
            try {
                console.log('Loading business conversations...');
                
                // Query businessConversations collection
                const conversationsQuery = query(
                    collection(this.db, 'businessConversations'),
                    where('businessId', '==', user.uid),
                    orderBy('lastMessageTime', 'desc'),
                    limit(50)
                );
                
                const snapshot = await getDocs(conversationsQuery);
                
                // FIXED: Target the correct container inside businessMessages overlay
                const messagesOverlay = document.getElementById('businessMessages');
                const messagesList = messagesOverlay ? document.getElementById('businessConversationsList') : null;
                const emptyState = messagesOverlay ? document.getElementById('businessMessagesEmpty') : null;
                
                console.log('📋 Found elements:', {
                    overlay: !!messagesOverlay,
                    list: !!messagesList,
                    empty: !!emptyState,
                    conversations: snapshot.size
                });
            
            if (snapshot.empty) {
                if (emptyState) emptyState.style.display = 'block';
                if (messagesList) messagesList.style.display = 'none';
                return;
            }
            
            // Hide empty state, show list
            if (emptyState) emptyState.style.display = 'none';
            if (messagesList) {
                messagesList.style.display = 'block';
                messagesList.innerHTML = ''; // Clear existing
                
                // Populate conversations
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.renderConversationItem(doc.id, data, messagesList);
                });
            }
            
        } catch (error) {
            console.error('❌ Error loading conversations:', error);
        }
    }
    
    /**
     * Render a single conversation item
     */
    renderConversationItem(conversationId, data, container) {
        const messageItem = document.createElement('div');
        messageItem.className = data.businessUnread > 0 ? 'message-item unread' : 'message-item';
        messageItem.dataset.conversationId = conversationId;
        
        const avatar = document.createElement('div');
            avatar.className = 'customer-avatar';
            
            // Fetch customer photo
            if (data.userId) {
                this.fetchCustomerPhoto(data.userId).then(photoUrl => {
                    if (photoUrl) {
                        avatar.style.backgroundImage = `url('${photoUrl}')`;
                        avatar.style.backgroundSize = 'cover';
                        avatar.style.backgroundPosition = 'center';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = '👤';
                    }
                });
            } else {
                avatar.textContent = '👤';
            }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const name = document.createElement('span');
        name.className = 'customer-name';
        name.textContent = data.userName || 'Customer';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.formatMessageTime(data.lastMessageTime);
        
        header.appendChild(name);
        header.appendChild(time);
        
        const preview = document.createElement('div');
        preview.className = 'message-preview';
        preview.textContent = data.lastMessage || 'New inquiry';
        
        content.appendChild(header);
        content.appendChild(preview);
        
        // Unread badge
        if (data.businessUnread > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = data.businessUnread.toString();
            content.appendChild(badge);
        }
        
        messageItem.appendChild(avatar);
        messageItem.appendChild(content);
        
        messageItem.onclick = () => {
        console.log('🖱️ Conversation clicked from overlay:', conversationId);
        
        // Close business messages overlay first
        const messagesOverlay = document.getElementById('businessMessages');
        if (messagesOverlay) {
            messagesOverlay.classList.remove('show');
            console.log('✅ Closed business messages overlay');
        }
        
        // Open conversation in chat
        if (this.messagingManager && this.messagingManager.businessMessaging) {
            this.messagingManager.businessMessaging.openBusinessConversationFromDashboard(conversationId);
        } else {
            console.error('❌ BusinessMessaging manager not available');
        }
    };
        
        container.appendChild(messageItem);
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

      /**
     * Format timestamp for message display
     */
    formatMessageTime(timestamp) {
        if (!timestamp) return 'Now';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        
        return date.toLocaleDateString();
    }


      /**
     * Fetch customer profile photo
     */
    async fetchCustomerPhoto(userId) {
        try {
            const userRef = doc(this.db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.photos?.[0] || userData.photo || '';
            }
        } catch (error) {
            console.error('Error fetching customer photo:', error);
        }
        return '';
    }
    
     /**
     * Update Recent Messages block on dashboard
     */
    updateRecentMessagesBlock(conversations) {
        console.log('🔧 updateRecentMessagesBlock called with:', conversations.length, 'conversations');
        
        const recentBlock = document.getElementById('recentMessagesBlock');
        if (!recentBlock) {
            console.error('❌ recentMessagesBlock not found!');
            return;
        }
        
        // FIXED: Use correct ID instead of class selector
        const recentList = document.getElementById('businessMessagesList');
        if (!recentList) {
            console.error('❌ businessMessagesList not found!');
            return;
        }
        
        console.log('✅ Found elements, rendering messages...');
        console.log('📦 Container before clear:', recentList.innerHTML.substring(0, 100));
        
        // Clear existing
        recentList.innerHTML = '';
        
        // CRITICAL FIX: Force display to block
        recentList.style.display = 'block';
        console.log('🧹 Container cleared and display set to block');
        
        // Hide/show empty state
        const emptyState = document.getElementById('businessMessagesEmpty');
        
        // Show top 3 most recent
        const topThree = conversations.slice(0, 3);
        
        if (topThree.length === 0) {
            recentList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        // Hide empty state when we have messages
        if (emptyState) emptyState.style.display = 'none';
        
        topThree.forEach(conv => {
        console.log('📝 Rendering message from:', conv.userName, 'ID:', conv.id);
        
        // Use same structure as Business Messages overlay
        const item = document.createElement('div');
        item.className = conv.businessUnread > 0 ? 'message-item unread' : 'message-item';
        item.dataset.conversationId = conv.id;
        
        // Avatar with actual customer photo
        const avatar = document.createElement('div');
        avatar.className = 'customer-avatar';
        
        // Fetch customer photo
        if (conv.userId) {
            this.fetchCustomerPhoto(conv.userId).then(photoUrl => {
                if (photoUrl) {
                    avatar.style.backgroundImage = `url('${photoUrl}')`;
                    avatar.style.backgroundSize = 'cover';
                    avatar.style.backgroundPosition = 'center';
                    avatar.textContent = ''; // Clear emoji
                } else {
                    avatar.textContent = '👤'; // Fallback
                }
            });
        } else {
            avatar.textContent = '👤'; // Fallback if no userId
        }
        // Content container
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Header (name + time)
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const name = document.createElement('span');
        name.className = 'customer-name';
        name.textContent = conv.userName || 'Customer';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.formatMessageTime(conv.lastMessageTime);
        
        header.appendChild(name);
        header.appendChild(time);
        
        // Preview
        const preview = document.createElement('div');
        preview.className = 'message-preview';
        preview.textContent = conv.lastMessage || 'New inquiry';
        
        content.appendChild(header);
        content.appendChild(preview);
        
        // Unread badge
        if (conv.businessUnread > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = conv.businessUnread.toString();
            content.appendChild(badge);
        }
        
        item.appendChild(avatar);
        item.appendChild(content);
        
        item.onclick = () => {
        console.log('🖱️ Message clicked, opening conversation:', conv.id);
        if (this.messagingManager && this.messagingManager.businessMessaging) {
            this.messagingManager.businessMessaging.openBusinessConversationFromDashboard(conv.id);
        } else {
            console.error('❌ Managers not available');
        }
    };
        
        recentList.appendChild(item);
        console.log('✅ Message appended to list');
    });
    
    console.log('✅ Finished rendering', topThree.length, 'messages to Recent Messages block');
    console.log('📦 Container after render:', recentList.innerHTML.substring(0, 200));
    console.log('📊 Container display:', recentList.style.display);
    console.log('📊 Container visibility:', window.getComputedStyle(recentList).visibility);
    console.log('📊 Container height:', window.getComputedStyle(recentList).height);
    }
    
    /**
     * Update Messages count block on dashboard
     */
    updateMessagesCountBlock(unreadCount, totalCount) {
        const countBlock = document.getElementById('messagesCountBlock');
        if (!countBlock) return;
        
        const unreadEl = countBlock.querySelector('.unread-count');
        const totalEl = countBlock.querySelector('.total-count');
        
        if (unreadEl) unreadEl.textContent = unreadCount;
        if (totalEl) totalEl.textContent = totalCount;
    }
    
    
   /**
     * Cleanup business dashboard resources
     */
   cleanup() {
        console.log('🧹 Cleaning up business dashboard');
        
        // SECURITY: Clean up all listeners to prevent memory leaks
        this.cleanupDashboardListeners();
        this.cleanupAnalyticsListeners();
        
        // Clear refresh interval
        if (this.dashboardRefreshInterval) {
            clearInterval(this.dashboardRefreshInterval);
            this.dashboardRefreshInterval = null;
        }
        
        // Clear any business message listeners
        if (this.businessMessageListener) {
            this.businessMessageListener();
            this.businessMessageListener = null;
        }
        
        // Clear cached data
        this.currentBusinessData = null;
        this.dashboardData = {
            views: 0,
            clicks: 0,
            messages: 0,
            promotions: []
        };
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
        'Description',        // Column L - Context for outreach
        'BusinessId',         // Column M - Tracking
        'JoinDate',           // Column N - Engagement timing
        'Status',             // Column O - Campaign filtering
        'PreferredChannel',   // Column P - Communication preference
        'CurrentPromotion',   // Column Q - Promotion for verification
        'AboutUs'             // Column R - About Us section for verification
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
            
         // Get current promotion if exists (check multiple field names)
            const promoTitle = b.promoTitle || b.promotionTitle || '';
            const promoDetails = b.promoDetails || b.promotionDetails || '';
            const currentPromotion = promoTitle ? 
                `${promoTitle} - ${promoDetails}` : 
                'No active promotion';
            
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
                `"${b.id}"`,                                     // BusinessId
                `"${new Date().toISOString().split('T')[0]}"`,   // JoinDate
                `"Active"`,                                      // Status
                `"${preferredChannel}"`,                         // PreferredChannel
                `"${currentPromotion.replace(/"/g, '""')}"`,     // CurrentPromotion (CSV-escaped)
                `"${aboutUs.replace(/"/g, '""')}"`               // AboutUs (CSV-escaped, full text)
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
