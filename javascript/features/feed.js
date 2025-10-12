// javascript/features/feed.js


import { sanitizeText, escapeHtml, createSafeElement } from '../utils/security.js';
import { BusinessFeedManager } from './feed/businessFeed.js';

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
        console.log('📊 [FeedManager] Initializing...');
        
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.mockData = mockData;
        
        // Create business feed manager
        this.businessFeed = new BusinessFeedManager(firebaseServices, appState, mockData);
        console.log('✅ [FeedManager] BusinessFeedManager created');
        
        // References to other managers (set later)
        this.uiComponents = null;
        this.adminManager = null;
    }
    
   /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('📊 [FeedManager] Setting manager references...');
        
        this.uiComponents = managers.ui;
        this.adminManager = managers.admin;
        
        // Pass references to business feed manager
        this.businessFeed.setManagers(managers);
        console.log('✅ [FeedManager] Business feed references set');

        // Get mockData from global app instance if not available
        if (!this.mockData && window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
            console.log('✅ [FeedManager] MockData retrieved from global app instance');
        }    
    }
    
  /**
     * Initialize feed system
     */
    async init() {
        console.log('📊 [FeedManager] Initializing feed manager...');
        
        // Initialize business feed manager
        await this.businessFeed.init();
        console.log('✅ [FeedManager] Business feed initialized');
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('✅ [FeedManager] Feed manager initialization complete');
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
    }
    
    /**
     * Load all feeds
     */
    async loadAllFeeds() {
        if (this.state.get('isAuthenticated')) {
            await Promise.all([
                this.populateRestaurantFeed(),
                this.populateActivityFeed()
            ]);
        } else if (this.state.get('isGuestMode')) {
            this.showDemoData();
        }
    }
    
 /**
 * Handle user login - refresh feeds
 */
