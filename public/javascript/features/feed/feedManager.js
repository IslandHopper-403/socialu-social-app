// javascript/features/feed/feedManager.js

import { sanitizeText, escapeHtml, createSafeElement } from '../../utils/security.js';
import { getOptimizedImageURL } from '../../utils/imageUtils.js';
import { UserFeedManager } from './userFeed.js';
import { BusinessFeedManager } from './businessFeed.js';

/**
 * Feed Manager - Orchestrator
 * Coordinates user feeds, business feeds, and daily stories
 * Handles tab switching and feed initialization
 */
export class FeedManager {
    constructor(firebaseServices, appState, mockData) {
        console.log('🎯 [FeedManager] constructor() called at:', Date.now());
        console.log('🎯 [FeedManager] Initializing orchestrator...');
        
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.mockData = mockData;
        
        // Create sub-managers
        console.log('🎯 [FeedManager] Creating UserFeedManager...');
        this.userFeed = new UserFeedManager(firebaseServices, appState, mockData);
        console.log('✅ [FeedManager] UserFeedManager created');
        
        console.log('🎯 [FeedManager] Creating BusinessFeedManager...');
        this.businessFeed = new BusinessFeedManager(firebaseServices, appState, mockData);
        console.log('✅ [FeedManager] BusinessFeedManager created');
        
        // Story viewer state
        this.currentStories = null;
        this.currentStoryIndex = 0;
        this.storyTimeout = null;
        this.storyPaused = false;
        
        // References to other managers (set later)
        this.uiComponents = null;
        this.adminManager = null;
        
        console.log('✅ [FeedManager] Orchestrator initialized at:', Date.now());
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🎯 [FeedManager] setManagers() called at:', Date.now());
        console.log('🎯 [FeedManager] Setting manager references...');
        
        this.uiComponents = managers.ui;
        this.adminManager = managers.admin;
        
        // Pass references to sub-managers
        console.log('🎯 [FeedManager] Passing references to UserFeedManager...');
        this.userFeed.setManagers(managers);
        
        console.log('🎯 [FeedManager] Passing references to BusinessFeedManager...');
        this.businessFeed.setManagers(managers);
        
        // Get mockData from global app instance if not available
        if (!this.mockData && window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
            console.log('✅ [FeedManager] MockData retrieved from global app instance');
        }
        
        console.log('✅ [FeedManager] Manager references set at:', Date.now());
    }
    
    /**
     * Initialize feed system
     */
    async init() {
        console.log('🎯 [FeedManager] init() called at:', Date.now());
        console.log('🎯 [FeedManager] Initializing feed orchestrator...');
        
        // Initialize sub-managers
        console.log('🎯 [FeedManager] Initializing UserFeedManager...');
        await this.userFeed.init();
        console.log('✅ [FeedManager] UserFeedManager initialized');
        
        console.log('🎯 [FeedManager] Initializing BusinessFeedManager...');
        await this.businessFeed.init();
        console.log('✅ [FeedManager] BusinessFeedManager initialized');
        
        // Set up event listeners
        console.log('🎯 [FeedManager] Setting up event listeners...');
        this.setupEventListeners();
        
        console.log('✅ [FeedManager] Feed orchestrator initialization complete at:', Date.now());
    }
    
    /**
     * Set up event listeners for feed interactions
     */
    setupEventListeners() {
        console.log('🎯 [FeedManager] setupEventListeners() called at:', Date.now());
        
        // Social tab listeners - Remove existing onclick handlers first
        const socialTabs = document.querySelectorAll('.social-tab');
        console.log('🎯 [FeedManager] Found social tabs:', socialTabs.length);
        
        socialTabs.forEach((tab, index) => {
            tab.onclick = null;
            tab.addEventListener('click', (e) => {
                const tabType = tab.dataset.tab;
                console.log('🎯 [FeedManager] Tab clicked:', { index, tabType });
                this.switchSocialTab(tabType);
            });
        });
        
        console.log('✅ [FeedManager] Event listeners attached at:', Date.now());
    }
    
