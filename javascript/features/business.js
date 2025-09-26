// javascript/features/business.js


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
        
        // Load business dashboard
        await this.loadBusinessDashboard();
        
        // Show business-specific UI elements
        this.showBusinessUI();
        
        // Check if profile needs completion
        if (businessData.status === 'pending_approval' && !businessData.description) {
            setTimeout(() => {
                alert('Welcome! Please complete your business profile to get approved and start appearing in feeds.');
                this.profileManager.openBusinessProfileEditor();
            }, 1000);
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
                alert('Business not found');
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
            
            if (businessType === 'restaurant') {
                return mockData.getRestaurantById(businessId);
            } else if (businessType === 'activity') {
                return mockData.getActivityById(businessId);
            }
        }
        return null;
    }
    
     * Update business profile UI (FIXED - Combined method)
     */
    updateBusinessProfileUI(business) {
        // Update header
        document.getElementById('profileHeaderTitle').textContent = business.type || 'Business';
        
        // Update hero
        const heroElement = document.getElementById('profileHero');
        if (heroElement && business.image) {
            heroElement.style.backgroundImage = `url('${business.image}')`;
        }
        
        // Update basic info
        document.getElementById('profileName').textContent = business.name || 'Business Name';
        document.getElementById('profileType').textContent = business.type || 'Business Type';
        
        // Update promotion
        if (business.promo) {
            document.getElementById('profilePromoTitle').textContent = business.promo;
            document.getElementById('profilePromoDetails').textContent = business.details || '';
        } else if (business.promoTitle) {
            document.getElementById('profilePromoTitle').textContent = business.promoTitle;
            document.getElementById('profilePromoDetails').textContent = business.promoDetails || '';
        }
        
        // Update description
        document.getElementById('profileDescription').textContent = 
            business.description || 'A great place to visit in Hoi An';
        
        // Update details
        document.getElementById('profileLocation').textContent = 
            business.location || business.address || 'Hoi An';
        document.getElementById('profileHours').textContent = 
            business.hours || 'Check for current hours';
        document.getElementById('profilePrice').textContent = 
            business.price || business.priceRange || '$$ - Moderate';
        document.getElementById('profileContact').textContent = 
            business.contact || business.phone || 'Contact for details';
        
        // Update action buttons with messaging capability
        const actionButtons = document.querySelector('#businessProfile .action-buttons');
        const currentUser = this.state.get('currentUser');
        const isOwner = currentUser && currentUser.uid === business.id;
        
        if (actionButtons) {
            if (isOwner) {
                // Business owner sees Edit button
                actionButtons.innerHTML = `
                    <button class="action-button secondary-btn" onclick="CLASSIFIED.shareBusinessProfile()">Share</button>
                    <button class="action-button primary-btn" onclick="CLASSIFIED.openBusinessProfileEditor()">Edit Profile</button>
                `;
            } else {
                // Customers see Message button
                actionButtons.innerHTML = `
                    <button class="action-button secondary-btn" onclick="CLASSIFIED.getDirections()">Get Directions</button>
                    <button class="action-button primary-btn" onclick="CLASSIFIED.messageBusinessProfile('${business.id}', '${business.name}', '${business.image || business.logo}')">
                        💬 Message Business
                    </button>
                `;
            }
        }
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
}
