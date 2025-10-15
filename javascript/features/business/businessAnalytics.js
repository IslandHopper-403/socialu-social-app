// javascript/features/business/businessAnalytics.js

/**
 * Business Analytics Manager
 * Handles analytics overlay, data display, tracking, and insights
 * 
 * RESPONSIBILITIES:
 * - Analytics overlay open/close
 * - Time range filtering (today/week/month/quarter)
 * - Analytics data loading and display
 * - Tracking business events (views, messages, directions, photos, promotions)
 * - Listener cleanup and memory management
 * 
 * SECURITY:
 * - Business authentication required for all methods
 * - All user content displayed via textContent (never innerHTML)
 * - Input validation on time ranges
 * - Proper listener cleanup to prevent memory leaks
 * 
 * IMPLEMENTATION STATUS:
 * ✅ Analytics overlay functionality (working with mock data)
 * ✅ Time range filtering (working)
 * ✅ UI updates (working)
 * 🔄 Real Firestore tracking (stubs ready for Phase 3D)
 * 🔄 Real analytics queries (TODO Phase 3D)
 */

import { sanitizeText } from '../../utils/security.js';

import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

export class BusinessAnalyticsManager {
    constructor(firebaseServices, appState) {
        console.log('📊 [ANALYTICS] Constructing BusinessAnalyticsManager at:', Date.now());
        
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set via setManagers)
        this.navigationManager = null;
        this.businessManager = null; // Parent reference
        
        // Real-time listener (SECURITY: Must clean up on logout)
        this.analyticsListener = null;
        
        console.log('✅ [ANALYTICS] BusinessAnalyticsManager constructed');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🔗 [ANALYTICS] Setting manager references at:', Date.now());
        
        this.navigationManager = managers.navigation;
        this.businessManager = managers.business;
        