    /**
     * Load all feeds
     */
    async loadAllFeeds() {
        console.log('🎯 [FeedManager] loadAllFeeds() called at:', Date.now());
        console.log('🎯 [FeedManager] Auth state:', {
            isAuthenticated: this.state.get('isAuthenticated'),
            isGuestMode: this.state.get('isGuestMode')
        });
        
        if (this.state.get('isAuthenticated')) {
            console.log('🎯 [FeedManager] User authenticated, loading all feeds...');
            await Promise.all([
                this.populateRestaurantFeed(),
                this.populateActivityFeed()
            ]);
            console.log('✅ [FeedManager] All feeds loaded at:', Date.now());
        } else if (this.state.get('isGuestMode')) {
            console.log('🎯 [FeedManager] Guest mode active, showing demo data...');
            this.showDemoData();
        } else {
            console.log('⚠️ [FeedManager] No auth state, skipping feed load');
        }
    }
    
    /**
     * Handle user login - refresh feeds
     */
    async onUserLogin(user) {
        console.log('🎯 [FeedManager] onUserLogin() called at:', Date.now());
        console.log('🎯 [FeedManager] User logged in:', {
            uid: user.uid,
            email: user.email
        });
        
        // Delegate user feed to userFeed manager
        console.log('🎯 [FeedManager] Delegating to UserFeedManager.onUserLogin()...');
        const userFeedManager = window.classifiedApp?.managers?.userFeed;
        if (userFeedManager) {
            console.log('✅ [FeedManager] UserFeedManager found, calling onUserLogin');
            await userFeedManager.onUserLogin(user);
        } else {
            console.error('❌ [FeedManager] UserFeedManager not found!');
        }
        
        // Delegate business feeds to businessFeed manager
        console.log('🎯 [FeedManager] Delegating to BusinessFeedManager.onUserLogin()...');
        await this.businessFeed.onUserLogin(user);
        console.log('✅ [FeedManager] Business feeds refreshed');
        
        console.log('✅ [FeedManager] onUserLogin() complete at:', Date.now());
    }
    
    /**
     * Show demo data for guest mode
     */
    async showDemoData() {
        console.log('🎯 [FeedManager] showDemoData() called at:', Date.now());
        console.log('🎯 [FeedManager] Loading demo data for guest mode...');
        
        // Delegate to business feed manager
        await this.businessFeed.showDemoData();
        
        console.log('✅ [FeedManager] Demo data loaded at:', Date.now());
    }
    
    /**
     * Populate restaurant feed - DELEGATED to BusinessFeedManager
     */
    async populateRestaurantFeed() {
        console.log('🎯 [FeedManager] populateRestaurantFeed() called at:', Date.now());
        console.log('🎯 [FeedManager] Delegating to BusinessFeedManager...');
        await this.businessFeed.populateRestaurantFeed();
        console.log('✅ [FeedManager] Restaurant feed delegation complete at:', Date.now());
    }
    
    /**
     * Populate activity feed - DELEGATED to BusinessFeedManager
     */
    async populateActivityFeed() {
        console.log('🎯 [FeedManager] populateActivityFeed() called at:', Date.now());
        console.log('🎯 [FeedManager] Delegating to BusinessFeedManager...');
        await this.businessFeed.populateActivityFeed();
        console.log('✅ [FeedManager] Activity feed delegation complete at:', Date.now());
    }
    
    /**
     * Switch social tab
     */
    switchSocialTab(tabType) {
        console.log('🎯 [FeedManager] switchSocialTab() called at:', Date.now());
        console.log('🎯 [FeedManager] Switching to tab:', tabType);
        console.log('🎯 [FeedManager] Current tab:', this.state.get('currentSocialTab'));
        
        this.state.set('currentSocialTab', tabType);
        
        // Update tabs
        console.log('🎯 [FeedManager] Updating tab UI...');
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabType}"]`)?.classList.add('active');
        