async onUserLogin(user) {
    console.log('📊 [FeedManager] User logged in, refreshing feeds...');
    
    // Delegate user feed to userFeed manager
    const userFeedManager = window.classifiedApp?.managers?.userFeed;
    if (userFeedManager) {
        console.log('✅ [FeedManager] UserFeedManager found, calling onUserLogin');
        await userFeedManager.onUserLogin(user);
    } else {
        console.error('❌ [FeedManager] UserFeedManager not found!');
    }
    
    // Delegate business feeds to businessFeed manager
    console.log('📊 [FeedManager] Delegating business feeds to BusinessFeedManager...');
    await this.businessFeed.onUserLogin(user);
    console.log('✅ [FeedManager] Business feeds refreshed');
}
    
    /**
     * Show demo data for guest mode
     */
    async showDemoData() {
        console.log('📊 [FeedManager] Loading demo data for guest mode...');
        
        // Delegate to business feed manager
        await this.businessFeed.showDemoData();
        
        console.log('✅ [FeedManager] Demo data loaded');
    }
    
    /**
     * Populate restaurant feed - DELEGATED to BusinessFeedManager
     */
    async populateRestaurantFeed() {
        console.log('📊 [FeedManager] Delegating restaurant feed to BusinessFeedManager...');
        await this.businessFeed.populateRestaurantFeed();
    }
    
    /**
     * Populate restaurant feed with data - DELEGATED to BusinessFeedManager
     */
    populateRestaurantFeedWithData(restaurants, storiesContainer = null, feedContainer = null) {
        console.log('📊 [FeedManager] Delegating restaurant feed data population to BusinessFeedManager...');
        this.businessFeed.populateRestaurantFeedWithData(restaurants, storiesContainer, feedContainer);
    }
    
    /**
     * Populate activity feed - DELEGATED to BusinessFeedManager
     */
    async populateActivityFeed() {
        console.log('📊 [FeedManager] Delegating activity feed to BusinessFeedManager...');
        await this.businessFeed.populateActivityFeed();
    }
    
   /**
     * Populate activity feed with data - DELEGATED to BusinessFeedManager
     */
    populateActivityFeedWithData(activities, storiesContainer = null, feedContainer = null) {
        console.log('📊 [FeedManager] Delegating activity feed data population to BusinessFeedManager...');
        this.businessFeed.populateActivityFeedWithData(activities, storiesContainer, feedContainer);
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
        console.log('📖 [populateStories] Called with:', {
            containerId: storiesContainerId,
            businessCount: businesses?.length || 0,
            businesses: businesses
        });
        
        const container = document.getElementById(storiesContainerId);
        if (!container) {
            console.error('❌ [populateStories] Container not found:', storiesContainerId);
            return;
        }
        if (!businesses || businesses.length === 0) {
            console.warn('⚠️ [populateStories] No businesses to display');
            return;
        }
        
        console.log('📖 [populateStories] Creating story items for businesses:', 
            businesses.map(b => ({ name: b.name, id: b.id, hasPhoto: !!b.photos?.[0] }))
        );
        
       // Create story items
        container.innerHTML = businesses.map((business, index) => {
            const image = business.image || business.photos?.[0] || business.logo || '';
            const name = sanitizeText(business.name || 'Unknown');
            const type = sanitizeText(business.type || business.cuisine || 'Business');
            
            console.log(`📖 [populateStories] Creating carousel item ${index}:`, {
                index,
                businessId: business.id,
                name: business.name,
                type: business.type || business.cuisine,
                imageSource: business.image ? 'business.image' : business.photos?.[0] ? 'business.photos[0]' : business.logo ? 'business.logo' : 'none',
                imageUrl: image,
                hasAboutUs: !!business.aboutUs,
                aboutUsPreview: business.aboutUs?.substring(0, 50),
                hasDescription: !!business.description,
                descriptionPreview: business.description?.substring(0, 50),
                rawBusinessData: business
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
        
        console.log(`📖 Populated ${businesses.length} stories in ${storiesContainerId}`);
    }
    
    /**
     * Open story viewer
     */
    openStoryViewer(feedType, startIndex) {
        console.log('📖 [openStoryViewer] Opening story viewer:', {
            feedType,
            startIndex,
            timestamp: new Date().toISOString()
        });
        
        const businesses = this.getCurrentBusinesses(feedType);
        console.log('📖 [openStoryViewer] Retrieved businesses:', {
            count: businesses?.length || 0,
            businesses: businesses?.map(b => ({ name: b.name, hasAboutUs: !!b.aboutUs, hasDescription: !!b.description }))
        });
        
        if (!businesses || businesses.length === 0) {
            console.error('❌ [openStoryViewer] No businesses found for feedType:', feedType);
            return;
        }
        
        this.currentStories = businesses;
        this.currentStoryIndex = startIndex;
        
        console.log('📖 [openStoryViewer] Set current stories:', {
            totalStories: this.currentStories.length,
            startingAt: this.currentStoryIndex
        });
        
        // Show overlay
        const overlay = document.getElementById('storyViewerOverlay');
        if (!overlay) {
            console.error('❌ [openStoryViewer] Story viewer overlay not found in DOM');
            return;
        }
        
        console.log('📖 [openStoryViewer] Showing overlay and initializing viewer');
        overlay.style.display = 'flex';
        
        // Create progress bars
        console.log('📖 [openStoryViewer] Creating progress bars for', businesses.length, 'stories');
        this.createStoryProgressBars(businesses.length);
        
        // Show first story
        console.log('📖 [openStoryViewer] About to display story at startIndex:', startIndex);
        this.showStory(startIndex);
        
        console.log('✅ [openStoryViewer] Story viewer opened successfully');
    }

    /**
 * Open story by business ID (for deep linking)
 */
openStoryByBusinessId(businessId) {
    console.log('📖 [openStoryByBusinessId] Opening story for business:', businessId);
    
    // Get all businesses from both feeds (via businessFeed cache)
    const restaurants = this.businessFeed.cachedRestaurants || this.mockData.getRestaurants();
    const activities = this.businessFeed.cachedActivities || this.mockData.getActivities();
    const allBusinesses = [...restaurants, ...activities];
    
    // Find the business
    const businessIndex = allBusinesses.findIndex(b => b.id === businessId);
    
    if (businessIndex === -1) {
        console.error('❌ Business not found:', businessId);
        return;
    }
    
    // Set current stories to all businesses
    this.currentStories = allBusinesses;
    this.currentStoryIndex = businessIndex;
    
    // Show overlay
    const overlay = document.getElementById('storyViewerOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        this.createStoryProgressBars(allBusinesses.length);
        this.showStory(businessIndex);
    }
}
    
    /**
     * Get current businesses based on feed type
     */
    getCurrentBusinesses(feedType) {
        console.log('📖 [FeedManager] Getting businesses for:', feedType);
        
        // Get from businessFeed cache
        let businesses = [];
        
        if (feedType === 'restaurantStories') {
            businesses = this.businessFeed.cachedRestaurants || this.mockData.getRestaurants();
            console.log('📖 [FeedManager] Retrieved restaurants:', {
                count: businesses.length,
                source: this.businessFeed.cachedRestaurants ? 'BusinessFeed cache' : 'mock data'
            });
        } else if (feedType === 'activityStories') {
            businesses = this.businessFeed.cachedActivities || this.mockData.getActivities();
            console.log('📖 [FeedManager] Retrieved activities:', {
                count: businesses.length,
                source: this.businessFeed.cachedActivities ? 'BusinessFeed cache' : 'mock data'
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
        console.log('📖 [createStoryProgressBars] Creating', count, 'progress bars');
        
        const container = document.getElementById('storyProgressBars');
        if (!container) {
            console.error('❌ [createStoryProgressBars] Progress bars container not found');
            return;
        }
        
        container.innerHTML = Array(count).fill(0).map((_, i) => `
            <div class="story-progress-bar">
                <div class="story-progress-fill" id="storyProgress${i}"></div>
            </div>
        `).join('');
        
        console.log('✅ [createStoryProgressBars] Created progress bars successfully');
    }
    
    /**
     * Show specific story
     */
    showStory(index) {
        console.log('📖 [showStory] Attempting to show story at index:', index, {
            hasCurrentStories: !!this.currentStories,
            totalStories: this.currentStories?.length,
            isValidIndex: index >= 0 && index < (this.currentStories?.length || 0)
        });
        
        if (!this.currentStories || index < 0 || index >= this.currentStories.length) {
            console.warn('⚠️ [showStory] Invalid index or no stories, closing viewer');
            this.closeStoryViewer();
            return;
        }
        
        const business = this.currentStories[index];
        this.currentStoryIndex = index;
        
        console.log('📖 [showStory] Displaying business story:', {
            index,
            businessName: business.name,
            businessId: business.id,
            hasPhoto: !!business.photos?.[0],
            photoUrl: business.photos?.[0],
            hasAboutUs: !!business.aboutUs,
            aboutUsLength: business.aboutUs?.length || 0,
            hasDescription: !!business.description,
            descriptionLength: business.description?.length || 0,
            hasStory: !!business.story,
            storyLength: business.story?.length || 0
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
                    // Animate current story
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
        
        const logoSrc = business.logo || business.photos?.[0] || '';
        const displayName = sanitizeText(business.name || 'Unknown');
        const displayType = sanitizeText(business.type || business.cuisine || 'Business');
        
        console.log('📖 [showStory] Setting header info:', {
            logoSrc,
            displayName,
            displayType,
            logoElement: !!logo,
            nameElement: !!name,
            typeElement: !!type
        });
        
        if (logo) logo.src = logoSrc;
        if (name) name.textContent = displayName;
        if (type) type.textContent = displayType;
        
        // Update story image
        const storyImage = document.getElementById('storyImage');
        const imageSrc = business.photos?.[0] || business.image || business.logo || '';
        
        console.log('📖 [showStory] Setting story image:', {
            imageSrc,
            imageSource: business.photos?.[0] ? 'photos[0]' : business.image ? 'image' : business.logo ? 'logo' : 'none',
            imageElement: !!storyImage
        });
        
        if (storyImage) {
            storyImage.src = imageSrc;
        } else {
            console.error('❌ [showStory] Story image element not found');
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
            
            console.log('📖 [showStory] Setting text overlay:', {
                source: business.aboutUs ? 'aboutUs' : business.description ? 'description' : business.story ? 'story' : 'fallback',
                originalLength: aboutUs.length,
                truncated: aboutUs.length > maxLength,
                displayLength: truncatedText.length,
                preview: truncatedText.substring(0, 100)
            });
            
            textOverlay.textContent = sanitizeText(truncatedText);
        } else {
            console.error('❌ [showStory] Text overlay element not found');
        }

        // Reset paused state for new story
        this.storyPaused = false;
        
        // Store current business for profile viewing
        window.currentStoryBusiness = business;
        
        console.log('📖 [showStory] ===== DATA CONSISTENCY CHECK =====');
        console.log('📖 [showStory] Carousel showed:', {
            name: business.name,
            type: business.type || business.cuisine
        });
        console.log('📖 [showStory] Story overlay displays:', {
            headerName: displayName,
            headerType: displayType,
            textContent: textOverlay?.textContent?.substring(0, 100)
        });
       console.log('📖 [showStory] Data source mapping:', {
            nameMatch: business.name === displayName,
            typeMatch: (business.type || business.cuisine) === displayType,
            imageSource: business.photos?.[0] ? 'photos[0]' : business.image ? 'image' : 'logo',
            textSource: business.aboutUs ? 'aboutUs' : business.description ? 'description' : business.story ? 'story' : 'fallback',
            hasAboutUs: !!business.aboutUs,
            aboutUsLength: business.aboutUs?.length || 0
        });
        console.log('📖 [showStory] ===================================');
        
        // Auto-advance after 5 seconds (unless paused)
        if (this.storyTimeout) clearTimeout(this.storyTimeout);
        this.storyTimeout = setTimeout(() => {
            if (!this.storyPaused) {
                this.nextStory();
            }
        }, 5000);
        
        console.log(`📖 Showing story ${index + 1} of ${this.currentStories.length}: ${business.name}`);
    }

  /**
     * Toggle story pause on tap
     */
    toggleStoryPause() {
        this.storyPaused = !this.storyPaused;
        
        console.log(`📖 [toggleStoryPause] Story ${this.storyPaused ? 'PAUSED' : 'RESUMED'}`);
        
        const currentProgress = document.getElementById(`storyProgress${this.currentStoryIndex}`);
        if (currentProgress) {
            if (this.storyPaused) {
                currentProgress.style.animationPlayState = 'paused';
            } else {
                currentProgress.style.animationPlayState = 'running';
            }
        }
    }
      
   /**
     * Go to next story
     */
    nextStory() {
        console.log('📖 [nextStory] Moving to next story:', {
            currentIndex: this.currentStoryIndex,
            totalStories: this.currentStories?.length,
            hasNext: this.currentStoryIndex < (this.currentStories?.length - 1)
        });
        
        if (this.currentStoryIndex < this.currentStories.length - 1) {
            this.showStory(this.currentStoryIndex + 1);
        } else {
            console.log('📖 [nextStory] Reached end of stories, closing viewer');
            this.closeStoryViewer();
        }
    }
    
    /**
     * Go to previous story
     */
    previousStory() {
        if (this.currentStoryIndex > 0) {
            this.showStory(this.currentStoryIndex - 1);
        }
    }
    
    /**
     * Close story viewer
     */
    closeStoryViewer() {
        console.log('📖 [closeStoryViewer] Closing story viewer:', {
            hadTimeout: !!this.storyTimeout,
            hadStories: !!this.currentStories,
            lastIndex: this.currentStoryIndex
        });
        
        const overlay = document.getElementById('storyViewerOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            console.log('✅ [closeStoryViewer] Overlay hidden');
        } else {
            console.error('❌ [closeStoryViewer] Overlay element not found');
        }
        
        if (this.storyTimeout) {
            clearTimeout(this.storyTimeout);
            this.storyTimeout = null;
            console.log('✅ [closeStoryViewer] Timeout cleared');
        }
        
        this.currentStories = null;
        this.currentStoryIndex = 0;
        
        console.log('📖 [closeStoryViewer] Story viewer closed successfully');
    }
    
  /**
     * View full business profile from story
     */
    viewFullBusinessProfile() {
        console.log('📖 [viewFullBusinessProfile] ===== VIEW PROFILE BUTTON CLICKED =====');
        console.log('📖 [viewFullBusinessProfile] Current story business:', {
            exists: !!window.currentStoryBusiness,
            businessData: window.currentStoryBusiness
        });
        
        if (!window.currentStoryBusiness) {
            console.error('❌ [viewFullBusinessProfile] No current story business found');
            return;
        }
        
        const business = window.currentStoryBusiness;
        console.log('📖 [viewFullBusinessProfile] Opening profile for:', {
            businessId: business.id,
            businessName: business.name,
            businessType: business.type,
            hasWindowCLASSIFIED: !!window.CLASSIFIED,
            hasOpenBusinessProfile: !!window.CLASSIFIED?.openBusinessProfile
        });
        
        // Close story viewer first
        console.log('📖 [viewFullBusinessProfile] Closing story viewer...');
        this.closeStoryViewer();
        
        // Use window.CLASSIFIED.openBusinessProfile (same as clicking business card)
        if (window.CLASSIFIED && window.CLASSIFIED.openBusinessProfile) {
            console.log('📖 [viewFullBusinessProfile] Calling window.CLASSIFIED.openBusinessProfile');
            
            try {
                window.CLASSIFIED.openBusinessProfile(business, business.type);
                console.log('✅ [viewFullBusinessProfile] Successfully opened business profile');
            } catch (error) {
                console.error('❌ [viewFullBusinessProfile] Error opening business profile:', error);
            }
        } else {
            console.error('❌ [viewFullBusinessProfile] window.CLASSIFIED.openBusinessProfile not available');
        }
        
        console.log('📖 [viewFullBusinessProfile] =======================================');
    }
    
    /**
     * ==========================================
     * END DAILY STORIES IMPLEMENTATION
     * ==========================================
     */
    
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
        
        // CRITICAL: Load user feed when switching to "people" tab
        if (tabType === 'people') {
            console.log('🔄 [switchSocialTab] People tab selected, triggering user feed population');
            const userFeedManager = window.classifiedApp?.managers?.userFeed;
            if (userFeedManager) {
                console.log('✅ [switchSocialTab] UserFeedManager found, calling populateUserFeed()');
                userFeedManager.populateUserFeed();
            } else {
                console.error('❌ [switchSocialTab] UserFeedManager not found!');
            }
        }
        
        // FIXED: Hide notifications when switching to messaging tab
        if (tabType === 'messaging') {
            const notificationManager = window.classifiedApp?.managers?.notifications;
            if (notificationManager) {
                // Force hide the badges (CSS should handle this, but ensure it)
                const notificationDot = document.getElementById('messageNotificationDot');
                const countBadge = document.getElementById('unreadCountBadge');
                if (notificationDot) notificationDot.style.display = 'none';
                if (countBadge) countBadge.style.display = 'none';
            }
        }
    }
}
