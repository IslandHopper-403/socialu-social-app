// javascript/features/business/businessDashboard.js

/**
 * Business Dashboard Manager
 * Handles dashboard initialization, stats display, real-time updates, and message inbox
 * 
 * RESPONSIBILITIES:
 * - Dashboard initialization and loading
 * - Real-time listener setup (analytics, messages, promotions)
 * - Dashboard UI updates and stats display
 * - Recent messages block management
 * - Business messages overlay (open/close/load)
 * - Listener cleanup and memory management
 * 
 * SECURITY:
 * - All user content displayed via textContent (never innerHTML)
 * - Business authentication required for all methods
 * - Proper listener cleanup to prevent memory leaks
 */

import { formatMessageTime, fetchCustomerPhoto } from '../../utils/helpers.js';
import { sanitizeText } from '../../utils/security.js';

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    onSnapshot,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

export class BusinessDashboardManager {
    constructor(firebaseServices, appState) {
        console.log('🏢 [DASHBOARD] Constructing BusinessDashboardManager');
        
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set via setManagers)
        this.navigationManager = null;
        this.messagingManager = null;
        this.businessManager = null; // Parent reference
        
        // Dashboard data cache
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
        this.analyticsListener = null;
        this.messagesListener = null;
        this.promotionsListener = null;
        this.dashboardRefreshInterval = null;
        
        // Business data
        this.currentBusinessData = null;
        this.needsProfileCompletion = false;
        
        console.log('✅ [DASHBOARD] BusinessDashboardManager constructed');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🔗 [DASHBOARD] Setting manager references');
        
        this.navigationManager = managers.navigation;
        this.messagingManager = managers.messaging;
        this.businessManager = managers.business;
        
