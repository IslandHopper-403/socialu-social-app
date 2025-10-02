// javascript/features/business.js

import { sanitizeText, escapeHtml } from '../utils/security.js';

import {
    doc,
    getDoc,
    setDoc,
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
            
            const avatar = document.createElement('div');
            avatar.className = 'customer-avatar';
            avatar.textContent = data.businessUnread > 0 ? '🔴' : '👤'; // Show indicator for unread
            
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
        window.currentBusinessProfileId = businessId;  // Keep this - useful for tracking
        
        try {
            this.navigationManager.showLoading();
            
            // Try to fetch from Firebase first
            let businessData = await this.fetchBusinessFromFirebase(businessId);
            
            // Fallback to mock data
            if (!businessData) {
                businessData = this.getBusinessFromMockData(businessId, businessType);
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
        
        // Update header - SAFE
        const headerTitle = document.getElementById('profileHeaderTitle');
        if (headerTitle) {
            headerTitle.textContent = sanitizeText(business.type || 'Business');
        }
        
       // Update hero - SAFE (CSS background)
        const heroElement = document.getElementById('profileHero');
        if (heroElement && (business.photos?.[0] || business.image)) {
            const imageUrl = business.photos?.[0] || business.image;
            heroElement.style.backgroundImage = `url('${escapeHtml(imageUrl)}')`;
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
                                    dot.style.background = i === currentIndex ? 'white' : 'rgba(255,255,255,0.4)';
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
        heroElement.onclick = () => this.openPhotoViewer(business);
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
     * Share business profile
     */
    shareBusinessProfile() {
        const business = this.state.get('currentBusiness');
        if (!business) return;
        
        const shareText = `Check out ${business.name} on CLASSIFIED Hoi An! 🌟`;
        const shareUrl = `${window.location.origin}/#business/${business.id}`;
        
        if (navigator.share) {
            navigator.share({
                title: business.name,
                text: shareText,
                url: shareUrl
            }).catch(err => {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            });
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(`${shareText} - ${shareUrl}`).then(() => {
                alert('Business link copied to clipboard! 📋');
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
            // Increment view counter
            const analyticsRef = doc(this.db, 'businessAnalytics', businessId);
            
            const analyticsDoc = await getDoc(analyticsRef);
            const currentViews = analyticsDoc.exists() ? (analyticsDoc.data().views || 0) : 0;
            
            await setDoc(analyticsRef, {
                views: currentViews + 1,
                lastViewedAt: serverTimestamp()
            }, { merge: true });
            
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
        avatar.textContent = '👤';
        
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
        
        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'customer-avatar';
        avatar.textContent = '👤';
        
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

    
}
