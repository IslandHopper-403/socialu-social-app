// javascript/ui/navigation.js

            /**
     * Navigation Manager
     * Handles screen navigation, tab switching, and UI state management
     */
    export class NavigationManager {
        constructor(firebaseServices, appState) {
        this.state = appState;
        
        // References to other managers (set later)
        this.authManager = null;
        
        // Track navigation history
        this.navigationHistory = [];
        
        // SECURITY: Track overlay stack for proper back navigation
        this.overlayStack = [];
        this.businessOverlays = ['businessDashboard', 'businessAnalytics', 'promotionsManager', 
                                'businessMessages', 'businessInsights', 'businessProfileEditor'];
    }

// Ghost content loading frames - Delete if unwanted

// Replace the skeleton section in navigation.js with this clean version:

/**
 * Show skeleton loading content
 * @param {string} containerId - ID of container to show skeleton in
 * @param {string} type - Type of skeleton ('user', 'restaurant', 'default')
 */
showContentSkeleton(containerId, type = 'default') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Add overflow protection
    container.style.maxWidth = '100%';
    container.style.overflow = 'hidden';
    
    const skeletons = {
        user: `
            <div class="skeleton-user-card">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-name"></div>
                    <div class="skeleton-bio"></div>
                    <div class="skeleton-tags">
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                        <div class="skeleton-tag"></div>
                    </div>
                </div>
            </div>
        `,
        restaurant: `
            <div class="skeleton-business-card">
                <div class="skeleton-image"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-description"></div>
            </div>
        `,
        default: `
            <div class="skeleton-card">
                <div class="skeleton-header"></div>
                <div class="skeleton-body"></div>
                <div class="skeleton-footer"></div>
            </div>
        `
    };
    
    container.innerHTML = skeletons[type].repeat(3);
}
        // Delete inside here if unwanted
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.authManager = managers.auth;
    }
    
    /**
     * Initialize navigation system
     */
    async init() {
        console.log('🧭 Initializing navigation manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize navigation state
        this.initializeNavigation();
    }

            /**
             * Set up event listeners for navigation
             */
            setupEventListeners() {
                // Prevent multiple setups
                if (this._listenersSetup) return;
                this._listenersSetup = true;
                
                // Bottom navigation listeners
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        const screen = item.dataset.screen;
                        this.showScreen(screen);
                    });
                });
                
              // Back button listeners for overlays only  
            document.querySelectorAll('.overlay-screen .back-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const parentOverlay = btn.closest('.overlay-screen');
                    
                    // Only process if overlay is actually visible
                    if (parentOverlay && parentOverlay.classList.contains('show')) {
                        // Handle stack-based navigation
                        this.handleOverlayBack(parentOverlay.id);
                    }
                });
            });

        // Handle browser back button
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.screen) {
                this.showScreen(e.state.screen, false);
            }
        });
    }
    
    /**
     * Initialize navigation on app start
     */
    initializeNavigation() {
        // Set initial screen
        const initialScreen = this.state.get('currentScreen') || 'restaurant';
        this.showScreen(initialScreen, false);
        
        // Push initial state to history
        history.replaceState({ screen: initialScreen }, '', `#${initialScreen}`);
    }
    
    /**
     * Show specific screen
     */
    showScreen(screenType, updateHistory = true) {
        console.log(`📱 Navigating to ${screenType} screen`);
        
        // SOFT guest mode notification - don't block navigation
        if (this.state.get('isGuestMode') && screenType === 'social') {
            // Show a subtle notification instead of blocking
            this.showGuestNotification();
            // Continue with navigation - don't return!
    }
        
        // Update state
        this.state.set('currentScreen', screenType);
        
        // Update UI
        this.updateScreenUI(screenType);
        
        // Update navigation UI
        this.updateNavigationUI(screenType);
        
        // Update browser history
        if (updateHistory) {
            history.pushState({ screen: screenType }, '', `#${screenType}`);
        }
        
        // Track navigation
        this.navigationHistory.push(screenType);
        if (this.navigationHistory.length > 10) {
            this.navigationHistory.shift();
        }
    }
    
    /**
     * Update screen visibility
     */
    updateScreenUI(screenType) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(`${screenType}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
        
        // Reset social tab when leaving social screen
        if (screenType !== 'social') {
            this.resetSocialTab();
        }
    }
    
    /**
     * Update navigation UI
     */
    updateNavigationUI(screenType) {
        // Update bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-screen="${screenType}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }
    
    /**
     * Go back in navigation history
     */
    goBack() {
        if (this.navigationHistory.length > 1) {
            this.navigationHistory.pop(); // Remove current
            const previousScreen = this.navigationHistory.pop(); // Get previous
            this.showScreen(previousScreen);
        } else {
            // Default to restaurant screen
            this.showScreen('restaurant');
        }
    }

  /**
     * Go back in navigation history
     */
    goBack() {
        if (this.navigationHistory.length > 1) {
            this.navigationHistory.pop(); // Remove current
            const previousScreen = this.navigationHistory.pop(); // Get previous
            this.showScreen(previousScreen);
        } else {
            // Default to restaurant screen
            this.showScreen('restaurant');
        }
    }
    
    /**
     * Show subtle guest notification
     */
    showGuestNotification() {
        // Check if we've already shown it recently
        if (this.guestNotificationShown) return;
        this.guestNotificationShown = true;
        
        // Create subtle notification bar
        const notification = document.createElement('div');
        notification.className = 'guest-notification-bar';
        notification.innerHTML = `
            <div style="background: linear-gradient(135deg, #FFD700, #FF6B6B); 
                        padding: 12px; text-align: center; color: white; 
                        font-size: 14px; cursor: pointer; 
                        animation: slideDown 0.3s ease;">
                        🚀 Join CLASSIFIED to connect with travelers and discover hidden gems! Tap to sign up
                <span style="font-weight: bold;">Tap here →</span>
            </div>
        `;
        
        notification.onclick = () => {
            this.authManager.showRegister();
            notification.remove();
        };
        
        // Insert at top of social screen
        const socialScreen = document.getElementById('socialScreen');
        if (socialScreen) {
            socialScreen.insertBefore(notification, socialScreen.firstChild);
        }
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            notification.remove();
        }, 10000);
        
        // Reset flag after 5 minutes so we can show again if needed
        setTimeout(() => {
            this.guestNotificationShown = false;
        }, 300000);
    }
    
    
    /**
     * Show overlay screen with stack management
     */
    showOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.add('show');
            
            // SECURITY: Add to overlay stack for navigation
            if (!this.overlayStack.includes(overlayId)) {
                this.overlayStack.push(overlayId);
                console.log('📚 Overlay stack:', this.overlayStack);
            }
            
            // Update corresponding state
            this.updateOverlayState(overlayId, true);
        }
    }
    
   /**
     * Close overlay screen with stack management
     */
    closeOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.remove('show');
            
            // DYNAMIC Z-INDEX: Reset any dynamic z-index when closing
            if (overlayId === 'individualChat') {
                overlay.style.zIndex = '';
                console.log('🎯 Reset chat z-index on close');
            }
            
            // SECURITY: Remove from overlay stack
            const index = this.overlayStack.indexOf(overlayId);
            if (index > -1) {
                this.overlayStack.splice(index, 1);
                console.log('📚 Overlay stack after close:', this.overlayStack);
            }
            
            // Update corresponding state
            this.updateOverlayState(overlayId, false);
        }
    }

           /**
 * Handle back navigation with overlay stack memory
 */
handleOverlayBack(overlayId) {
    console.log('🔙 Back pressed on:', overlayId, '| Stack:', this.overlayStack);
    
    // Special cleanup for chat
    if (overlayId === 'individualChat' && window.classifiedApp?.managers?.messaging) {
        window.classifiedApp.managers.messaging.closeChat();
    }
    
    // Close current overlay (removes from stack)
    this.closeOverlay(overlayId);
    
    // Show previous overlay if one exists in stack
    if (this.overlayStack.length > 0) {
        const previousOverlay = this.overlayStack[this.overlayStack.length - 1];
        
        console.log('📊 Stack check:', {
            currentOverlay: overlayId,
            previousOverlay: previousOverlay,
            fullStack: [...this.overlayStack],
            shouldSkip: overlayId === 'businessProfile' && previousOverlay === 'individualChat'
        });
        
        // Don't auto-restore if we're closing businessProfile and going back to main feed
        if (overlayId === 'businessProfile' && previousOverlay === 'individualChat') {
            console.log('⚠️ Skipping chat restore when closing business profile');
            console.log('🏠 Returning to main feed instead');
            return;
        }
        
        const prevElement = document.getElementById(previousOverlay);
        
        if (prevElement && !prevElement.classList.contains('show')) {
            prevElement.classList.add('show');
            console.log('📱 Restored:', previousOverlay);
        } else {
            console.log('⚡ Previous overlay state:', {
                exists: !!prevElement,
                alreadyShowing: prevElement?.classList.contains('show')
            });
        }
    } else {
        console.log('📭 No overlays left in stack - returning to main view');
    }
}


    /**
     * Handle back navigation for business overlays
     * SECURITY: Always returns to dashboard from business overlays
     */
    handleBusinessOverlayBack() {
        // Get current overlay from stack
        const currentOverlay = this.overlayStack[this.overlayStack.length - 1];
        
        if (!currentOverlay) return;
        
        // If it's a business overlay, handle specially
        if (this.businessOverlays.includes(currentOverlay)) {
            // Close current overlay
            this.closeOverlay(currentOverlay);
            
            // If we have more overlays in stack
            if (this.overlayStack.length > 0) {
                const previousOverlay = this.overlayStack[this.overlayStack.length - 1];
                
                // If previous is business dashboard, show it
                if (previousOverlay === 'businessDashboard') {
                    const dashboard = document.getElementById('businessDashboard');
                    if (dashboard) dashboard.classList.add('show');
                }
            } else {
                // No more overlays, show business dashboard
                const dashboard = document.getElementById('businessDashboard');
                if (dashboard && this.state.get('isBusinessUser')) {
                    dashboard.classList.add('show');
                    this.overlayStack.push('businessDashboard');
                }
            }
        } else {
            // Regular overlay, just close it
            this.closeOverlay(currentOverlay);
        }
    }
    
    /**
     * Clear overlay stack (use when logging out or switching users)
     */
    clearOverlayStack() {
        console.log('🧹 Clearing overlay stack');
        
        // Close all overlays
        this.overlayStack.forEach(overlayId => {
            const overlay = document.getElementById(overlayId);
            if (overlay) overlay.classList.remove('show');
        });
        
        // Clear the stack
        this.overlayStack = [];
    }
    
    /**
     * Update overlay state
     */
    updateOverlayState(overlayId, isOpen) {
        const stateMap = {
            'profileEditor': 'isProfileEditorOpen',
            'businessProfileEditor': 'isBusinessProfileEditorOpen',
            'userProfileView': 'isUserProfileOpen',
            'myProfileView': 'isProfileOpen',
            'businessProfile': 'isProfileOpen',
            'individualChat': 'isChatOpen'
        };
        
        const stateKey = stateMap[overlayId];
        if (stateKey) {
            this.state.set(stateKey, isOpen);
        }
    }
    
    /**
     * Reset social tab to default
     */
    resetSocialTab() {
        const defaultTab = 'userFeed';
        this.state.set('currentSocialTab', defaultTab);
        
        // Update UI
        document.querySelectorAll('.social-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${defaultTab}"]`)?.classList.add('active');
        
        document.querySelectorAll('.social-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${defaultTab}Content`)?.classList.add('active');
    }
    
    /**
     * Show loading overlay
     */
    showLoading() {
        document.getElementById('loadingOverlay')?.classList.add('show');
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loadingOverlay')?.classList.remove('show');
    }
    
    /**
     * Show/hide guest banner
     */
    toggleGuestBanner(show) {
        const guestBanner = document.getElementById('guestBanner');
        if (guestBanner) {
            guestBanner.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Update main screens authentication state
     */
    updateAuthenticationState(isAuthenticated) {
        const mainScreens = document.querySelector('.main-screens');
        const bottomNav = document.querySelector('.bottom-nav');
        
        if (mainScreens) {
            if (isAuthenticated) {
                mainScreens.classList.add('authenticated');
            } else {
                mainScreens.classList.remove('authenticated');
            }
        }
        
        if (bottomNav) {
            bottomNav.style.display = isAuthenticated ? 'flex' : 'none';
        }
    }
    
    /**
     * Get current screen
     */
    getCurrentScreen() {
        return this.state.get('currentScreen');
    }
    
    /**
     * Get navigation history
     */
    getNavigationHistory() {
        return [...this.navigationHistory];
    }
    
    /**
     * Clear navigation history
     */
    clearNavigationHistory() {
        this.navigationHistory = [this.state.get('currentScreen') || 'restaurant'];
    }
    
    /**
     * Handle deep links
     */
    handleDeepLink() {
        const hash = window.location.hash.slice(1);
        const validScreens = ['restaurant', 'social', 'activity'];
        
        if (validScreens.includes(hash)) {
            this.showScreen(hash);
        }
    }
}
