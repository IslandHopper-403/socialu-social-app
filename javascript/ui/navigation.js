// javascript/ui/navigation.js

/**
 * Navigation Manager
 * Handles screen navigation, tab switching, and UI state management
 * 
 * REFACTORED: Section 2.7 Complete
 * - Overlay stack management delegated to Router
 * - Deep link handling delegated to Router
 * - Hash navigation delegated to Router
 * - Focus: UI display, scroll locking, screen transitions only
 */
export class NavigationManager {
    constructor(firebaseServices, appState) {
        console.log('🧭 [NAVIGATION-CONSTRUCT-1] NavigationManager constructor called at:', Date.now());
        
        this.state = appState;
        
        // References to other managers (set later)
        this.authManager = null;
        this.router = null;
        
        console.log('🧭 [NAVIGATION-CONSTRUCT-2] Router reference placeholder set');
        
        // Track navigation history
        this.navigationHistory = [];
        console.log('🧭 [NAVIGATION-CONSTRUCT-3] Navigation history initialized');
        
        // ✅ REFACTORED: Overlay stack removed - now managed by Router
        // this.overlayStack = [];  ← DELETED
        console.log('🧭 [NAVIGATION-CONSTRUCT-4] Overlay stack management delegated to Router');
        
        // Business overlays list for special handling
        this.businessOverlays = ['businessDashboard', 'businessAnalytics', 'promotionsManager', 
                                'businessMessages', 'businessInsights', 'businessProfileEditor'];
        console.log('🧭 [NAVIGATION-CONSTRUCT-5] Business overlays list configured:', this.businessOverlays.length);
        
        // Form overlays that need gentler scroll lock (mobile keyboard compatibility)
        this.formOverlays = ['profileEditor', 'businessProfileEditor', 'registerScreen', 'loginScreen'];
        console.log('🧭 [NAVIGATION-CONSTRUCT-6] Form overlays list configured:', this.formOverlays.length);
        
        console.log('✅ [NAVIGATION-CONSTRUCT-7] NavigationManager constructor complete at:', Date.now());
    }

    /**
     * Show skeleton loading content
     * @param {string} containerId - ID of container to show skeleton in
     * @param {string} type - Type of skeleton ('user', 'restaurant', 'default')
     */
    showContentSkeleton(containerId, type = 'default') {
        console.log('🧭 [SKELETON-1] showContentSkeleton called:', { containerId, type });
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn('⚠️ [SKELETON-2] Container not found:', containerId);
            return;
        }
        
        console.log('🧭 [SKELETON-2] Container found, applying overflow protection');
        
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
        
        console.log('🧭 [SKELETON-3] Rendering skeleton type:', type);
        container.innerHTML = skeletons[type].repeat(3);
        console.log('✅ [SKELETON-4] Skeleton content rendered');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🧭 [SET-MANAGERS-1] setManagers called at:', Date.now());
        console.log('🧭 [SET-MANAGERS-1] Managers object received:', !!managers);
        console.log('🧭 [SET-MANAGERS-1] Router in managers?', !!managers.router);
        console.log('🧭 [SET-MANAGERS-1] Auth in managers?', !!managers.auth);
        
        this.authManager = managers.auth;
        this.router = managers.router;
        