        console.log('✅ [ANALYTICS] Manager references set:', {
            navigation: !!this.navigationManager,
            business: !!this.businessManager
        });
    }
    
    // ========== ANALYTICS OVERLAY METHODS ==========
    
    /**
     * Open Business Analytics (SECURITY: Requires business auth)
     */
    openBusinessAnalytics() {
        console.log('📊 [ANALYTICS] Opening analytics overlay at:', Date.now());
        
        // SECURITY: Auth check
        if (!this.state.get('isBusinessUser')) {
            console.error('❌ [ANALYTICS] Unauthorized: Business authentication required');
            return;
        }
        
        const overlay = document.getElementById('businessAnalytics');
        if (overlay) {
            overlay.classList.add('show');
            console.log('✅ [ANALYTICS] Overlay opened');
            
            // Load initial data (today's analytics)
            this.loadAnalyticsData('today');
        } else {
            console.error('❌ [ANALYTICS] Overlay element not found');
        }
    }
    
    /**
     * Close Business Analytics (with listener cleanup)
     */
    closeBusinessAnalytics() {
        console.log('🔙 [ANALYTICS] Closing analytics overlay at:', Date.now());
        
        const overlay = document.getElementById('businessAnalytics');
        if (overlay) {
            overlay.classList.remove('show');
            console.log('✅ [ANALYTICS] Overlay closed');
        }
        
        // SECURITY: Clean up any analytics listeners
        this.cleanupAnalyticsListeners();
    }
    
    /**
     * Clean up analytics listeners to prevent memory leaks
     */
    cleanupAnalyticsListeners() {
        console.log('🧹 [ANALYTICS] Cleaning up listeners at:', Date.now());
        
        if (this.analyticsListener) {
            this.analyticsListener();
            this.analyticsListener = null;
            console.log('✅ [ANALYTICS] Listener cleaned up');
        } else {
            console.log('ℹ️ [ANALYTICS] No active listeners to clean');
        }
    }
    
    // ========== DATA LOADING & FILTERING METHODS ==========
    
    /**
     * Change Analytics Range (SECURITY: Input validation)
     */
    changeAnalyticsRange(range, button) {
        console.log('📊 [ANALYTICS] Changing range to:', range, 'at:', Date.now());
        
        // SECURITY: Validate range input
        const validRanges = ['today', 'week', 'month', 'quarter'];
        if (!validRanges.includes(range)) {
            console.error('❌ [ANALYTICS] Invalid range:', range);
            return;
        }
        
        // Update UI - remove active from all buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active to clicked button
        if (button) {
            button.classList.add('active');
            console.log('✅ [ANALYTICS] Button updated:', range);
        }
        
        // Load data for selected range
        this.loadAnalyticsData(range);
    }
    
    /**
     * Load Analytics Data (SECURITY: Firestore rules enforce access)
     * TODO Phase 3D: Replace mock data with real Firestore queries
     */
    async loadAnalyticsData(range) {
        console.log('📈 [ANALYTICS] Loading analytics data for:', range, 'at:', Date.now());
        
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ [ANALYTICS] Unauthorized access attempt');
            return;
        }
        
        try {
            // Calculate date range
            const now = new Date();
            let startDate = new Date();
            
            switch(range) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    console.log('📅 [ANALYTICS] Date range: Today from', startDate.toISOString());
                    break;
                case 'week':
                    startDate.setDate(now.getDate() - 7);
                    console.log('📅 [ANALYTICS] Date range: Last 7 days from', startDate.toISOString());
                    break;
                case 'month':
                    startDate.setDate(now.getDate() - 30);
                    console.log('📅 [ANALYTICS] Date range: Last 30 days from', startDate.toISOString());
                    break;
                case 'quarter':
                    startDate.setMonth(now.getMonth() - 3);
                    console.log('📅 [ANALYTICS] Date range: Last 3 months from', startDate.toISOString());
                    break;
            }
            
            // TODO Phase 3D: Fetch real data from Firestore
            // Query structure:
            // const analyticsQuery = query(
            //     collection(this.db, 'businessAnalytics'),
            //     where('businessId', '==', user.uid),
            //     where('timestamp', '>=', Timestamp.fromDate(startDate)),
            //     orderBy('timestamp', 'desc')
            // );
            //
            // const snapshot = await getDocs(analyticsQuery);
            // 
            // Aggregate by type:
            // let profileViews = 0;
            // let messages = 0;
            // let directions = 0;
            // let photoViews = 0;
            // 
            // snapshot.forEach(doc => {
            //     const data = doc.data();
            //     if (data.type === 'view') profileViews++;
            //     if (data.type === 'message') messages++;
            //     if (data.type === 'direction') directions++;
            //     if (data.type === 'photo') photoViews++;
            // });
            
            // For now, use mock data (temporary)
            console.log('⚠️ [ANALYTICS] Using mock data (Phase 3D will implement real queries)');
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
            
            console.log('📊 [ANALYTICS] Mock data generated:', mockData);
            
            // Update UI with data
            this.updateAnalyticsUI(mockData);
            
        } catch (error) {
            console.error('❌ [ANALYTICS] Error loading analytics:', error);
        }
    }
    
    /**
     * Update Analytics UI (SECURITY: Use textContent only)
     */
    updateAnalyticsUI(data) {
        console.log('🎨 [ANALYTICS] Updating UI with data:', data, 'at:', Date.now());
        
        // SECURITY: Always use textContent, never innerHTML
        
        // ========== Profile Views ==========
        const viewsEl = document.getElementById('analyticsProfileViews');
        if (viewsEl) {
            viewsEl.textContent = data.profileViews.toLocaleString();
            console.log('✅ [ANALYTICS] Profile views updated:', data.profileViews);
        } else {
            console.warn('⚠️ [ANALYTICS] Element not found: analyticsProfileViews');
        }
        
        const viewsChangeEl = document.getElementById('analyticsViewsChange');
        if (viewsChangeEl) {
            const change = data.viewsChange.toFixed(1);
            viewsChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            viewsChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
            console.log('✅ [ANALYTICS] Views change updated:', change);
        }
        
        // ========== Messages ==========
        const messagesEl = document.getElementById('analyticsMessages');
        if (messagesEl) {
            messagesEl.textContent = data.messages.toLocaleString();
            console.log('✅ [ANALYTICS] Messages updated:', data.messages);
        } else {
            console.warn('⚠️ [ANALYTICS] Element not found: analyticsMessages');
        }
        
        const messagesChangeEl = document.getElementById('analyticsMessagesChange');
        if (messagesChangeEl) {
            const change = data.messagesChange.toFixed(1);
            messagesChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            messagesChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
            console.log('✅ [ANALYTICS] Messages change updated:', change);
        }
        
        // ========== Directions ==========
        const directionsEl = document.getElementById('analyticsDirections');
        if (directionsEl) {
            directionsEl.textContent = data.directions.toLocaleString();
            console.log('✅ [ANALYTICS] Directions updated:', data.directions);
        } else {
            console.warn('⚠️ [ANALYTICS] Element not found: analyticsDirections');
        }
        
        const directionsChangeEl = document.getElementById('analyticsDirectionsChange');
        if (directionsChangeEl) {
            const change = data.directionsChange.toFixed(1);
            directionsChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            directionsChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
            console.log('✅ [ANALYTICS] Directions change updated:', change);
        }
        
        // ========== Photo Views ==========
        const photoViewsEl = document.getElementById('analyticsPhotoViews');
        if (photoViewsEl) {
            photoViewsEl.textContent = data.photoViews.toLocaleString();
            console.log('✅ [ANALYTICS] Photo views updated:', data.photoViews);
        } else {
            console.warn('⚠️ [ANALYTICS] Element not found: analyticsPhotoViews');
        }
        
        const photoChangeEl = document.getElementById('analyticsPhotoChange');
        if (photoChangeEl) {
            const change = data.photoChange.toFixed(1);
            photoChangeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
            photoChangeEl.className = change > 0 ? 'card-change positive' : 'card-change negative';
            console.log('✅ [ANALYTICS] Photo change updated:', change);
        }
        
        console.log('✅ [ANALYTICS] UI update complete at:', Date.now());
    }
    
    // ========== TRACKING METHODS (FOUNDATION FOR PHASE 3D) ==========
    
    /**
     * Track business profile view
     * MOVED from business.js - WORKING with real Firestore
     */
    async trackBusinessView(businessId) {
        console.log('👁️ [ANALYTICS] Tracking business view at:', Date.now());
        console.log('👁️ [ANALYTICS] BusinessId:', businessId);
        
        try {
            const user = this.state.get('currentUser');
            if (!user) {
                console.log('ℹ️ [ANALYTICS] No user logged in, skipping view tracking');
                return;
            }
            
            // Record view in businessAnalytics collection
            await addDoc(collection(this.db, 'businessAnalytics'), {
                businessId: businessId,
                type: 'view',
                timestamp: serverTimestamp(),
                userId: user.uid
            });
            
            console.log('✅ [ANALYTICS] Business view tracked successfully');
            
        } catch (error) {
            console.error('❌ [ANALYTICS] Error tracking view:', error);
        }
    }
    
    /**
     * Track message sent to business
     * TODO Phase 3D: Implement Firestore tracking
     * 
     * Collection: businessAnalytics
     * Document fields:
     * - type: 'message'
     * - businessId: string (business receiving message)
     * - userId: string (user sending message)
     * - timestamp: serverTimestamp()
     */
    async trackMessageSent(businessId) {
        console.log('💬 [ANALYTICS] STUB: Track message sent at:', Date.now());
        console.log('💬 [ANALYTICS] BusinessId:', businessId);
        console.log('⚠️ [ANALYTICS] TODO Phase 3D: Implement real Firestore tracking');
        
        // TODO Phase 3D: Uncomment and implement
        // try {
        //     const user = this.state.get('currentUser');
        //     if (!user) return;
        //     
        //     await addDoc(collection(this.db, 'businessAnalytics'), {
        //         businessId: businessId,
        //         type: 'message',
        //         timestamp: serverTimestamp(),
        //         userId: user.uid
        //     });
        //     
        //     console.log('✅ [ANALYTICS] Message tracked successfully');
        // } catch (error) {
        //     console.error('❌ [ANALYTICS] Error tracking message:', error);
        // }
    }
    
    /**
     * Track direction request to business
     * TODO Phase 3D: Implement Firestore tracking
     * 
     * Collection: businessAnalytics
     * Document fields:
     * - type: 'direction'
     * - businessId: string (business for which directions requested)
     * - userId: string (user requesting directions)
     * - timestamp: serverTimestamp()
     */
    async trackDirectionRequest(businessId) {
        console.log('🗺️ [ANALYTICS] STUB: Track direction request at:', Date.now());
        console.log('🗺️ [ANALYTICS] BusinessId:', businessId);
        console.log('⚠️ [ANALYTICS] TODO Phase 3D: Implement real Firestore tracking');
        
        // TODO Phase 3D: Uncomment and implement
        // try {
        //     const user = this.state.get('currentUser');
        //     if (!user) return;
        //     
        //     await addDoc(collection(this.db, 'businessAnalytics'), {
        //         businessId: businessId,
        //         type: 'direction',
        //         timestamp: serverTimestamp(),
        //         userId: user.uid
        //     });
        //     
        //     console.log('✅ [ANALYTICS] Direction request tracked successfully');
        // } catch (error) {
        //     console.error('❌ [ANALYTICS] Error tracking direction:', error);
        // }
    }
    
    /**
     * Track photo view in business profile
     * TODO Phase 3D: Implement Firestore tracking
     * 
     * Collection: businessAnalytics
     * Document fields:
     * - type: 'photo'
     * - businessId: string
     * - photoIndex: number (which photo was viewed)
     * - userId: string
     * - timestamp: serverTimestamp()
     */
    async trackPhotoView(businessId, photoIndex) {
        console.log('📸 [ANALYTICS] STUB: Track photo view at:', Date.now());
        console.log('📸 [ANALYTICS] BusinessId:', businessId, 'PhotoIndex:', photoIndex);
        console.log('⚠️ [ANALYTICS] TODO Phase 3D: Implement real Firestore tracking');
        
        // TODO Phase 3D: Uncomment and implement
        // try {
        //     const user = this.state.get('currentUser');
        //     if (!user) return;
        //     
        //     await addDoc(collection(this.db, 'businessAnalytics'), {
        //         businessId: businessId,
        //         type: 'photo',
        //         photoIndex: photoIndex,
        //         timestamp: serverTimestamp(),
        //         userId: user.uid
        //     });
        //     
        //     console.log('✅ [ANALYTICS] Photo view tracked successfully');
        // } catch (error) {
        //     console.error('❌ [ANALYTICS] Error tracking photo view:', error);
        // }
    }
    
    /**
     * Track promotion view
     * TODO Phase 3D: Implement Firestore tracking
     * 
     * Collection: businessAnalytics
     * Document fields:
     * - type: 'promotion'
     * - businessId: string
     * - promotionId: string (which promotion was viewed)
     * - userId: string
     * - timestamp: serverTimestamp()
     */
    async trackPromotionView(businessId, promotionId) {
        console.log('📢 [ANALYTICS] STUB: Track promotion view at:', Date.now());
        console.log('📢 [ANALYTICS] BusinessId:', businessId, 'PromotionId:', promotionId);
        console.log('⚠️ [ANALYTICS] TODO Phase 3D: Implement real Firestore tracking');
        
        // TODO Phase 3D: Uncomment and implement
        // try {
        //     const user = this.state.get('currentUser');
        //     if (!user) return;
        //     
        //     await addDoc(collection(this.db, 'businessAnalytics'), {
        //         businessId: businessId,
        //         type: 'promotion',
        //         promotionId: promotionId,
        //         timestamp: serverTimestamp(),
        //         userId: user.uid
        //     });
        //     
        //     console.log('✅ [ANALYTICS] Promotion view tracked successfully');
        // } catch (error) {
        //     console.error('❌ [ANALYTICS] Error tracking promotion:', error);
        // }
    }
    
    // ========== CLEANUP METHODS ==========
    
    /**
     * Cleanup analytics resources
     * Called on logout or manager destruction
     */
    cleanup() {
        console.log('🧹 [ANALYTICS] Cleaning up analytics manager at:', Date.now());
        
        // SECURITY: Clean up all listeners to prevent memory leaks
        this.cleanupAnalyticsListeners();
        
        console.log('✅ [ANALYTICS] Cleanup complete');
    }
}