        // Update content
        console.log('🎯 [FeedManager] Updating content visibility...');
        document.querySelectorAll('.social-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabType}Content`)?.classList.add('active');
        
        // CRITICAL: Load user feed when switching to "people" tab
        if (tabType === 'people') {
            console.log('🎯 [FeedManager] People tab selected, triggering user feed population');
            const userFeedManager = window.classifiedApp?.managers?.userFeed;
            if (userFeedManager) {
                // Check auth state and call appropriate function
                const isAuthenticated = this.state.get('isAuthenticated');
                const isGuestMode = this.state.get('isGuestMode');
                
                console.log('🎯 [FeedManager] Auth state:', { isAuthenticated, isGuestMode });
                
                if (isGuestMode && !isAuthenticated) {
                    // Guest mode: show demo users with signup prompt
                    console.log('✅ [FeedManager] Guest mode: calling populateGuestUserFeed()');
                    userFeedManager.populateGuestUserFeed();
                } else if (isAuthenticated) {
                    // Authenticated: load real users
                    console.log('✅ [FeedManager] Authenticated: calling populateUserFeed()');
                    userFeedManager.populateUserFeed();
                } else {
                    // Default: show demo feed
                    console.log('✅ [FeedManager] Default: calling populateDemoUserFeed()');
                    userFeedManager.populateDemoUserFeed();
                }
            } else {
                console.error('❌ [FeedManager] UserFeedManager not found!');
            }
        }
        
        // FIXED: Hide notifications when switching to messaging tab
        if (tabType === 'messaging') {
            console.log('🎯 [FeedManager] Messaging tab selected, hiding notifications');
            const notificationManager = window.classifiedApp?.managers?.notifications;
            if (notificationManager) {
                const notificationDot = document.getElementById('messageNotificationDot');
                const countBadge = document.getElementById('unreadCountBadge');
                if (notificationDot) notificationDot.style.display = 'none';
                if (countBadge) countBadge.style.display = 'none';
            }
        }
        
        console.log('✅ [FeedManager] Tab switch complete at:', Date.now());
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
        console.log('🎯 [FeedManager] populateStories() called at:', Date.now());
        console.log('🎯 [FeedManager] Parameters:', {
            containerId: storiesContainerId,
            businessCount: businesses?.length || 0
        });
        
        const container = document.getElementById(storiesContainerId);
        if (!container) {
            console.error('❌ [FeedManager] Container not found:', storiesContainerId);
            return;
        }
        if (!businesses || businesses.length === 0) {
            console.warn('⚠️ [FeedManager] No businesses to display');
            return;
        }
        
        console.log('🎯 [FeedManager] Creating story items for', businesses.length, 'businesses');
        
        // Create story items
        container.innerHTML = businesses.map((business, index) => {
            const image = business.image || 
                        getOptimizedImageURL(business.photos?.[0], 'medium') || 
                        business.logo || '';
            const name = sanitizeText(business.name || 'Unknown');
            const type = sanitizeText(business.type || business.cuisine || 'Business');
            
            console.log(`🎯 [FeedManager] Story ${index}:`, {
                businessId: business.id,
                name: business.name,
                hasImage: !!image
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
        
        console.log(`✅ [FeedManager] Populated ${businesses.length} stories at:`, Date.now());
    }
    
    /**
     * Open story viewer
     */
    openStoryViewer(feedType, startIndex) {
        console.log('🎯 [FeedManager] openStoryViewer() called at:', Date.now());
        console.log('🎯 [FeedManager] Parameters:', { feedType, startIndex });
        
        const businesses = this.getCurrentBusinesses(feedType);
        console.log('🎯 [FeedManager] Retrieved businesses:', businesses?.length || 0);
        
        if (!businesses || businesses.length === 0) {
            console.error('❌ [FeedManager] No businesses found for feedType:', feedType);
            return;
        }
        
        this.currentStories = businesses;
        this.currentStoryIndex = startIndex;
        
        console.log('🎯 [FeedManager] Set story state:', {
            totalStories: this.currentStories.length,
            startingAt: this.currentStoryIndex
        });
        
        // Show overlay
        const overlay = document.getElementById('storyViewerOverlay');
        if (!overlay) {
            console.error('❌ [FeedManager] Story viewer overlay not found in DOM');
            return;
        }
        
        console.log('🎯 [FeedManager] Showing overlay...');
        overlay.style.display = 'flex';
        
        // Create progress bars
        console.log('🎯 [FeedManager] Creating progress bars...');
        this.createStoryProgressBars(businesses.length);
        
        // Show first story
        console.log('🎯 [FeedManager] Displaying story at index:', startIndex);
        this.showStory(startIndex);
        
        console.log('✅ [FeedManager] Story viewer opened at:', Date.now());
    }
    
    /**
     * Open story by business ID (for deep linking)
     */
    openStoryByBusinessId(businessId) {
        console.log('🎯 [FeedManager] openStoryByBusinessId() called at:', Date.now());
        console.log('🎯 [FeedManager] Business ID:', businessId);
        
        // Get all businesses from both feeds (via businessFeed cache)
        const restaurants = this.businessFeed.cachedRestaurants || this.mockData.getRestaurants();
        const activities = this.businessFeed.cachedActivities || this.mockData.getActivities();
        const allBusinesses = [...restaurants, ...activities];
        
        console.log('🎯 [FeedManager] Total businesses available:', allBusinesses.length);
        
        // Find the business
        const businessIndex = allBusinesses.findIndex(b => b.id === businessId);
        
        if (businessIndex === -1) {
            console.error('❌ [FeedManager] Business not found:', businessId);
            return;
        }
        
        console.log('🎯 [FeedManager] Business found at index:', businessIndex);
        
        // Set current stories to all businesses
        this.currentStories = allBusinesses;
        this.currentStoryIndex = businessIndex;
        
        // Show overlay
        const overlay = document.getElementById('storyViewerOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            this.createStoryProgressBars(allBusinesses.length);
            this.showStory(businessIndex);
            console.log('✅ [FeedManager] Story opened by business ID at:', Date.now());
        } else {
            console.error('❌ [FeedManager] Story viewer overlay not found');
        }
    }
    
    /**
     * Get current businesses based on feed type
     */
    getCurrentBusinesses(feedType) {
        console.log('🎯 [FeedManager] getCurrentBusinesses() called at:', Date.now());
        console.log('🎯 [FeedManager] Feed type:', feedType);
        
        let businesses = [];
        
        if (feedType === 'restaurantStories') {
            businesses = this.businessFeed.cachedRestaurants || this.mockData.getRestaurants();
            console.log('🎯 [FeedManager] Retrieved restaurants:', {
                count: businesses.length,
                source: this.businessFeed.cachedRestaurants ? 'cache' : 'mock'
            });
        } else if (feedType === 'activityStories') {
            businesses = this.businessFeed.cachedActivities || this.mockData.getActivities();
            console.log('🎯 [FeedManager] Retrieved activities:', {
                count: businesses.length,
                source: this.businessFeed.cachedActivities ? 'cache' : 'mock'
            });
        } else {
            console.warn('⚠️ [FeedManager] Unknown feedType:', feedType);
        }
        
        return businesses;
    }
    
    /**
     * Create progress bars for stories
     */
    createStoryProgressBars(count) {
        console.log('🎯 [FeedManager] createStoryProgressBars() called at:', Date.now());
        console.log('🎯 [FeedManager] Creating', count, 'progress bars');
        
        const container = document.getElementById('storyProgressBars');
        if (!container) {
            console.error('❌ [FeedManager] Progress bars container not found');
            return;
        }
        
        container.innerHTML = Array(count).fill(0).map((_, i) => `
            <div class="story-progress-bar">
                <div class="story-progress-fill" id="storyProgress${i}"></div>
            </div>
        `).join('');
        
        console.log('✅ [FeedManager] Progress bars created at:', Date.now());
    }
    
    /**
     * Show specific story
     */
    showStory(index) {
        console.log('🎯 [FeedManager] showStory() called at:', Date.now());
        console.log('🎯 [FeedManager] Story index:', index);
        console.log('🎯 [FeedManager] Story state:', {
            hasStories: !!this.currentStories,
            totalStories: this.currentStories?.length,
            isValidIndex: index >= 0 && index < (this.currentStories?.length || 0)
        });
        
        if (!this.currentStories || index < 0 || index >= this.currentStories.length) {
            console.warn('⚠️ [FeedManager] Invalid index or no stories, closing viewer');
            this.closeStoryViewer();
            return;
        }
        
        const business = this.currentStories[index];
        this.currentStoryIndex = index;
        
        console.log('🎯 [FeedManager] Displaying business story:', {
            index,
            businessName: business.name,
            businessId: business.id,
            hasAboutUs: !!business.aboutUs
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
        
        const logoSrc = business.logo || 
                getOptimizedImageURL(business.photos?.[0], 'thumbnail') || '';
        const displayName = sanitizeText(business.name || 'Unknown');
        const displayType = sanitizeText(business.type || business.cuisine || 'Business');
        
        if (logo) logo.src = logoSrc;
        if (name) name.textContent = displayName;
        if (type) type.textContent = displayType;
        
        // Update story image - use optimized URL
        const storyImage = document.getElementById('storyImage');
        const imageSrc = getOptimizedImageURL(business.photos?.[0], 'large') || 
                        business.image || 
                        business.logo || '';

        if (storyImage) {
            storyImage.src = imageSrc;
            console.log('🖼️ [FEED-MANAGER] Setting story image:', {
                photoFormat: typeof business.photos?.[0],
                optimizedUrl: imageSrc.substring(0, 50) + '...'
            });
        } else {
            console.error('❌ [FeedManager] Story image element not found');
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
            
            console.log('🎯 [FeedManager] Setting text overlay:', {
                source: business.aboutUs ? 'aboutUs' : business.description ? 'description' : 'fallback',
                originalLength: aboutUs.length,
                truncated: aboutUs.length > maxLength
            });
            
            textOverlay.textContent = sanitizeText(truncatedText);
        } else {
            console.error('❌ [FeedManager] Text overlay element not found');
        }
        
        // Reset paused state for new story
        this.storyPaused = false;
        
        // Store current business for profile viewing
        window.currentStoryBusiness = business;
        
        // Auto-advance after 5 seconds (unless paused)
        if (this.storyTimeout) clearTimeout(this.storyTimeout);
        this.storyTimeout = setTimeout(() => {
            if (!this.storyPaused) {
                this.nextStory();
            }
        }, 5000);
        
        console.log(`✅ [FeedManager] Story ${index + 1} of ${this.currentStories.length} displayed at:`, Date.now());
    }
    
    /**
     * Toggle story pause on tap
     */
    toggleStoryPause() {
        console.log('🎯 [FeedManager] toggleStoryPause() called at:', Date.now());
        
        this.storyPaused = !this.storyPaused;
        
        console.log(`🎯 [FeedManager] Story ${this.storyPaused ? 'PAUSED' : 'RESUMED'}`);
        
        const currentProgress = document.getElementById(`storyProgress${this.currentStoryIndex}`);
        if (currentProgress) {
            if (this.storyPaused) {
                currentProgress.style.animationPlayState = 'paused';
            } else {
                currentProgress.style.animationPlayState = 'running';
            }
        }
        
        console.log('✅ [FeedManager] Pause toggle complete at:', Date.now());
    }
    
    /**
     * Go to next story
     */
    nextStory() {
        console.log('🎯 [FeedManager] nextStory() called at:', Date.now());
        console.log('🎯 [FeedManager] Current state:', {
            currentIndex: this.currentStoryIndex,
            totalStories: this.currentStories?.length,
            hasNext: this.currentStoryIndex < (this.currentStories?.length - 1)
        });
        
        if (this.currentStoryIndex < this.currentStories.length - 1) {
            this.showStory(this.currentStoryIndex + 1);
        } else {
            console.log('🎯 [FeedManager] Reached end of stories, closing viewer');
            this.closeStoryViewer();
        }
        
        console.log('✅ [FeedManager] nextStory() complete at:', Date.now());
    }
    
    /**
     * Go to previous story
     */
    previousStory() {
        console.log('🎯 [FeedManager] previousStory() called at:', Date.now());
        console.log('🎯 [FeedManager] Current index:', this.currentStoryIndex);
        
        if (this.currentStoryIndex > 0) {
            this.showStory(this.currentStoryIndex - 1);
        }
        
        console.log('✅ [FeedManager] previousStory() complete at:', Date.now());
    }
    
    /**
     * Close story viewer
     */
    closeStoryViewer() {
        console.log('🎯 [FeedManager] closeStoryViewer() called at:', Date.now());
        console.log('🎯 [FeedManager] Cleanup state:', {
            hadTimeout: !!this.storyTimeout,
            hadStories: !!this.currentStories,
            lastIndex: this.currentStoryIndex
        });
        
        const overlay = document.getElementById('storyViewerOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            console.log('✅ [FeedManager] Overlay hidden');
        } else {
            console.error('❌ [FeedManager] Overlay element not found');
        }
        
        if (this.storyTimeout) {
            clearTimeout(this.storyTimeout);
            this.storyTimeout = null;
            console.log('✅ [FeedManager] Timeout cleared');
        }
        
        this.currentStories = null;
        this.currentStoryIndex = 0;
        
        console.log('✅ [FeedManager] Story viewer closed at:', Date.now());
    }
    
    /**
     * View full business profile from story
     */
    viewFullBusinessProfile() {
        console.log('🎯 [FeedManager] viewFullBusinessProfile() called at:', Date.now());
        console.log('🎯 [FeedManager] Current story business:', {
            exists: !!window.currentStoryBusiness,
            businessData: window.currentStoryBusiness
        });
        
        if (!window.currentStoryBusiness) {
            console.error('❌ [FeedManager] No current story business found');
            return;
        }
        
        const business = window.currentStoryBusiness;
        console.log('🎯 [FeedManager] Opening profile for:', {
            businessId: business.id,
            businessName: business.name,
            businessType: business.type
        });
        
        // Close story viewer first
        console.log('🎯 [FeedManager] Closing story viewer...');
        this.closeStoryViewer();
        
        // Use window.CLASSIFIED.openBusinessProfile (same as clicking business card)
        if (window.CLASSIFIED && window.CLASSIFIED.openBusinessProfile) {
            console.log('🎯 [FeedManager] Calling window.CLASSIFIED.openBusinessProfile');
            
            try {
                window.CLASSIFIED.openBusinessProfile(business, business.type);
                console.log('✅ [FeedManager] Business profile opened successfully at:', Date.now());
            } catch (error) {
                console.error('❌ [FeedManager] Error opening business profile:', error);
            }
        } else {
            console.error('❌ [FeedManager] window.CLASSIFIED.openBusinessProfile not available');
        }
    }
    
/**
     * ==========================================
     * END DAILY STORIES IMPLEMENTATION
     * ==========================================
     */
    
    /**
     * Cleanup resources
     * Delegates to sub-managers for proper cleanup
     */
    cleanup() { // ⬅️ cleanup is a SEPARATE method at class level
        console.log('🧹 [FEED-MANAGER] Cleaning up resources');
        
        // Delegate to sub-managers
        if (this.userFeed && typeof this.userFeed.cleanup === 'function') {
            this.userFeed.cleanup();
        }
        if (this.businessFeed && typeof this.businessFeed.cleanup === 'function') {
            this.businessFeed.cleanup();
        }
        
        console.log('✅ [FEED-MANAGER] Cleanup complete');
    }
} // ⬅️ FeedManager class ends here