        console.log('✅ [DASHBOARD] Manager references set:', {
            navigation: !!this.navigationManager,
            messaging: !!this.messagingManager,
            business: !!this.businessManager
        });
    }
    
    // ========== INITIALIZATION METHODS ==========
    
    /**
     * Handle business login
     */
    async handleBusinessLogin(businessData) {
        console.log('🔐 [DASHBOARD] Business user logged in:', businessData?.name);
        
        // Store business data
        this.currentBusinessData = businessData;
        
        // Check if profile needs completion
        if (businessData.status === 'pending_approval' && !businessData.description) {
            console.log('⚠️ [DASHBOARD] Business profile incomplete');
            this.needsProfileCompletion = true;
        }
        
        console.log('✅ [DASHBOARD] Business login handled');
    }
    
    /**
     * Initialize business dashboard
     */
    async initializeDashboard() {
        console.log('📊 [DASHBOARD] Initializing business dashboard at:', Date.now());
        
        // Load dashboard data
        await this.loadBusinessDashboard();
        
        // Update dashboard UI
        this.updateDashboardUI();
        
        // Show profile completion prompt if needed
        if (this.needsProfileCompletion) {
            console.log('💡 [DASHBOARD] Showing profile completion prompt');
            setTimeout(() => {
                alert('Welcome! Please complete your business profile to get approved and start appearing in feeds.');
                // Delegate to parent business manager for profile editor
                if (this.businessManager && this.businessManager.profileManager) {
                    this.businessManager.profileManager.openBusinessProfileEditor();
                }
            }, 1000);
        }
        
        // SECURITY: Set up real-time listeners with proper cleanup
        this.setupDashboardListeners();
        
        console.log('✅ [DASHBOARD] Dashboard initialization complete at:', Date.now());
        
         // ========== INITIALIZE SHARE KIT (Section 1.2) ==========
        // Small delay to ensure profile manager is ready
        setTimeout(() => {
            this.initializeShareKit();
        }, 500);
    }
  
     /**
     * Initialize Share Kit (Section 1.2)
     * Generates QR code and social templates for current business
     */
    initializeShareKit() {
        console.log('📱 [DASHBOARD] Initializing share kit at:', Date.now());
        
        // Check if we have business data
        if (!this.currentBusinessData) {
            console.error('❌ [DASHBOARD] No business data available for share kit');
            return;
        }
        
        // Check if profile manager exists
        if (!window.classifiedApp?.managers?.business?.businessProfile) {
            console.error('❌ [DASHBOARD] Profile manager not available for share kit');
            return;
        }
        
        const profileManager = window.classifiedApp.managers.business.businessProfile;
        
        // Generate QR code with current business data
        profileManager.generateSingleBusinessQR(this.currentBusinessData);
        
        // Generate and store social templates
        const templates = profileManager.getSingleBusinessSocialTemplates(this.currentBusinessData);
        profileManager.currentSocialTemplates = templates;
        
        // Set initial template (Facebook by default)
        const textarea = document.getElementById('socialTemplateText');
        if (textarea && templates.facebook) {
            textarea.value = templates.facebook;
        }
        
        console.log('✅ [DASHBOARD] Share kit initialized');
    }

    // ========== SHARE KIT METHODS - Toggle (Section 1.2) ==========
    
    /**
     * Toggle Share Kit expansion
     */
    toggleShareKit() {
        console.log('🔄 [SHARE-KIT] Toggling visibility at:', Date.now());
        
        const content = document.getElementById('shareKitContent');
        const arrow = document.getElementById('shareKitArrow');
        
        if (!content || !arrow) {
            console.error('❌ [SHARE-KIT] Elements not found');
            return;
        }
        
        // Toggle visibility
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            arrow.classList.add('rotated');
            console.log('✅ [SHARE-KIT] Expanded');
        } else {
            content.style.display = 'none';
            arrow.classList.remove('rotated');
            console.log('✅ [SHARE-KIT] Collapsed');
        }
    }
    
    /**
     * Download QR code as PNG
     * Wrapper method that calls profile manager
     */
    downloadQRAsPNG() {
        console.log('📥 [DASHBOARD] Download QR as PNG clicked');
        
        if (!window.classifiedApp?.managers?.business?.businessProfile) {
            console.error('❌ [DASHBOARD] Profile manager not available');
            alert('Feature not available. Please refresh the page.');
            return;
        }
        
        window.classifiedApp.managers.business.businessProfile.downloadQRAsPNG();
    }
    
    /**
     * Download QR code as PDF
     * Wrapper method that calls profile manager
     */
    downloadQRAsPDF() {
        console.log('📄 [DASHBOARD] Download QR as PDF clicked');
        
        if (!window.classifiedApp?.managers?.business?.businessProfile) {
            console.error('❌ [DASHBOARD] Profile manager not available');
            alert('Feature not available. Please refresh the page.');
            return;
        }
        
        window.classifiedApp.managers.business.businessProfile.downloadQRAsPDF();
    }
    
    /**
     * Copy business profile link
     * Wrapper method that calls profile manager
     */
    copySingleBusinessLink() {
        console.log('🔗 [DASHBOARD] Copy business link clicked');
        
        if (!window.classifiedApp?.managers?.business?.businessProfile) {
            console.error('❌ [DASHBOARD] Profile manager not available');
            alert('Feature not available. Please refresh the page.');
            return;
        }
        
        window.classifiedApp.managers.business.businessProfile.copySingleBusinessLink();
    }
    
    /**
     * Update social template display
     * Wrapper method that calls profile manager
     */
    updateSocialTemplateDisplay(platform) {
        console.log('🔄 [DASHBOARD] Switching social template to:', platform);
        
        if (!window.classifiedApp?.managers?.business?.businessProfile) {
            console.error('❌ [DASHBOARD] Profile manager not available');
            return;
        }
        
        window.classifiedApp.managers.business.businessProfile.updateSocialTemplateDisplay(platform);
    }
    
    /**
     * Load business dashboard data
     */
    async loadBusinessDashboard() {
        console.log('📥 [DASHBOARD] Loading dashboard data');
        
        const user = this.state.get('currentUser');
        if (!user) {
            console.error('❌ [DASHBOARD] No user found');
            return;
        }
        
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
                
                console.log('✅ [DASHBOARD] Dashboard data loaded:', this.dashboardData);
            } else {
                console.log('📭 [DASHBOARD] No analytics data found, using defaults');
            }
            
        } catch (error) {
            console.error('❌ [DASHBOARD] Error loading dashboard:', error);
        }
    }
    
    /**
     * Set up real-time listeners for dashboard stats
     * SECURITY: Firestore rules must restrict to business owner only
     */
    setupDashboardListeners() {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ [DASHBOARD] Unauthorized: Business authentication required');
            return;
        }
        
        console.log('👂 [DASHBOARD] Setting up real-time listeners at:', Date.now());
        
        // 1. Listen to business analytics collection for views
        this.setupAnalyticsListener(user.uid);
        
        // 2. Listen to messages for this business
        this.setupMessagesListener(user.uid);
        
        // 3. Listen to promotions
        this.setupPromotionsListener(user.uid);
        
        // 4. Set up auto-refresh interval (30 seconds)
        this.dashboardRefreshInterval = setInterval(() => {
            console.log('🔄 [DASHBOARD] Auto-refresh triggered');
            this.updateDashboardStats();
        }, 30000);
        
        console.log('✅ [DASHBOARD] All listeners active');
    }
    
    // ========== REAL-TIME LISTENER METHODS ==========
    
    /**
     * Set up analytics listener for real-time view counts
     */
    setupAnalyticsListener(businessId) {
        console.log('📊 [DASHBOARD] Setting up analytics listener for:', businessId);
        
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
                console.log('🧹 [DASHBOARD] Cleaning up old analytics listener');
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
                    
                    console.log('📈 [DASHBOARD] Analytics update:', { todayViews, todayMessages });
                    
                    // Update dashboard data
                    this.dashboardData.todayViews = todayViews;
                    
                    // Update UI with textContent (SECURITY)
                    const viewsEl = document.getElementById('businessViewsCount');
                    if (viewsEl) viewsEl.textContent = todayViews;
                },
                (error) => {
                    console.error('❌ [DASHBOARD] Analytics listener error:', error);
                }
            );
            
            console.log('✅ [DASHBOARD] Analytics listener active');
            
        } catch (error) {
            console.error('❌ [DASHBOARD] Error setting up analytics listener:', error);
        }
    }
    
    /**
     * Set up messages listener for unread count
     */
    setupMessagesListener(businessId) {
        console.log('💬 [DASHBOARD] Setting up messages listener for:', businessId);
        
        try {
            // Query the businessConversations collection
            const messagesQuery = query(
                collection(this.db, 'businessConversations'),
                where('businessId', '==', businessId),
                orderBy('lastMessageTime', 'desc'),
                limit(50)
            );
            
            // SECURITY: Clean up previous listener
            if (this.messagesListener) {
                console.log('🧹 [DASHBOARD] Cleaning up old messages listener');
                this.messagesListener();
                this.messagesListener = null;
            }
            
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
                    
                    console.log('💬 [DASHBOARD] Messages update:', {
                        total: conversations.length,
                        unread: unreadCount
                    });
                    
                    this.dashboardData.messages = unreadCount;
                    
                    // Update UI with textContent (SECURITY)
                    const messagesEl = document.getElementById('businessMessagesCount');
                    if (messagesEl) messagesEl.textContent = unreadCount;
                    
                    // Update Recent Messages block on dashboard
                    this.updateRecentMessagesBlock(conversations);
                    
                    // Update Messages count block on dashboard
                    this.updateMessagesCountBlock(unreadCount, conversations.length);
                },
                (error) => {
                    console.error('❌ [DASHBOARD] Messages listener error:', error);
                }
            );
            
            console.log('✅ [DASHBOARD] Messages listener active');
            
        } catch (error) {
            console.error('❌ [DASHBOARD] Error setting up messages listener:', error);
        }
    }
    
    /**
     * Set up promotions listener
     */
    setupPromotionsListener(businessId) {
        console.log('📢 [DASHBOARD] Setting up promotions listener for:', businessId);
        
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
                console.log('🧹 [DASHBOARD] Cleaning up old promotions listener');
                this.promotionsListener();
            }
            
            // Real-time listener for promotions
            this.promotionsListener = onSnapshot(promotionsQuery,
                (snapshot) => {
                    const promotions = [];
                    snapshot.forEach(doc => {
                        promotions.push({ id: doc.id, ...doc.data() });
                    });
                    
                    console.log('📢 [DASHBOARD] Promotions update:', promotions.length);
                    
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
                },
                (error) => {
                    console.error('❌ [DASHBOARD] Promotions listener error:', error);
                }
            );
            
            console.log('✅ [DASHBOARD] Promotions listener active');
            
        } catch (error) {
            console.error('❌ [DASHBOARD] Error setting up promotions listener:', error);
        }
    }
    
    /**
     * Update dashboard stats (called by interval)
     */
    async updateDashboardStats() {
        console.log('🔄 [DASHBOARD] Updating dashboard stats');
        
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) return;
        
        try {
            // Calculate rating from reviews
            // TODO Phase 3D: Implement real reviews collection with proper Firestore rules
            // For now, use mock rating to prevent permission errors
            
            const avgRating = '5.0'; // Mock rating for MVP
            
            console.log('⭐ [DASHBOARD] Rating calculated (mock):', avgRating);
            
            /* COMMENTED OUT UNTIL REVIEWS COLLECTION HAS FIRESTORE RULES
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
            */
            
            // Update UI with textContent (SECURITY)
            const ratingEl = document.getElementById('businessRatingValue');
            if (ratingEl) ratingEl.textContent = avgRating;
            
            // Calculate response rate (mock for now)
            const responseRate = '95%';
            const responseEl = document.getElementById('businessResponseRate');
            if (responseEl) responseEl.textContent = responseRate;
            
            console.log('✅ [DASHBOARD] Stats updated');
            
        } catch (error) {
            console.error('❌ [DASHBOARD] Error updating stats:', error);
        }
    }
    
    // ========== UI UPDATE METHODS ==========
    
    /**
     * Update dashboard UI with current data
     */
    updateDashboardUI() {
        console.log('🎨 [DASHBOARD] Updating dashboard UI');
        
        const businessData = this.currentBusinessData;
        if (!businessData) {
            console.warn('⚠️ [DASHBOARD] No business data available');
            return;
        }
        
        // Update business name - SAFE (sanitized)
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
            statusEl.textContent = businessData.isOpen 
                ? 'Currently accepting orders' 
                : 'Temporarily closed';
        }
        
        // Update stats - SAFE
        this.updateDashboardStats();
        
        console.log('✅ [DASHBOARD] UI updated');
    }
    
    /**
     * Update Recent Messages block on dashboard
     */
    updateRecentMessagesBlock(conversations) {
        console.log('📝 [DASHBOARD] Updating recent messages block, count:', conversations.length);
        
        const recentBlock = document.getElementById('recentMessagesBlock');
        if (!recentBlock) {
            console.error('❌ [DASHBOARD] recentMessagesBlock element not found');
            return;
        }
        
        const recentList = document.getElementById('businessMessagesList');
        if (!recentList) {
            console.error('❌ [DASHBOARD] businessMessagesList element not found');
            return;
        }
        
        // Clear existing
        recentList.innerHTML = '';
        
        // Force display to block
        recentList.style.display = 'block';
        
        // Hide/show empty state
        const emptyState = document.getElementById('businessMessagesEmpty');
        
        // Show top 3 most recent
        const topThree = conversations.slice(0, 3);
        
        if (topThree.length === 0) {
            recentList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            console.log('📭 [DASHBOARD] No messages to display');
            return;
        }
        
        // Hide empty state when we have messages
        if (emptyState) emptyState.style.display = 'none';
        
        topThree.forEach(conv => {
            console.log('📝 [DASHBOARD] Rendering message from:', conv.userName);
            this.renderConversationItem(conv.id, conv, recentList);
        });
        
        console.log('✅ [DASHBOARD] Recent messages rendered:', topThree.length);
    }
    
    /**
     * Update Messages count block on dashboard
     */
    updateMessagesCountBlock(unreadCount, totalCount) {
        console.log('🔢 [DASHBOARD] Updating message counts:', { unread: unreadCount, total: totalCount });
        
        const countBlock = document.getElementById('messagesCountBlock');
        if (!countBlock) return;
        
        const unreadEl = countBlock.querySelector('.unread-count');
        const totalEl = countBlock.querySelector('.total-count');
        
        if (unreadEl) unreadEl.textContent = unreadCount;
        if (totalEl) totalEl.textContent = totalCount;
        
        console.log('✅ [DASHBOARD] Message counts updated');
    }
    
    // ========== MESSAGE INBOX OVERLAY METHODS ==========
    
    /**
     * Open Business Messages overlay
     * SECURITY: Filter business messages only
     */
   openBusinessMessages() {
        console.log('💬 [DASHBOARD] Opening business messages overlay');
        
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ [DASHBOARD] Unauthorized: Business authentication required');
            return;
        }
        
        // 🔧 FIX: Use navigation manager to properly register overlay in stack
        if (window.CLASSIFIED?.managers?.navigation) {
            window.CLASSIFIED.managers.navigation.showOverlay('businessMessages');
            console.log('✅ [DASHBOARD] Registered overlay with navigation stack');
        } else {
            console.error('❌ [DASHBOARD] Navigation manager not available - manual fallback');
            const overlay = document.getElementById('businessMessages');
            if (overlay) {
                overlay.classList.add('show');
            }
        }
        
        this.loadBusinessConversations();
        
        console.log('✅ [DASHBOARD] Business messages overlay opened');
    }
    
    /**
     * Close Business Messages overlay
     */
    closeBusinessMessages() {
        console.log('🔙 [DASHBOARD] Closing business messages overlay');
        
        const overlay = document.getElementById('businessMessages');
        if (overlay) {
            overlay.classList.remove('show');
        }
        
        console.log('✅ [DASHBOARD] Business messages overlay closed');
    }
    
    /**
     * Load Business Conversations
     * SECURITY: Business messages only
     */
    async loadBusinessConversations() {
        console.log('📥 [DASHBOARD] Loading business conversations');
        
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ [DASHBOARD] Unauthorized');
            return;
        }
        
        try {
            // Query businessConversations collection
            const conversationsQuery = query(
                collection(this.db, 'businessConversations'),
                where('businessId', '==', user.uid),
                orderBy('lastMessageTime', 'desc'),
                limit(50)
            );
            
            const snapshot = await getDocs(conversationsQuery);
            
            // Target the correct container inside businessMessages overlay
            const messagesOverlay = document.getElementById('businessMessages');
            const messagesList = messagesOverlay ? 
                document.getElementById('businessConversationsList') : null;
            const emptyState = messagesOverlay ? 
                document.getElementById('businessMessagesEmpty') : null;
            
            console.log('📋 [DASHBOARD] Found elements:', {
                overlay: !!messagesOverlay,
                list: !!messagesList,
                empty: !!emptyState,
                conversations: snapshot.size
            });
            
            if (snapshot.empty) {
                if (emptyState) emptyState.style.display = 'block';
                if (messagesList) messagesList.style.display = 'none';
                console.log('📭 [DASHBOARD] No conversations found');
                return;
            }
            
           // Hide empty state, show list
            if (emptyState) emptyState.style.display = 'none';
            if (messagesList) {
                messagesList.style.display = 'block';
                messagesList.innerHTML = ''; // Clear existing
                
               // Populate conversations and collect data for status bar
                const conversations = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    conversations.push(data);
                    this.renderConversationItem(doc.id, data, messagesList);
                });
                
                // 📊 [ENHANCEMENT] Update status bar with conversation analytics
                this.updateMessagesStatusBar(conversations);
                
                // 🎨 [FILTER-INIT] Initialize filter to show all by default
                console.log('🎨 [DASHBOARD] Initializing filters - all conversations visible');
                document.querySelectorAll('.business-conversations .message-item').forEach(item => {
                    item.style.display = 'flex';
                });
                
                console.log('✅ [DASHBOARD] Conversations loaded:', snapshot.size);
            }
            
        } catch (error) {
            console.error('❌ [DASHBOARD] Error loading conversations:', error);
        }
    }
    
    /**
     * Render a single conversation item
     * SECURITY: Always use textContent for user data
     */
    renderConversationItem(conversationId, data, container) {
        console.log('🎨 [DASHBOARD] Rendering conversation:', conversationId);
        
        const messageItem = document.createElement('div');
        messageItem.className = data.businessUnread > 0 ? 'message-item unread' : 'message-item';
        messageItem.dataset.conversationId = conversationId;
        
        // Avatar with actual customer photo
        const avatar = document.createElement('div');
        avatar.className = 'customer-avatar';
        
        // Fetch customer photo
        if (data.userId) {
            fetchCustomerPhoto(data.userId, this.db).then(photoUrl => {
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
        
        // Content container
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Header (name + time)
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const name = document.createElement('span');
        name.className = 'customer-name';
        name.textContent = data.userName || 'Customer'; // SECURITY: textContent
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatMessageTime(data.lastMessageTime);
        
        header.appendChild(name);
        header.appendChild(time);
        
       // Preview
        const preview = document.createElement('div');
        preview.className = 'message-preview';
        preview.textContent = data.lastMessage || 'New inquiry'; // SECURITY: textContent
        
        content.appendChild(header);
        content.appendChild(preview);
        
        // Message Tags
        if (data.lastMessageType) {
            console.log('🏷️ [DASHBOARD] Rendering tag:', data.lastMessageType);
            
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'message-tags';
            
            const tag = document.createElement('span');
            tag.className = `message-tag ${data.lastMessageType}`;
            
            // Set tag text based on type
            if (data.lastMessageType === 'booking') {
                tag.textContent = 'Booking Request';
            } else if (data.lastMessageType === 'urgent') {
                tag.textContent = 'Urgent';
            } else if (data.lastMessageType === 'question') {
                tag.textContent = 'Question';
            }
            
            tagsContainer.appendChild(tag);
            content.appendChild(tagsContainer);
        }
        
       messageItem.appendChild(avatar);
        messageItem.appendChild(content);
        
        // 🔧 FIX: Unread badge positioned on messageItem (top right corner)
        if (data.businessUnread > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = data.businessUnread.toString();
            console.log('🔴 [DASHBOARD] Adding unread badge:', data.businessUnread);
            messageItem.appendChild(badge); // Append to messageItem, not content
        }
        
        // Click handler - opens conversation in chat
        messageItem.onclick = () => {
            console.log('🖱️ [DASHBOARD] Conversation clicked:', conversationId);
            
            // Close business messages overlay first
            const messagesOverlay = document.getElementById('businessMessages');
            if (messagesOverlay) {
                messagesOverlay.classList.remove('show');
                console.log('✅ [DASHBOARD] Closed business messages overlay');
            }
            
            // Open conversation in chat via messaging manager
            if (this.messagingManager && this.messagingManager.businessMessaging) {
                this.messagingManager.businessMessaging
                    .openBusinessConversationFromDashboard(conversationId);
            } else {
                console.error('❌ [DASHBOARD] Messaging manager not available');
            }
        };
        
        container.appendChild(messageItem);
    }
    
   /**
     * Update Messages Inbox Status Bar
     * Shows: New Today, Urgent Count, Avg Response Time
     * @param {Array} conversations - Array of conversation objects
     */
    updateMessagesStatusBar(conversations) {
        console.log('📊 [DASHBOARD] Updating messages status bar');
        
        if (!conversations || conversations.length === 0) {
            console.log('📭 [DASHBOARD] No conversations to analyze');
            return;
        }
        
         const now = Date.now();
        const todayStart = new Date().setHours(0, 0, 0, 0);
        
        let newToday = 0;
        let urgent = 0;
        
        // Get business user ID for sender comparison
        const user = this.state.get('currentUser');
        const businessUserId = user?.uid;
        
        conversations.forEach(conv => {
            const messageTime = conv.lastMessageTime?.toMillis?.() || conv.lastMessageTime || 0;
            
            // Count messages from today
            if (messageTime >= todayStart) {
                newToday++;
                console.log('  📅 [DASHBOARD] Message from today:', conv.userName);
            }
            
            // 🔧 FIX: Count urgent only if message is FROM user TO business
            const messageAge = now - messageTime;
            const isFromUser = conv.lastMessageSender !== businessUserId;
            
            if (conv.businessUnread > 0 && messageAge < 5 * 60 * 1000 && isFromUser) {
                urgent++;
                console.log('  🚨 [DASHBOARD] Urgent message from user:', conv.userName, {
                    lastSender: conv.lastMessageSender,
                    businessId: businessUserId,
                    isFromUser
                });
            } else if (conv.businessUnread > 0 && messageAge < 5 * 60 * 1000 && !isFromUser) {
                console.log('  ⏭️ [DASHBOARD] Skipping urgent (business sent last message):', conv.userName);
            }
        });
        
        // Update DOM elements in status bar
        const newTodayEl = document.getElementById('newMessagesToday');
        const urgentEl = document.getElementById('urgentMessages');
        
        if (newTodayEl) {
            newTodayEl.textContent = newToday;
            console.log('  ✅ [DASHBOARD] New today count:', newToday);
        }
        
          if (urgentEl) {
            urgentEl.textContent = urgent;
            console.log('  ✅ [DASHBOARD] Urgent count:', urgent);
        }
        
        // Demo Avg Response Time (TODO: Calculate from actual data)
        const avgResponseEl = document.getElementById('avgResponseTime');
        if (avgResponseEl) {
            // Demo data: Random between 1.5h - 3.5h
            const demoHours = (Math.random() * 2 + 1.5).toFixed(1);
            avgResponseEl.textContent = `${demoHours}h`;
            console.log('  ⏱️ [DASHBOARD] Demo avg response time:', demoHours + 'h');
        }
        
        // Update filter badges with counts
        console.log('🔢 [DASHBOARD] Updating filter badges');
        
        const allBadge = document.getElementById('allMessagesBadge');
        const unreadBadge = document.getElementById('unreadMessagesBadge');
        
        // Count unread conversations
        const unreadCount = conversations.filter(conv => conv.businessUnread > 0).length;
        
        // Update all messages badge (show total count if > 0)
        if (allBadge) {
            if (conversations.length > 0) {
                allBadge.textContent = conversations.length;
                allBadge.style.display = 'block';
                console.log('  📊 [DASHBOARD] All messages badge:', conversations.length);
            } else {
                allBadge.style.display = 'none';
            }
        }
        
        // Update unread badge (show red dot if unread > 0)
        if (unreadBadge) {
            if (unreadCount > 0) {
                unreadBadge.textContent = unreadCount;
                unreadBadge.style.display = 'block';
                console.log('  🔴 [DASHBOARD] Unread badge:', unreadCount);
            } else {
                unreadBadge.style.display = 'none';
            }
        }
        
        console.log('✅ [DASHBOARD] Status bar updated:', { newToday, urgent, unreadCount });
    }

    // ========== CLEANUP METHODS ==========
    
    /**
     * Clean up all dashboard listeners
     * SECURITY: Must be called on logout/cleanup
     */
    cleanupDashboardListeners() {
        console.log('🧹 [DASHBOARD] Cleaning up dashboard listeners');
        
        if (this.analyticsListener) {
            this.analyticsListener();
            this.analyticsListener = null;
            console.log('✅ [DASHBOARD] Analytics listener cleaned');
        }
        
        if (this.messagesListener) {
            this.messagesListener();
            this.messagesListener = null;
            console.log('✅ [DASHBOARD] Messages listener cleaned');
        }
        
        if (this.promotionsListener) {
            this.promotionsListener();
            this.promotionsListener = null;
            console.log('✅ [DASHBOARD] Promotions listener cleaned');
        }
        
        if (this.dashboardRefreshInterval) {
            clearInterval(this.dashboardRefreshInterval);
            this.dashboardRefreshInterval = null;
            console.log('✅ [DASHBOARD] Refresh interval cleared');
        }
        
        console.log('✅ [DASHBOARD] All listeners cleaned up');
    }
    
    /**
     * Cleanup business dashboard resources
     * Called on logout or manager destruction
     */
    cleanup() {
        console.log('🧹 [DASHBOARD] Cleaning up business dashboard');
        
        // SECURITY: Clean up all listeners to prevent memory leaks
        this.cleanupDashboardListeners();
        
        // Clear cached data
        this.currentBusinessData = null;
        this.dashboardData = {
            views: 0,
            clicks: 0,
            messages: 0,
            promotions: [],
            todayViews: 0,
            rating: 0,
            responseRate: 0
        };
        
        console.log('✅ [DASHBOARD] Cleanup complete');
    }
}
