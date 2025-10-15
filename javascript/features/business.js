// javascript/features/business.js

import { sanitizeText, escapeHtml } from '../utils/security.js';
import { BusinessDashboardManager } from './business/businessDashboard.js';
import { BusinessAnalyticsManager } from './business/businessAnalytics.js';
import { BusinessPromotionsManager } from './business/businessPromotions.js';
import { BusinessProfileManager } from './business/businessProfile.js';

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
        
        // Initialize promotions sub-manager
        this.promotions = new BusinessPromotionsManager(firebaseServices, appState);
        console.log('✅ [BUSINESS] Promotions sub-manager initialized');
        
        // Initialize profile sub-manager
        this.businessProfile = new BusinessProfileManager(firebaseServices, appState);
        console.log('✅ [BUSINESS] Profile sub-manager initialized');
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
        
        // Pass manager references to promotions sub-manager
        this.promotions.setManagers({
            navigation: managers.navigation,
            business: this  // Parent reference
        });
        console.log('✅ [BUSINESS] Promotions manager references set');
        
        // Pass manager references to profile sub-manager
        this.businessProfile.setManagers({
            navigation: managers.navigation,
            auth: managers.auth,
            businessStory: managers.businessStory
        });
        console.log('✅ [BUSINESS] Profile manager references set');
        
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
     * DELEGATION: Passes to profile sub-manager
     */
    updateBusinessProfileUI(business) {
        return this.businessProfile.updateBusinessProfileUI(business);
    }
    
   /**
     * Close business profile
     * DELEGATION: Passes to profile sub-manager
     */
    closeBusinessProfile() {
        return this.businessProfile.closeBusinessProfile();
    }

       /**
     * Open photo viewer
     * DELEGATION: Passes to profile sub-manager
     */
    openPhotoViewer(business) {
        return this.businessProfile.openPhotoViewer(business);
    }
    
    /**
     * Close photo viewer
     * DELEGATION: Passes to profile sub-manager
     */
    closePhotoViewer() {
        return this.businessProfile.closePhotoViewer();
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


    // ========== MARKETING TOOLS DELEGATION ==========
    
    /**
     * Create business slug
     * DELEGATION: Passes to profile sub-manager
     */
    createBusinessSlug(business) {
        return this.businessProfile.createBusinessSlug(business);
    }
    
    /**
     * Share business profile
     * DELEGATION: Passes to profile sub-manager
     */
    shareBusinessProfile() {
        return this.businessProfile.shareBusinessProfile();
    }
    
    /**
     * Get directions to business
     * DELEGATION: Passes to profile sub-manager
     */
    getDirections() {
        return this.businessProfile.getDirections();
    }
    
    /**
     * Generate business URL
     * DELEGATION: Passes to profile sub-manager
     */
    generateBusinessURL(businessId) {
        return this.businessProfile.generateBusinessURL(businessId);
    }
    
    /**
     * Generate all business URLs
     * DELEGATION: Passes to profile sub-manager
     */
    async generateAllBusinessURLs(format = 'csv', category = 'all') {
        return this.businessProfile.generateAllBusinessURLs(format, category);
    }
    
    /**
     * Mass upload businesses
     * DELEGATION: Passes to profile sub-manager
     */
    async massUploadBusinesses(businessesData) {
        return this.businessProfile.massUploadBusinesses(businessesData);
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

// ========== PROMOTIONS DELEGATION METHODS ==========
    
    /**
     * Open Promotions Manager
     * DELEGATION: Passes to promotions sub-manager
     */
    openPromotionsManager() {
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ [BUSINESS] Unauthorized: Business authentication required');
            return;
        }
        return this.promotions.openPromotionsManager();
    }
    
    /**
     * Close Promotions Manager
     * DELEGATION: Passes to promotions sub-manager
     */
    closePromotionsManager() {
        return this.promotions.closePromotionsManager();
    }
    
    /**
     * Load Promotions
     * DELEGATION: Passes to promotions sub-manager
     */
    loadPromotions(status) {
        return this.promotions.loadPromotions(status);
    }
    
    /**
     * Create Promotion
     * DELEGATION: Passes to promotions sub-manager
     */
    createPromotion() {
        return this.promotions.createPromotion();
    }
    
    /**
     * Edit Promotion
     * DELEGATION: Passes to promotions sub-manager
     */
    editPromotion(promoId) {
        return this.promotions.editPromotion(promoId);
    }
    
    /**
     * Delete Promotion
     * DELEGATION: Passes to promotions sub-manager
     */
    deletePromotion(promoId) {
        return this.promotions.deletePromotion(promoId);
    }
    
    /**
     * Save Promotion
     * DELEGATION: Passes to promotions sub-manager
     */
    savePromotion(safeTitle, safeDescription) {
        return this.promotions.savePromotion(safeTitle, safeDescription);
    }
    
    /**
     * Cancel Promotion
     * DELEGATION: Passes to promotions sub-manager
     */
    cancelPromotion() {
        return this.promotions.cancelPromotion();
    }
    
    /**
     * Switch Promotion Tab
     * DELEGATION: Passes to promotions sub-manager
     */
    switchPromoTab(tab, button) {
        return this.promotions.switchPromoTab(tab, button);
    }
    
    /**
     * Toggle Promotion Status
     * DELEGATION: Passes to promotions sub-manager
     */
    togglePromotionStatus(promoId, newStatus) {
        return this.promotions.togglePromotionStatus(promoId, newStatus);
    }
    
    /**
     * Insert Quick Reply Template (SECURITY: Predefined templates only)
     * DELEGATION: Handled by dashboard sub-manager
     */
    insertQuickReply(type) {
        return this.dashboard.insertQuickReply(type);
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
        
        // Delegate promotions cleanup to sub-manager
        if (this.promotions) {
            this.promotions.cleanup();
        }
        
        // Delegate profile cleanup to sub-manager
        if (this.businessProfile) {
            this.businessProfile.cleanup();
        }
        
        // Clear local cached data
        this.currentBusinessData = null;
        
        console.log('✅ [BUSINESS] Cleanup complete');
    }
    
}
