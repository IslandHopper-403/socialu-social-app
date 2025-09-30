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
    serverTimestamp
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
        
        // Business dashboard data
        this.dashboardData = {
            views: 0,
            clicks: 0,
            messages: 0,
            promotions: []
        };
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
        this.authManager = managers.auth;
        
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
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Profile back button
        const profileBackBtn = document.getElementById('profileBackBtn');
        if (profileBackBtn) {
            profileBackBtn.onclick = null;
            profileBackBtn.addEventListener('click', () => this.closeBusinessProfile());
        }
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
        
        // Set up dashboard refresh interval
        this.dashboardRefreshInterval = setInterval(() => {
            this.updateDashboardStats();
        }, 30000); // Refresh every 30 seconds
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
     * Open business profile
     */
    async openBusinessProfile(businessId, businessType) {
        console.log(`🏢 Opening ${businessType} profile: ${businessId}`);


        // ADD THIS LINE HERE:
        window.currentBusinessProfileId = businessId;
        
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
            
            // Show profile
            this.navigationManager.showOverlay('businessProfile');
            
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
        // Update header - SAFE
        document.getElementById('profileHeaderTitle').textContent = sanitizeText(business.type || 'Business');
        
        // Update hero - SAFE (CSS background)
        const heroElement = document.getElementById('profileHero');
        if (heroElement && business.image) {
            heroElement.style.backgroundImage = `url('${escapeHtml(business.image)}')`;
        }
        
        // Update basic info - SAFE
        document.getElementById('profileName').textContent = sanitizeText(business.name || 'Business Name');
        document.getElementById('profileType').textContent = sanitizeText(business.type || 'Business Type');
        
        // Update promotion - SAFE
        if (business.promo) {
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
    
    /**
     * Close business profile
     */
    closeBusinessProfile() {
        console.log('🔙 Closing business profile');
        this.navigationManager.closeOverlay('businessProfile');
        this.state.set('currentBusiness', null);
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


    // ========== OVERLAY MANAGEMENT FUNCTIONS ==========
    
    /**
     * Open Business Analytics Overlay
     */
    openBusinessAnalytics() {
        console.log('📊 Opening Business Analytics');
        const overlay = document.getElementById('businessAnalytics');
        if (overlay) {
            overlay.classList.add('show');
            this.loadAnalyticsData('today');
        }
    }
    
    /**
     * Close Business Analytics Overlay
     */
    closeBusinessAnalytics() {
        const overlay = document.getElementById('businessAnalytics');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
    
    /**
     * Change Analytics Time Range
     */
    changeAnalyticsRange(range, button) {
        // Update active button
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (button) button.classList.add('active');
        
        // Load data for new range
        this.loadAnalyticsData(range);
    }
    
    /**
     * Load Analytics Data
     */
    async loadAnalyticsData(range) {
        console.log(`📈 Loading analytics for: ${range}`);
        
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
        
        // TODO: Fetch real data from Firestore
        // For now, use mock data
        const mockData = {
            profileViews: Math.floor(Math.random() * 500) + 100,
            messages: Math.floor(Math.random() * 50) + 10,
            directions: Math.floor(Math.random() * 30) + 5,
            photoViews: Math.floor(Math.random() * 300) + 50,
            viewsChange: Math.random() * 40 - 10, // -10% to +30%
            messagesChange: Math.random() * 30 - 5,
            directionsChange: Math.random() * 25 - 5,
            photoChange: Math.random() * 35 - 10
        };
        
        // Update UI
        this.updateAnalyticsUI(mockData);
    }
    
    /**
     * Update Analytics UI
     */
    updateAnalyticsUI(data) {
        // Profile Views
        const viewsEl = document.getElementById('analyticsProfileViews');
        if (viewsEl) viewsEl.textContent = data.profileViews.toLocaleString();
        
        const viewsChangeEl = document.getElementById('analyticsViewsChange');
        if (viewsChangeEl) {
            const change = data.viewsChange.toFixed(1);
            viewsChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            viewsChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
        }
        
        // Messages
        const messagesEl = document.getElementById('analyticsMessages');
        if (messagesEl) messagesEl.textContent = data.messages.toLocaleString();
        
        const messagesChangeEl = document.getElementById('analyticsMessagesChange');
        if (messagesChangeEl) {
            const change = data.messagesChange.toFixed(1);
            messagesChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            messagesChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
        }
        
        // Continue for other metrics...
    }
    
    /**
     * Open Promotions Manager
     */
    openPromotionsManager() {
        console.log('📢 Opening Promotions Manager');
        const overlay = document.getElementById('promotionsManager');
        if (overlay) {
            overlay.classList.add('show');
            this.loadPromotions('active');
        }
    }
    
    /**
     * Close Promotions Manager
     */
    closePromotionsManager() {
        const overlay = document.getElementById('promotionsManager');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
    
    /**
     * Open Business Messages
     */
    openBusinessMessages() {
        console.log('💬 Opening Business Messages');
        const overlay = document.getElementById('businessMessages');
        if (overlay) {
            overlay.classList.add('show');
            this.loadBusinessConversations();
        }
    }
    
    /**
     * Close Business Messages
     */
    closeBusinessMessages() {
        const overlay = document.getElementById('businessMessages');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
    
    /**
     * Back to Dashboard
     */
    backToDashboard() {
        console.log('↩️ Returning to Dashboard');
        
        // Close all business overlays
        ['businessAnalytics', 'promotionsManager', 'businessMessages', 'businessInsights', 'businessProfileEditor']
            .forEach(id => {
                const overlay = document.getElementById(id);
                if (overlay) overlay.classList.remove('show');
            });
        
        // Show dashboard
        const dashboard = document.getElementById('businessDashboard');
        if (dashboard) dashboard.classList.add('show');
    }
    
    
    /**
     * Cleanup business dashboard resources
     */
    cleanup() {
        console.log('🧹 Cleaning up business dashboard');
        
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