        console.log('🧭 [SET-MANAGERS-2] AuthManager set:', !!this.authManager);
        console.log('🧭 [SET-MANAGERS-2] Router set:', !!this.router);
        console.log('✅ [SET-MANAGERS-3] Manager references configured at:', Date.now());
    }
    
    /**
     * Initialize navigation system
     */
    async init() {
        console.log('🧭 [NAVIGATION-INIT-1] init() called at:', Date.now());
        console.log('🧭 [NAVIGATION-INIT-1] Router available?', !!this.router);
        console.log('🧭 [NAVIGATION-INIT-1] AuthManager available?', !!this.authManager);
        
        // Set up event listeners
        console.log('🧭 [NAVIGATION-INIT-2] Setting up event listeners...');
        this.setupEventListeners();
        console.log('✅ [NAVIGATION-INIT-2] Event listeners configured');
        
        // CRITICAL: Check for deep link BEFORE initializing navigation
        const hash = window.location.hash.slice(1);
        const isDeepLink = hash.startsWith('business/') || hash.startsWith('story/');
        
        console.log('🧭 [NAVIGATION-INIT-3] Current URL hash:', hash);
        console.log('🧭 [NAVIGATION-INIT-3] Is deep link detected?', isDeepLink);
        console.log('🧭 [NAVIGATION-INIT-3] Hash starts with business/?', hash.startsWith('business/'));
        console.log('🧭 [NAVIGATION-INIT-3] Hash starts with story/?', hash.startsWith('story/'));
        
        if (isDeepLink) {
            console.log('🔗 [NAVIGATION-INIT-4] Deep link detected, delegating to Router');
            
            // Set initial screen to restaurant (but don't change hash yet)
            const initialScreen = 'restaurant';
            console.log('🧭 [NAVIGATION-INIT-4] Setting initial screen:', initialScreen);
            this.state.set('currentScreen', initialScreen);
            
            console.log('🧭 [NAVIGATION-INIT-5] Showing initial screen without history update');
            this.showScreen(initialScreen, false); // false = don't update history
            
            console.log('✅ [NAVIGATION-INIT-6] Initial screen set to:', initialScreen);
            console.log('🔗 [NAVIGATION-INIT-6] Router will handle deep link processing via router.init()');
            
            // ✅ REFACTORED: Router owns deep link logic, not navigation
            // Router will handle the deep link via its own init()
        } else {
            console.log('🧭 [NAVIGATION-INIT-7] No deep link, running normal initialization');
            // Normal initialization for non-deep-link loads
            this.initializeNavigation();
        }
        
        console.log('✅ [NAVIGATION-INIT-8] Navigation initialization complete at:', Date.now());
    }

    /**
     * Set up event listeners for navigation
     */
    setupEventListeners() {
        console.log('🧭 [LISTENERS-1] setupEventListeners called at:', Date.now());
        
        // Prevent multiple setups
        if (this._listenersSetup) {
            console.log('⚠️ [LISTENERS-2] Listeners already set up, skipping');
            return;
        }
        this._listenersSetup = true;
        console.log('🧭 [LISTENERS-2] First-time setup, proceeding');
        
        // Bottom navigation listeners
        const navItems = document.querySelectorAll('.nav-item');
        console.log('🧭 [LISTENERS-3] Found nav items:', navItems.length);
        
        navItems.forEach((item, index) => {
            const screen = item.dataset.screen;
            console.log(`🧭 [LISTENERS-3.${index}] Attaching listener to nav item:`, screen);
            
            item.addEventListener('click', (e) => {
                console.log(`🧭 [NAV-CLICK] Bottom nav clicked: ${screen} at:`, Date.now());
                this.showScreen(screen);
            });
        });
        console.log('✅ [LISTENERS-4] Bottom navigation listeners attached');
        
        // Back button listeners for overlays only
        const backButtons = document.querySelectorAll('.overlay-screen .back-btn');
        console.log('🧭 [LISTENERS-5] Found overlay back buttons:', backButtons.length);
        
        backButtons.forEach((btn, index) => {
            console.log(`🧭 [LISTENERS-5.${index}] Attaching back button listener`);
            
            btn.addEventListener('click', (e) => {
                console.log('🧭 [BACK-BTN-CLICK-1] Overlay back button clicked at:', Date.now());
                e.stopPropagation();
                
                const parentOverlay = btn.closest('.overlay-screen');
                console.log('🧭 [BACK-BTN-CLICK-2] Parent overlay:', parentOverlay?.id);
                
                // Only process if overlay is actually visible
                if (parentOverlay && parentOverlay.classList.contains('show')) {
                    console.log('🧭 [BACK-BTN-CLICK-3] Overlay is visible, handling back navigation');
                    console.log('🧭 [BACK-BTN-CLICK-3] Overlay ID:', parentOverlay.id);
                    
                    // Handle stack-based navigation
                    this.handleOverlayBack(parentOverlay.id);
                } else {
                    console.log('⚠️ [BACK-BTN-CLICK-3] Overlay not visible, ignoring click');
                }
            });
        });
        console.log('✅ [LISTENERS-6] Overlay back button listeners attached');

        // Handle browser back button
        console.log('🧭 [LISTENERS-7] Setting up popstate listener for browser back button');
        window.addEventListener('popstate', (e) => {
            console.log('🧭 [POPSTATE-1] Browser back/forward button pressed at:', Date.now());
            console.log('🧭 [POPSTATE-1] Popstate event state:', e.state);
            
            if (e.state && e.state.screen) {
                console.log('🧭 [POPSTATE-2] Navigating to screen from history:', e.state.screen);
                this.showScreen(e.state.screen, false);
            } else {
                console.log('⚠️ [POPSTATE-2] No screen state in popstate event');
            }
        });
        console.log('✅ [LISTENERS-8] Popstate listener attached');
        
        console.log('✅ [LISTENERS-9] All event listeners setup complete at:', Date.now());
    }
    
    /**
     * Initialize navigation on app start
     */
    initializeNavigation() {
        console.log('🧭 [INIT-NAV-1] initializeNavigation called at:', Date.now());
        console.log('🧭 [INIT-NAV-1] Running normal (non-deep-link) initialization');
        
        // Set initial screen
        const currentScreen = this.state.get('currentScreen');
        const initialScreen = currentScreen || 'restaurant';
        
        console.log('🧭 [INIT-NAV-2] Current screen from state:', currentScreen);
        console.log('🧭 [INIT-NAV-2] Initial screen determined:', initialScreen);
        
        console.log('🧭 [INIT-NAV-3] Showing initial screen without history update');
        this.showScreen(initialScreen, false);
        
        // Push initial state to history
        console.log('🧭 [INIT-NAV-4] Replacing history state with initial screen');
        history.replaceState({ screen: initialScreen }, '', `#${initialScreen}`);
        console.log('✅ [INIT-NAV-4] History state replaced:', `#${initialScreen}`);
        
        console.log('✅ [INIT-NAV-5] Normal initialization complete at:', Date.now());
        console.log('🔗 [INIT-NAV-5] NOTE: Router handles all deep link and hash change logic');
    }
    
    /**
     * Show specific screen
     */
    showScreen(screenType, updateHistory = true) {
        console.log('🧭 [SHOW-SCREEN-1] showScreen called at:', Date.now());
        console.log('🧭 [SHOW-SCREEN-1] Parameters:', { screenType, updateHistory });
        console.log('🧭 [SHOW-SCREEN-1] Current screen:', this.state.get('currentScreen'));
        console.log('🧭 [SHOW-SCREEN-1] Is guest mode?', this.state.get('isGuestMode'));
        console.log('🧭 [SHOW-SCREEN-1] Is authenticated?', this.state.get('isAuthenticated'));
        
        // SOFT guest mode notification - don't block navigation
        if (this.state.get('isGuestMode') && screenType === 'social') {
            console.log('🧭 [SHOW-SCREEN-2] Guest mode + social screen detected');
            console.log('🧭 [SHOW-SCREEN-2] Showing guest notification (non-blocking)');
            
            // Show a subtle notification instead of blocking
            this.showGuestNotification();
            console.log('✅ [SHOW-SCREEN-2] Guest notification shown, continuing with navigation');
            // Continue with navigation - don't return!
        }
        
        // Update state
        console.log('🧭 [SHOW-SCREEN-3] Updating currentScreen state to:', screenType);
        this.state.set('currentScreen', screenType);
        console.log('✅ [SHOW-SCREEN-3] State updated');
        
        // Update UI
        console.log('🧭 [SHOW-SCREEN-4] Updating screen UI');
        this.updateScreenUI(screenType);
        console.log('✅ [SHOW-SCREEN-4] Screen UI updated');
        
        // Update navigation UI
        console.log('🧭 [SHOW-SCREEN-5] Updating navigation UI');
        this.updateNavigationUI(screenType);
        console.log('✅ [SHOW-SCREEN-5] Navigation UI updated');
        
        // Update browser history
        if (updateHistory) {
            console.log('🧭 [SHOW-SCREEN-6] Updating browser history');
            history.pushState({ screen: screenType }, '', `#${screenType}`);
            console.log('✅ [SHOW-SCREEN-6] History pushed:', `#${screenType}`);
        } else {
            console.log('🧭 [SHOW-SCREEN-6] Skipping history update (updateHistory=false)');
        }
        
        // Track navigation
        console.log('🧭 [SHOW-SCREEN-7] Adding to navigation history');
        this.navigationHistory.push(screenType);
        console.log('🧭 [SHOW-SCREEN-7] Navigation history length:', this.navigationHistory.length);
        
        if (this.navigationHistory.length > 10) {
            console.log('🧭 [SHOW-SCREEN-7] History too long, removing oldest entry');
            this.navigationHistory.shift();
        }
        
        console.log('✅ [SHOW-SCREEN-8] showScreen complete at:', Date.now());
    }
    
    /**
     * Update screen visibility
     */
    updateScreenUI(screenType) {
        console.log('🧭 [UPDATE-SCREEN-1] updateScreenUI called for:', screenType);
        
        // Hide all screens
        const allScreens = document.querySelectorAll('.screen');
        console.log('🧭 [UPDATE-SCREEN-2] Found screens:', allScreens.length);
        
        allScreens.forEach((screen, index) => {
            const wasActive = screen.classList.contains('active');
            screen.classList.remove('active');
            
            if (wasActive) {
                console.log(`🧭 [UPDATE-SCREEN-2.${index}] Deactivated screen:`, screen.id);
            }
        });
        console.log('✅ [UPDATE-SCREEN-3] All screens hidden');
        
        // Show target screen
        const targetScreen = document.getElementById(`${screenType}Screen`);
        console.log('🧭 [UPDATE-SCREEN-4] Target screen ID:', `${screenType}Screen`);
        console.log('🧭 [UPDATE-SCREEN-4] Target screen found?', !!targetScreen);
        
        if (targetScreen) {
            targetScreen.classList.add('active');
            console.log('✅ [UPDATE-SCREEN-5] Target screen activated:', targetScreen.id);
        } else {
            console.error('❌ [UPDATE-SCREEN-5] Target screen not found in DOM:', `${screenType}Screen`);
        }
        
        // Reset social tab when leaving social screen
        if (screenType !== 'social') {
            console.log('🧭 [UPDATE-SCREEN-6] Not social screen, resetting social tab');
            this.resetSocialTab();
        } else {
            console.log('🧭 [UPDATE-SCREEN-6] Social screen active, keeping tab state');
        }
        
        console.log('✅ [UPDATE-SCREEN-7] updateScreenUI complete');
    }
    
    /**
     * Update navigation UI
     */
    updateNavigationUI(screenType) {
        console.log('🧭 [UPDATE-NAV-1] updateNavigationUI called for:', screenType);
        
        // Update bottom navigation
        const allNavItems = document.querySelectorAll('.nav-item');
        console.log('🧭 [UPDATE-NAV-2] Found nav items:', allNavItems.length);
        
        allNavItems.forEach((item, index) => {
            const wasActive = item.classList.contains('active');
            item.classList.remove('active');
            
            if (wasActive) {
                console.log(`🧭 [UPDATE-NAV-2.${index}] Deactivated nav item:`, item.dataset.screen);
            }
        });
        console.log('✅ [UPDATE-NAV-3] All nav items deactivated');
        
        const activeNavItem = document.querySelector(`[data-screen="${screenType}"]`);
        console.log('🧭 [UPDATE-NAV-4] Looking for nav item:', `[data-screen="${screenType}"]`);
        console.log('🧭 [UPDATE-NAV-4] Found matching nav item?', !!activeNavItem);
        
        if (activeNavItem) {
            activeNavItem.classList.add('active');
            console.log('✅ [UPDATE-NAV-5] Nav item activated:', screenType);
        } else {
            console.warn('⚠️ [UPDATE-NAV-5] No matching nav item found for:', screenType);
        }
        
        console.log('✅ [UPDATE-NAV-6] updateNavigationUI complete');
    }
    
    /**
     * Go back in navigation history
     */
    goBack() {
        console.log('🧭 [GO-BACK-1] goBack called at:', Date.now());
        console.log('🧭 [GO-BACK-1] Navigation history length:', this.navigationHistory.length);
        console.log('🧭 [GO-BACK-1] Navigation history:', [...this.navigationHistory]);
        
        if (this.navigationHistory.length > 1) {
            console.log('🧭 [GO-BACK-2] History has multiple entries, navigating back');
            
            const current = this.navigationHistory.pop(); // Remove current
            console.log('🧭 [GO-BACK-2] Removed current screen:', current);
            
            const previousScreen = this.navigationHistory.pop(); // Get previous
            console.log('🧭 [GO-BACK-3] Previous screen:', previousScreen);
            
            console.log('🧭 [GO-BACK-3] Showing previous screen');
            this.showScreen(previousScreen);
            console.log('✅ [GO-BACK-3] Navigated to previous screen');
        } else {
            console.log('🧭 [GO-BACK-2] No history or single entry, defaulting to restaurant');
            // Default to restaurant screen
            this.showScreen('restaurant');
            console.log('✅ [GO-BACK-2] Navigated to default restaurant screen');
        }
        
        console.log('✅ [GO-BACK-4] goBack complete at:', Date.now());
    }

    /**
     * Show subtle guest notification
     */
    showGuestNotification() {
        console.log('🧭 [GUEST-NOTIF-1] showGuestNotification called at:', Date.now());
        
        // Check if we've already shown it recently
        if (this.guestNotificationShown) {
            console.log('⚠️ [GUEST-NOTIF-2] Notification already shown recently, skipping');
            return;
        }
        
        console.log('🧭 [GUEST-NOTIF-2] First time showing notification');
        this.guestNotificationShown = true;
        
        // Create subtle notification bar
        console.log('🧭 [GUEST-NOTIF-3] Creating notification element');
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
        
        console.log('🧭 [GUEST-NOTIF-4] Setting up notification click handler');
        notification.onclick = () => {
            console.log('🧭 [GUEST-NOTIF-CLICK] Guest notification clicked, showing register');
            
            if (this.authManager) {
                this.authManager.showRegister();
                console.log('✅ [GUEST-NOTIF-CLICK] Register screen shown');
            } else {
                console.error('❌ [GUEST-NOTIF-CLICK] AuthManager not available');
            }
            
            notification.remove();
            console.log('✅ [GUEST-NOTIF-CLICK] Notification removed');
        };
        
        // Insert at top of social screen
        const socialScreen = document.getElementById('socialScreen');
        console.log('🧭 [GUEST-NOTIF-5] Social screen found?', !!socialScreen);
        
        if (socialScreen) {
            socialScreen.insertBefore(notification, socialScreen.firstChild);
            console.log('✅ [GUEST-NOTIF-6] Notification inserted into social screen');
        } else {
            console.error('❌ [GUEST-NOTIF-6] Social screen not found in DOM');
        }
        
        // Auto-remove after 10 seconds
        console.log('🧭 [GUEST-NOTIF-7] Setting 10-second auto-remove timer');
        setTimeout(() => {
            console.log('🧭 [GUEST-NOTIF-TIMEOUT] 10 seconds elapsed, removing notification');
            notification.remove();
        }, 10000);
        
        // Reset flag after 5 minutes so we can show again if needed
        console.log('🧭 [GUEST-NOTIF-8] Setting 5-minute reset timer for flag');
        setTimeout(() => {
            console.log('🧭 [GUEST-NOTIF-RESET] 5 minutes elapsed, resetting notification flag');
            this.guestNotificationShown = false;
        }, 300000);
        
        console.log('✅ [GUEST-NOTIF-9] Guest notification setup complete');
    }
    
    /**
     * Show overlay screen
     * ✅ REFACTORED: Delegates overlay stack to Router
     */
    showOverlay(overlayId) {
        console.log('🧭 [SHOW-OVERLAY-1] showOverlay called at:', Date.now());
        console.log('🧭 [SHOW-OVERLAY-1] Overlay ID:', overlayId);
        console.log('🧭 [SHOW-OVERLAY-1] Router available?', !!this.router);
        
        const overlay = document.getElementById(overlayId);
        console.log('🧭 [SHOW-OVERLAY-2] Overlay element found?', !!overlay);
        
        if (overlay) {
            console.log('🧭 [SHOW-OVERLAY-3] Adding "show" class to overlay');
            overlay.classList.add('show');
            overlay.style.pointerEvents = '';
            console.log('✅ [SHOW-OVERLAY-3] Overlay display updated');
            
            // ✅ REFACTORED: Delegate to Router for overlay stack management
            if (this.router) {
                console.log('🧭 [SHOW-OVERLAY-4] Router available, delegating stack push');
                console.log('🧭 [SHOW-OVERLAY-4] Calling router.pushOverlay():', overlayId);
                
                this.router.pushOverlay(overlayId);
                
                const currentStack = this.router.getOverlayStack();
                console.log('✅ [SHOW-OVERLAY-4] Router overlay stack after push:', currentStack);
                console.log('✅ [SHOW-OVERLAY-4] Stack length:', currentStack.length);
            } else {
                console.error('❌ [SHOW-OVERLAY-4] Router not available! Overlay stack not updated');
                console.error('❌ [SHOW-OVERLAY-4] This should never happen - router should be initialized first');
            }
            
            // Lock body scroll when first overlay opens (EVENT-BASED, NO POSITION FIXED)
            const stackLength = this.router ? this.router.getOverlayStack().length : 0;
            console.log('🧭 [SHOW-OVERLAY-5] Current overlay stack length:', stackLength);
            
            if (stackLength === 1) {
                console.log('🧭 [SHOW-OVERLAY-5] First overlay opened, applying scroll lock');
                
                // Save scroll position for ALL overlays
                this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
                console.log('🧭 [SHOW-OVERLAY-6] Saved scroll position:', this.scrollPosition);
                
                // Apply CSS-only lock (no position tricks)
                console.log('🧭 [SHOW-OVERLAY-7] Applying CSS scroll lock');
                document.body.classList.add('overlay-open');
                document.body.style.overflow = 'hidden';
                console.log('✅ [SHOW-OVERLAY-7] CSS lock applied');
                
                // Prevent touch scrolling on body with event listener
                console.log('🧭 [SHOW-OVERLAY-8] Setting up touch/wheel scroll prevention');
                this.preventScroll = (e) => {
                    // Allow scrolling within overlay content, block body scroll
                    if (!e.target.closest('.overlay-screen')) {
                        e.preventDefault();
                    }
                };
                
                document.body.addEventListener('touchmove', this.preventScroll, { passive: false });
                document.body.addEventListener('wheel', this.preventScroll, { passive: false });
                console.log('✅ [SHOW-OVERLAY-8] Event-based scroll prevention active');
                
                console.log('🔒 [SHOW-OVERLAY-9] Applied event-based scroll lock');
            } else {
                console.log('🧭 [SHOW-OVERLAY-5] Additional overlay (not first), scroll lock already active');
            }
            
            // Update corresponding state
            console.log('🧭 [SHOW-OVERLAY-10] Updating overlay state');
            this.updateOverlayState(overlayId, true);
            console.log('✅ [SHOW-OVERLAY-10] Overlay state updated');
        } else {
            console.error('❌ [SHOW-OVERLAY-2] Overlay element not found in DOM:', overlayId);
        }
        
        console.log('✅ [SHOW-OVERLAY-11] showOverlay complete at:', Date.now());
    }
    
    /**
     * Close overlay screen with stack management
     * ✅ REFACTORED: Delegates overlay stack to Router
     */
    closeOverlay(overlayId) {
        console.log('🧭 [CLOSE-OVERLAY-1] closeOverlay called at:', Date.now());
        console.log('🧭 [CLOSE-OVERLAY-1] Overlay ID:', overlayId);
        console.log('🧭 [CLOSE-OVERLAY-1] Router available?', !!this.router);
        
        const overlay = document.getElementById(overlayId);
        console.log('🧭 [CLOSE-OVERLAY-2] Overlay element found?', !!overlay);
        
        if (overlay) {
            // CRITICAL: Clean up chat state BEFORE hiding overlay
            if (overlayId === 'individualChat') {
                console.log('🧭 [CLOSE-OVERLAY-3] Chat overlay closing, cleaning up messaging state');
                
                if (window.classifiedApp?.managers?.messaging) {
                    console.log('🧭 [CLOSE-OVERLAY-3] Calling messaging.closeChat()');
                    window.classifiedApp.managers.messaging.closeChat();
                    console.log('✅ [CLOSE-OVERLAY-3] Chat state cleaned up');
                } else {
                    console.warn('⚠️ [CLOSE-OVERLAY-3] Messaging manager not available for cleanup');
                }
            }
            
            console.log('🧭 [CLOSE-OVERLAY-4] Removing "show" class from overlay');
            overlay.classList.remove('show');
            overlay.style.pointerEvents = 'none';
            console.log('✅ [CLOSE-OVERLAY-4] Overlay hidden');
            
            // DYNAMIC Z-INDEX: Reset any dynamic z-index when closing
            if (overlayId === 'individualChat') {
                console.log('🧭 [CLOSE-OVERLAY-5] Resetting chat z-index');
                overlay.style.zIndex = '';
                console.log('✅ [CLOSE-OVERLAY-5] Chat z-index reset');
            }
            
            // ✅ REFACTORED: Delegate to Router for overlay stack management
            if (this.router) {
                console.log('🧭 [CLOSE-OVERLAY-6] Router available, delegating stack removal');
                console.log('🧭 [CLOSE-OVERLAY-6] Calling router.removeOverlay():', overlayId);
                
                this.router.removeOverlay(overlayId);
                
                const currentStack = this.router.getOverlayStack();
                console.log('✅ [CLOSE-OVERLAY-6] Router overlay stack after removal:', currentStack);
                console.log('✅ [CLOSE-OVERLAY-6] Stack length:', currentStack.length);
            } else {
                console.error('❌ [CLOSE-OVERLAY-6] Router not available! Stack not updated');
            }
            
            // Unlock body scroll when no overlays remain
            const stackLength = this.router ? this.router.getOverlayStack().length : 0;
            console.log('🧭 [CLOSE-OVERLAY-7] Current overlay stack length:', stackLength);
            
            if (stackLength === 0) {
                console.log('🧭 [CLOSE-OVERLAY-7] No overlays remaining, releasing scroll lock');
                
                // Remove CSS lock
                console.log('🧭 [CLOSE-OVERLAY-8] Removing CSS scroll lock');
                document.body.classList.remove('overlay-open');
                document.body.style.overflow = '';
                console.log('✅ [CLOSE-OVERLAY-8] CSS lock removed');
                
                // Remove event listeners
                if (this.preventScroll) {
                    console.log('🧭 [CLOSE-OVERLAY-9] Removing scroll prevention event listeners');
                    document.body.removeEventListener('touchmove', this.preventScroll);
                    document.body.removeEventListener('wheel', this.preventScroll);
                    this.preventScroll = null;
                    console.log('✅ [CLOSE-OVERLAY-9] Event listeners removed');
                } else {
                    console.log('🧭 [CLOSE-OVERLAY-9] No scroll prevention listeners to remove');
                }
                
                // Restore scroll position (no delay, no position tricks)
                if (this.scrollPosition !== undefined) {
                    console.log('🧭 [CLOSE-OVERLAY-10] Restoring scroll position:', this.scrollPosition);
                    window.scrollTo(0, this.scrollPosition);
                    this.scrollPosition = undefined;
                    console.log('✅ [CLOSE-OVERLAY-10] Scroll position restored');
                } else {
                    console.log('🧭 [CLOSE-OVERLAY-10] No saved scroll position to restore');
                }
                
                console.log('🔓 [CLOSE-OVERLAY-11] Released scroll lock');
            } else {
                console.log('🧭 [CLOSE-OVERLAY-7] Other overlays still open, keeping scroll lock active');
            }
            
            // Update corresponding state
            console.log('🧭 [CLOSE-OVERLAY-12] Updating overlay state');
            this.updateOverlayState(overlayId, false);
            console.log('✅ [CLOSE-OVERLAY-12] Overlay state updated');
        } else {
            console.error('❌ [CLOSE-OVERLAY-2] Overlay element not found in DOM:', overlayId);
        }
        
        console.log('✅ [CLOSE-OVERLAY-13] closeOverlay complete at:', Date.now());
    }
                
    /**
     * Handle back navigation with overlay stack memory
     * ✅ REFACTORED: Uses Router for overlay stack state
     */
    handleOverlayBack(overlayId) {
        console.log('🧭 [OVERLAY-BACK-1] handleOverlayBack called at:', Date.now());
        console.log('🧭 [OVERLAY-BACK-1] Overlay ID:', overlayId);
        console.log('🧭 [OVERLAY-BACK-1] Router available?', !!this.router);
        
        // Get current stack state from Router
        const currentStack = this.router ? this.router.getOverlayStack() : [];
        console.log('🧭 [OVERLAY-BACK-2] Current overlay stack from Router:', currentStack);
        console.log('🧭 [OVERLAY-BACK-2] Stack length:', currentStack.length);
        
        console.log('🔙 [OVERLAY-BACK-3] Back pressed on:', overlayId);
        
        // Special cleanup for chat
        if (overlayId === 'individualChat') {
            console.log('🧭 [OVERLAY-BACK-4] Chat overlay closing, triggering cleanup');
            
            if (window.classifiedApp?.managers?.messaging) {
                console.log('🧭 [OVERLAY-BACK-4] Calling messaging.closeChat()');
                window.classifiedApp.managers.messaging.closeChat();
                console.log('✅ [OVERLAY-BACK-4] Chat cleanup complete');
            } else {
                console.warn('⚠️ [OVERLAY-BACK-4] Messaging manager not available');
            }
        }
        
        // Close current overlay (removes from Router's stack)
        console.log('🧭 [OVERLAY-BACK-5] Closing current overlay');
        this.closeOverlay(overlayId);
        console.log('✅ [OVERLAY-BACK-5] Current overlay closed');
        
        // Show previous overlay if one exists in stack
        const updatedStack = this.router ? this.router.getOverlayStack() : [];
        console.log('🧭 [OVERLAY-BACK-6] Updated stack after close:', updatedStack);
        console.log('🧭 [OVERLAY-BACK-6] Updated stack length:', updatedStack.length);
        
        if (updatedStack.length > 0) {
            const previousOverlay = updatedStack[updatedStack.length - 1];
            
            console.log('📊 [OVERLAY-BACK-7] Stack check:', {
                currentOverlay: overlayId,
                previousOverlay: previousOverlay,
                fullStack: [...updatedStack],
                shouldSkip: overlayId === 'businessProfile' && previousOverlay === 'individualChat'
            });
            
            // Don't auto-restore if we're closing businessProfile and going back to main feed
            if (overlayId === 'businessProfile' && previousOverlay === 'individualChat') {
                console.log('⚠️ [OVERLAY-BACK-8] Skipping chat restore when closing business profile');
                console.log('🏠 [OVERLAY-BACK-8] Returning to main feed instead');
                return;
            }
            
            const prevElement = document.getElementById(previousOverlay);
            console.log('🧭 [OVERLAY-BACK-9] Previous overlay element:', previousOverlay);
            console.log('🧭 [OVERLAY-BACK-9] Previous element found?', !!prevElement);
            console.log('🧭 [OVERLAY-BACK-9] Previous element already showing?', prevElement?.classList.contains('show'));
            
            if (prevElement && !prevElement.classList.contains('show')) {
                console.log('🧭 [OVERLAY-BACK-10] Restoring previous overlay');
                prevElement.classList.add('show');
                console.log('✅ [OVERLAY-BACK-10] Restored:', previousOverlay);
            } else {
                console.log('⚡ [OVERLAY-BACK-10] Previous overlay state:', {
                    exists: !!prevElement,
                    alreadyShowing: prevElement?.classList.contains('show')
                });
            }
        } else {
            console.log('📭 [OVERLAY-BACK-8] No overlays left in stack - returning to main view');
        }
        
        console.log('✅ [OVERLAY-BACK-11] handleOverlayBack complete at:', Date.now());
    }

    /**
     * Handle back navigation for business overlays
     * SECURITY: Always returns to dashboard from business overlays
     * ✅ REFACTORED: Uses Router for overlay stack state
     */
    handleBusinessOverlayBack() {
        console.log('🧭 [BIZ-BACK-1] handleBusinessOverlayBack called at:', Date.now());
        console.log('🧭 [BIZ-BACK-1] Router available?', !!this.router);
        
        // Get current overlay from Router's stack
        const currentOverlay = this.router ? this.router.getCurrentOverlay() : null;
        console.log('🧭 [BIZ-BACK-2] Current overlay from Router:', currentOverlay);
        
        if (!currentOverlay) {
            console.log('⚠️ [BIZ-BACK-3] No current overlay in stack, nothing to do');
            return;
        }
        
        // If it's a business overlay, handle specially
        const isBusinessOverlay = this.businessOverlays.includes(currentOverlay);
        console.log('🧭 [BIZ-BACK-4] Is business overlay?', isBusinessOverlay);
        console.log('🧭 [BIZ-BACK-4] Business overlays list:', this.businessOverlays);
        
        if (isBusinessOverlay) {
            console.log('🧭 [BIZ-BACK-5] Business overlay detected, special handling');
            
            // Close current overlay
            console.log('🧭 [BIZ-BACK-6] Closing current business overlay');
            this.closeOverlay(currentOverlay);
            console.log('✅ [BIZ-BACK-6] Business overlay closed');
            
            // Check stack after close
            const updatedStack = this.router ? this.router.getOverlayStack() : [];
            console.log('🧭 [BIZ-BACK-7] Stack after close:', updatedStack);
            console.log('🧭 [BIZ-BACK-7] Stack length:', updatedStack.length);
            
            // If we have more overlays in stack
            if (updatedStack.length > 0) {
                const previousOverlay = updatedStack[updatedStack.length - 1];
                console.log('🧭 [BIZ-BACK-8] Previous overlay in stack:', previousOverlay);
                
                // If previous is business dashboard, show it
                if (previousOverlay === 'businessDashboard') {
                    console.log('🧭 [BIZ-BACK-9] Previous is dashboard, restoring it');
                    
                    const dashboard = document.getElementById('businessDashboard');
                    console.log('🧭 [BIZ-BACK-9] Dashboard element found?', !!dashboard);
                    
                    if (dashboard) {
                        dashboard.classList.add('show');
                        console.log('✅ [BIZ-BACK-9] Dashboard restored');
                    } else {
                        console.error('❌ [BIZ-BACK-9] Dashboard element not found in DOM');
                    }
                } else {
                    console.log('🧭 [BIZ-BACK-9] Previous overlay is not dashboard:', previousOverlay);
                }
            } else {
                console.log('🧭 [BIZ-BACK-8] No more overlays, showing dashboard directly');
                
                // No more overlays, show business dashboard
                const dashboard = document.getElementById('businessDashboard');
                const isBusinessUser = this.state.get('isBusinessUser');
                
                console.log('🧭 [BIZ-BACK-10] Dashboard element found?', !!dashboard);
                console.log('🧭 [BIZ-BACK-10] Is business user?', isBusinessUser);
                
                if (dashboard && isBusinessUser) {
                    console.log('🧭 [BIZ-BACK-11] Showing dashboard and adding to Router stack');
                    dashboard.classList.add('show');
                    
                    if (this.router) {
                        this.router.pushOverlay('businessDashboard');
                        console.log('✅ [BIZ-BACK-11] Dashboard shown and added to stack');
                    } else {
                        console.error('❌ [BIZ-BACK-11] Router not available to update stack');
                    }
                } else {
                    console.log('⚠️ [BIZ-BACK-11] Cannot show dashboard:', {
                        dashboardExists: !!dashboard,
                        isBusinessUser: isBusinessUser
                    });
                }
            }
        } else {
            console.log('🧭 [BIZ-BACK-5] Not a business overlay, using regular close');
            // Regular overlay, just close it
            this.closeOverlay(currentOverlay);
            console.log('✅ [BIZ-BACK-5] Regular overlay closed');
        }
        
        console.log('✅ [BIZ-BACK-12] handleBusinessOverlayBack complete at:', Date.now());
    }
    
    /**
     * Clear overlay stack (use when logging out or switching users)
     * ✅ REFACTORED: Delegates to Router for stack management
     */
    clearOverlayStack() {
        console.log('🧭 [CLEAR-STACK-1] clearOverlayStack called at:', Date.now());
        console.log('🧭 [CLEAR-STACK-1] Router available?', !!this.router);
        
        // Get current stack from Router
        const currentStack = this.router ? this.router.getOverlayStack() : [];
        console.log('🧭 [CLEAR-STACK-2] Current overlay stack:', currentStack);
        console.log('🧭 [CLEAR-STACK-2] Stack length:', currentStack.length);
        
        console.log('🧹 [CLEAR-STACK-3] Clearing overlay stack');
        
        // Close all overlays
        console.log('🧭 [CLEAR-STACK-4] Closing all overlays in stack');
        currentStack.forEach((overlayId, index) => {
            console.log(`🧭 [CLEAR-STACK-4.${index}] Closing overlay:`, overlayId);
            
            const overlay = document.getElementById(overlayId);
            if (overlay) {
                overlay.classList.remove('show');
                console.log(`✅ [CLEAR-STACK-4.${index}] Overlay closed`);
            } else {
                console.warn(`⚠️ [CLEAR-STACK-4.${index}] Overlay not found:`, overlayId);
            }
        });
        console.log('✅ [CLEAR-STACK-5] All overlays closed');
        
        // Clear the Router's stack
        if (this.router) {
            console.log('🧭 [CLEAR-STACK-6] Delegating stack clear to Router');
            this.router.clearOverlayStack();
            console.log('✅ [CLEAR-STACK-6] Router stack cleared');
        } else {
            console.error('❌ [CLEAR-STACK-6] Router not available, cannot clear stack state');
        }
        
        // Unlock body scroll
        console.log('🧭 [CLEAR-STACK-7] Unlocking body scroll');
        document.body.classList.remove('overlay-open');
        document.body.style.overflow = '';
        console.log('✅ [CLEAR-STACK-7] Scroll unlocked');
        
        // Remove event listeners
        if (this.preventScroll) {
            console.log('🧭 [CLEAR-STACK-8] Removing scroll prevention listeners');
            document.body.removeEventListener('touchmove', this.preventScroll);
            document.body.removeEventListener('wheel', this.preventScroll);
            this.preventScroll = null;
            console.log('✅ [CLEAR-STACK-8] Listeners removed');
        } else {
            console.log('🧭 [CLEAR-STACK-8] No scroll prevention listeners to remove');
        }
        
        // Restore scroll position
        if (this.scrollPosition !== undefined) {
            console.log('🧭 [CLEAR-STACK-9] Restoring scroll position:', this.scrollPosition);
            window.scrollTo(0, this.scrollPosition);
            this.scrollPosition = undefined;
            console.log('✅ [CLEAR-STACK-9] Scroll position restored');
        } else {
            console.log('🧭 [CLEAR-STACK-9] No scroll position to restore');
        }
        
        console.log('✅ [CLEAR-STACK-10] clearOverlayStack complete at:', Date.now());
    }
    
    /**
     * Update overlay state
     */
    updateOverlayState(overlayId, isOpen) {
        console.log('🧭 [UPDATE-STATE-1] updateOverlayState called:', { overlayId, isOpen });
        
        const stateMap = {
            'profileEditor': 'isProfileEditorOpen',
            'businessProfileEditor': 'isBusinessProfileEditorOpen',
            'userProfileView': 'isUserProfileOpen',
            'myProfileView': 'isProfileOpen',
            'businessProfile': 'isProfileOpen',
            'individualChat': 'isChatOpen'
        };
        
        const stateKey = stateMap[overlayId];
        console.log('🧭 [UPDATE-STATE-2] State key mapping:', stateKey || 'none');
        
        if (stateKey) {
            console.log('🧭 [UPDATE-STATE-3] Updating state:', `${stateKey} = ${isOpen}`);
            this.state.set(stateKey, isOpen);
            console.log('✅ [UPDATE-STATE-3] State updated');
        } else {
            console.log('🧭 [UPDATE-STATE-3] No state mapping for overlay:', overlayId);
        }
        
        console.log('✅ [UPDATE-STATE-4] updateOverlayState complete');
    }
    
    /**
     * Reset social tab to default
     */
    resetSocialTab() {
        console.log('🧭 [RESET-TAB-1] resetSocialTab called');
        
        const defaultTab = 'userFeed';
        console.log('🧭 [RESET-TAB-2] Setting default tab:', defaultTab);
        this.state.set('currentSocialTab', defaultTab);
        console.log('✅ [RESET-TAB-2] State updated');
        
        // Update UI
        console.log('🧭 [RESET-TAB-3] Updating social tab UI');
        const allTabs = document.querySelectorAll('.social-tab');
        console.log('🧭 [RESET-TAB-3] Found tabs:', allTabs.length);
        
        allTabs.forEach(tab => {
            tab.classList.remove('active');
        });
        
        const defaultTabElement = document.querySelector(`[data-tab="${defaultTab}"]`);
        console.log('🧭 [RESET-TAB-4] Default tab element found?', !!defaultTabElement);
        
        if (defaultTabElement) {
            defaultTabElement.classList.add('active');
            console.log('✅ [RESET-TAB-4] Default tab activated');
        }
        
        const allContent = document.querySelectorAll('.social-content');
        console.log('🧭 [RESET-TAB-5] Found content sections:', allContent.length);
        
        allContent.forEach(content => {
            content.classList.remove('active');
        });
        
        const defaultContent = document.getElementById(`${defaultTab}Content`);
        console.log('🧭 [RESET-TAB-6] Default content element found?', !!defaultContent);
        
        if (defaultContent) {
            defaultContent.classList.add('active');
            console.log('✅ [RESET-TAB-6] Default content activated');
        }
        
        console.log('✅ [RESET-TAB-7] resetSocialTab complete');
    }
    
    /**
     * Show loading overlay
     */
    showLoading() {
        console.log('🧭 [LOADING-1] showLoading called');
        const loadingOverlay = document.getElementById('loadingOverlay');
        console.log('🧭 [LOADING-2] Loading overlay found?', !!loadingOverlay);
        
        if (loadingOverlay) {
            loadingOverlay.classList.add('show');
            console.log('✅ [LOADING-2] Loading overlay shown');
        }
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        console.log('🧭 [LOADING-3] hideLoading called');
        const loadingOverlay = document.getElementById('loadingOverlay');
        console.log('🧭 [LOADING-4] Loading overlay found?', !!loadingOverlay);
        
        if (loadingOverlay) {
            loadingOverlay.classList.remove('show');
            console.log('✅ [LOADING-4] Loading overlay hidden');
        }
    }
    
    /**
     * Show/hide guest banner
     */
    toggleGuestBanner(show) {
        console.log('🧭 [GUEST-BANNER-1] toggleGuestBanner called:', show);
        
        const guestBanner = document.getElementById('guestBanner');
        console.log('🧭 [GUEST-BANNER-2] Guest banner found?', !!guestBanner);
        
        if (guestBanner) {
            guestBanner.style.display = show ? 'block' : 'none';
            console.log('✅ [GUEST-BANNER-2] Banner visibility:', show ? 'visible' : 'hidden');
        }
    }
    
    /**
     * Update main screens authentication state
     */
    updateAuthenticationState(isAuthenticated) {
        console.log('🧭 [AUTH-STATE-1] updateAuthenticationState called:', isAuthenticated);
        
        const mainScreens = document.querySelector('.main-screens');
        const bottomNav = document.querySelector('.bottom-nav');
        
        console.log('🧭 [AUTH-STATE-2] Main screens found?', !!mainScreens);
        console.log('🧭 [AUTH-STATE-2] Bottom nav found?', !!bottomNav);
        
        if (mainScreens) {
            if (isAuthenticated) {
                mainScreens.classList.add('authenticated');
                console.log('✅ [AUTH-STATE-3] Main screens marked as authenticated');
            } else {
                mainScreens.classList.remove('authenticated');
                console.log('✅ [AUTH-STATE-3] Main screens marked as unauthenticated');
            }
        }
        
        if (bottomNav) {
            bottomNav.style.display = isAuthenticated ? 'flex' : 'none';
            console.log('✅ [AUTH-STATE-4] Bottom nav visibility:', isAuthenticated ? 'visible' : 'hidden');
        }
        
        console.log('✅ [AUTH-STATE-5] Authentication state updated');
    }
    
    /**
     * Get current screen
     */
    getCurrentScreen() {
        const currentScreen = this.state.get('currentScreen');
        console.log('🧭 [GET-SCREEN] getCurrentScreen:', currentScreen);
        return currentScreen;
    }
    
    /**
     * Get navigation history
     */
    getNavigationHistory() {
        console.log('🧭 [GET-HISTORY] getNavigationHistory called');
        console.log('🧭 [GET-HISTORY] History:', [...this.navigationHistory]);
        return [...this.navigationHistory];
    }
    
    /**
     * Clear navigation history
     */
    clearNavigationHistory() {
        console.log('🧭 [CLEAR-HISTORY-1] clearNavigationHistory called');
        console.log('🧭 [CLEAR-HISTORY-1] Old history:', [...this.navigationHistory]);
        
        const currentScreen = this.state.get('currentScreen') || 'restaurant';
        this.navigationHistory = [currentScreen];
        
        console.log('🧭 [CLEAR-HISTORY-2] New history:', [...this.navigationHistory]);
        console.log('✅ [CLEAR-HISTORY-3] Navigation history cleared');
    }
}
