// javascript/core/router.js

/**
 * Router Manager
 * Handles deep links, hash navigation, overlay stack, and browser history
 * Extracted from navigation.js for separation of concerns
 */
export class Router {
    constructor(appState) {
        this.state = appState;
        
        // References to other managers (set later via setManagers)
        this.navigationManager = null;
        this.authManager = null;
        this.businessManager = null;
        
        // SECURITY: Track overlay stack for proper back navigation
        this.overlayStack = [];
        
        // Track if listeners are set up
        this._listenersSetup = false;
        
        // Store listener references for cleanup
        this._hashChangeListener = null;
        this._popStateListener = null;
        
        console.log('🔗 [ROUTER] Router instance created');
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.authManager = managers.auth;
        this.businessManager = managers.business;
        console.log('🔗 [ROUTER] Manager references set');
    }
    
    /**
     * Initialize router system
     */
    async init() {
        console.log('🔗 [ROUTER-INIT-1] Initializing router at:', Date.now());
        
        // Set up hash change listeners
        this.setupHashListeners();
        
        // CRITICAL: Check for deep link BEFORE normal navigation
        const hash = window.location.hash.slice(1);
        const isDeepLink = hash.startsWith('business/') || hash.startsWith('story/');
        
        console.log('🔗 [ROUTER-INIT-2] Current hash:', hash);
        console.log('🔗 [ROUTER-INIT-2] Is deep link?', isDeepLink);
        
        if (isDeepLink) {
            console.log('🔗 [ROUTER-INIT-3] Deep link detected, processing immediately');
            // Process deep link without overwriting hash
            await this.handleDeepLink();
        }
        
        console.log('🔗 [ROUTER-INIT-4] Router initialization complete at:', Date.now());
    }
    
    /**
     * Set up hash change listeners
     */
    setupHashListeners() {
        // Prevent multiple setups
        if (this._listenersSetup) {
            console.log('🔗 [ROUTER] Hash listeners already set up, skipping');
            return;
        }
        this._listenersSetup = true;
        
        // Hash change listener
        this._hashChangeListener = () => {
            console.log('🔗 [ROUTER] Hash changed to:', window.location.hash);
            this.handleDeepLink();
        };
        window.addEventListener('hashchange', this._hashChangeListener);
        
        // Browser back/forward button listener
        this._popStateListener = (e) => {
            console.log('🔗 [ROUTER] Popstate event:', e.state);
            if (e.state && e.state.screen) {
                this.navigateToScreen(e.state.screen, false);
            }
        };
        window.addEventListener('popstate', this._popStateListener);
        
        console.log('🔗 [ROUTER] Hash listeners set up');
    }
    
    /**
     * Handle deep link routing
     */
    async handleDeepLink() {
        console.log('🔗 [ROUTER-DEEPLINK-1] handleDeepLink() called at:', Date.now());
        const hash = window.location.hash.slice(1);
        console.log('🔗 [ROUTER-DEEPLINK-1] Hash value:', hash);
        
        // SECURITY: Sanitize hash input
        const sanitizedHash = hash.replace(/[^a-zA-Z0-9/_-]/g, '');
        
        const validScreens = ['restaurant', 'social', 'activity'];
        
        // Check for story deep link format: #story/slug/businessId
        if (sanitizedHash.startsWith('story/')) {
            console.log('🔗 [ROUTER-DEEPLINK-2] Story deep link detected');
            const parts = sanitizedHash.split('/');
            const slug = parts[1];
            const businessId = parts[2];
            
            if (slug && businessId) {
                console.log('🔗 [ROUTER-DEEPLINK-2] Story params:', { slug, businessId });
                await this.openStoryFromURL(slug, businessId);
                return;
            } else {
                console.error('🔗 [ROUTER-DEEPLINK-2] Invalid story deep link format');
            }
        }
        
        // Check for business profile deep link format: #business/businessId
        if (sanitizedHash.startsWith('business/')) {
            console.log('🔗 [ROUTER-DEEPLINK-3] Business deep link detected');
            const businessId = sanitizedHash.split('/')[1];
            console.log('🔗 [ROUTER-DEEPLINK-3] Business ID/slug:', businessId);
            
            if (businessId) {
                console.log('🔗 [ROUTER-DEEPLINK-3] Calling openBusinessFromURL at:', Date.now());
                await this.openBusinessFromURL(businessId);
                return;
            } else {
                console.error('🔗 [ROUTER-DEEPLINK-3] No business ID found in hash');
            }
        }
        
        // Regular screen navigation
        if (validScreens.includes(sanitizedHash)) {
            console.log('🔗 [ROUTER-DEEPLINK-4] Valid screen hash:', sanitizedHash);
            this.navigateToScreen(sanitizedHash);
        }
    }
    
    /**
     * Open business profile from URL parameter
     */
    async openBusinessFromURL(businessIdOrSlug) {
        console.log('🔗 [ROUTER-BUSINESS-1] openBusinessFromURL() called at:', Date.now());
        console.log('🔗 [ROUTER-BUSINESS-1] Business ID/slug:', businessIdOrSlug);
        
        // SECURITY: Sanitize business ID/slug
        const sanitizedId = businessIdOrSlug.replace(/[^a-zA-Z0-9_-]/g, '');
        console.log('🔗 [ROUTER-BUSINESS-1] Sanitized ID:', sanitizedId);
        
        // Hide auth screens if visible (for deep links)
        const authScreen = document.getElementById('authScreen');
        console.log('🔗 [ROUTER-BUSINESS-2] Auth screen exists?', !!authScreen);
        console.log('🔗 [ROUTER-BUSINESS-2] Auth screen visible?', authScreen?.classList.contains('show'));
        
        if (authScreen) {
            authScreen.style.display = 'none';
            authScreen.classList.remove('show');
            authScreen.style.zIndex = '-1';
            console.log('🔗 [ROUTER-BUSINESS-2] Auth screen hidden');
        }
        
        // Ensure app is initialized
        console.log('🔗 [ROUTER-BUSINESS-3] Waiting for app ready at:', Date.now());
        await this.waitForAppReady();
        console.log('🔗 [ROUTER-BUSINESS-3] App ready at:', Date.now());
        
        // CRITICAL: If no user authenticated, enter guest mode automatically for deep links
        const isAuthenticated = this.state.get('isAuthenticated');
        console.log('🔗 [ROUTER-BUSINESS-4] Is authenticated?', isAuthenticated);
        
        if (!isAuthenticated) {
            console.log('🔗 [ROUTER-BUSINESS-4] No user authenticated, enabling guest mode');
            
            if (this.authManager) {
                this.authManager.enableGuestMode();
                console.log('🔗 [ROUTER-BUSINESS-4] Guest mode activated');
            } else {
                console.error('🔗 [ROUTER-BUSINESS-4] AuthManager not available');
            }
        }
        
        // Navigate to restaurant screen first
        console.log('🔗 [ROUTER-BUSINESS-5] Showing restaurant screen');
        this.navigateToScreen('restaurant', false);
        
        // Small delay to ensure feed is loaded
        setTimeout(() => {
            console.log('🔗 [ROUTER-BUSINESS-6] 500ms delay elapsed, opening business at:', Date.now());
            
            console.log('🔗 [ROUTER-BUSINESS-6] BusinessManager exists?', !!this.businessManager);
            
            if (this.businessManager) {
                console.log('🔗 [ROUTER-BUSINESS-6] Calling openBusinessProfileBySlugOrId');
                this.businessManager.openBusinessProfileBySlugOrId(sanitizedId);
            } else {
                console.error('❌ [ROUTER-BUSINESS-6] BusinessManager not available');
            }
        }, 500);
    }
    
    /**
     * Open story viewer from URL parameter
     */
    async openStoryFromURL(slug, businessId) {
        console.log('🔗 [ROUTER-STORY-1] openStoryFromURL() called at:', Date.now());
        console.log('🔗 [ROUTER-STORY-1] Params:', { slug, businessId });
        
        // SECURITY: Sanitize inputs
        const sanitizedSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
        const sanitizedBusinessId = businessId.replace(/[^a-zA-Z0-9_-]/g, '');
        
        // Ensure app is initialized
        console.log('🔗 [ROUTER-STORY-2] Waiting for app ready at:', Date.now());
        await this.waitForAppReady();
        console.log('🔗 [ROUTER-STORY-2] App ready at:', Date.now());
        
        // Navigate to restaurant screen first
        console.log('🔗 [ROUTER-STORY-3] Showing restaurant screen');
        this.navigateToScreen('restaurant', false);
        
        // Small delay to ensure feed is loaded
        setTimeout(() => {
            console.log('🔗 [ROUTER-STORY-4] 500ms delay elapsed, opening story at:', Date.now());
            
            // Find and open the story
            if (window.CLASSIFIED?.openStoryByBusinessId) {
                console.log('🔗 [ROUTER-STORY-4] Calling openStoryByBusinessId');
                window.CLASSIFIED.openStoryByBusinessId(sanitizedBusinessId);
            } else {
                console.error('❌ [ROUTER-STORY-4] Story viewer not available');
            }
        }, 500);
    }
    
    /**
     * Wait for app to be ready
     */
    waitForAppReady() {
        return new Promise((resolve) => {
            const maxAttempts = 50; // 5 seconds max
            let attempts = 0;
            
            const checkReady = () => {
                const isReady = window.classifiedApp && 
                               window.classifiedApp.businessManager &&
                               this.businessManager;
                
                if (isReady) {
                    console.log('✅ [ROUTER] App ready for deep link');
                    resolve();
                    return true;
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('⏱️ [ROUTER] Timeout waiting for app to initialize');
                    resolve(); // Resolve anyway to prevent hanging
                    return true;
                }
                
                return false;
            };
            
            if (checkReady()) return;
            
            const checkInterval = setInterval(() => {
                if (checkReady()) {
                    clearInterval(checkInterval);
                }
            }, 100);
        });
    }
    
    // ===========================
    // OVERLAY STACK MANAGEMENT
    // ===========================
    
    /**
     * Push overlay to stack
     */
    pushOverlay(overlayId) {
        // SECURITY: Sanitize overlay ID
        const sanitizedId = overlayId.replace(/[^a-zA-Z0-9_-]/g, '');
        
        if (!this.overlayStack.includes(sanitizedId)) {
            this.overlayStack.push(sanitizedId);
            console.log('📚 [ROUTER] Overlay pushed:', sanitizedId, '| Stack:', this.overlayStack);
        } else {
            console.log('⚠️ [ROUTER] Overlay already in stack:', sanitizedId);
        }
    }
    
    /**
     * Pop overlay from stack
     */
    popOverlay() {
        const overlayId = this.overlayStack.pop();
        console.log('📚 [ROUTER] Overlay popped:', overlayId, '| Stack:', this.overlayStack);
        return overlayId;
    }
    
    /**
     * Get current overlay (top of stack)
     */
    getCurrentOverlay() {
        return this.overlayStack[this.overlayStack.length - 1] || null;
    }
    
    /**
     * Get full overlay stack (for debugging)
     */
    getOverlayStack() {
        return [...this.overlayStack];
    }
    
    /**
     * Remove specific overlay from stack
     */
    removeOverlay(overlayId) {
        const index = this.overlayStack.indexOf(overlayId);
        if (index > -1) {
            this.overlayStack.splice(index, 1);
            console.log('📚 [ROUTER] Overlay removed:', overlayId, '| Stack:', this.overlayStack);
        }
    }
    
    /**
     * Clear overlay stack (use when logging out or switching users)
     */
    clearOverlayStack() {
        console.log('🧹 [ROUTER] Clearing overlay stack');
        this.overlayStack = [];
    }
    
    // ===========================
    // HASH & HISTORY MANAGEMENT
    // ===========================
    
    /**
     * Navigate to screen
     */
    navigateToScreen(screenType, updateHistory = true) {
        console.log('🔗 [ROUTER] Navigate to screen:', screenType, '| Update history?', updateHistory);
        
        if (this.navigationManager) {
            this.navigationManager.showScreen(screenType, updateHistory);
        } else {
            console.error('❌ [ROUTER] NavigationManager not available');
        }
    }
    
    /**
     * Update URL hash
     */
    updateHash(hash, addToHistory = true) {
        // SECURITY: Sanitize hash
        const sanitizedHash = hash.replace(/[^a-zA-Z0-9/_-]/g, '');
        
        console.log('🔗 [ROUTER] Update hash:', sanitizedHash, '| Add to history?', addToHistory);
        
        if (addToHistory) {
            history.pushState({ screen: sanitizedHash }, '', `#${sanitizedHash}`);
        } else {
            history.replaceState({ screen: sanitizedHash }, '', `#${sanitizedHash}`);
        }
    }
    
    /**
     * Parse current hash
     */
    parseHash() {
        const hash = window.location.hash.slice(1);
        const sanitized = hash.replace(/[^a-zA-Z0-9/_-]/g, '');
        
        const parts = sanitized.split('/');
        
        return {
            raw: hash,
            sanitized: sanitized,
            type: parts[0] || null,
            param1: parts[1] || null,
            param2: parts[2] || null,
            parts: parts
        };
    }
    
    /**
     * Push state to browser history
     */
    pushState(screen) {
        // SECURITY: Sanitize screen name
        const sanitizedScreen = screen.replace(/[^a-zA-Z0-9_-]/g, '');
        
        console.log('🔗 [ROUTER] Push state:', sanitizedScreen);
        history.pushState({ screen: sanitizedScreen }, '', `#${sanitizedScreen}`);
    }
    
    /**
     * Replace current state in browser history
     */
    replaceState(screen) {
        // SECURITY: Sanitize screen name
        const sanitizedScreen = screen.replace(/[^a-zA-Z0-9_-]/g, '');
        
        console.log('🔗 [ROUTER] Replace state:', sanitizedScreen);
        history.replaceState({ screen: sanitizedScreen }, '', `#${sanitizedScreen}`);
    }
    
    // ===========================
    // CLEANUP
    // ===========================
    
    /**
     * Clean up router resources
     */
    cleanup() {
        console.log('🧹 [ROUTER] Cleaning up router');
        
        // Remove event listeners
        if (this._hashChangeListener) {
            window.removeEventListener('hashchange', this._hashChangeListener);
            this._hashChangeListener = null;
        }
        
        if (this._popStateListener) {
            window.removeEventListener('popstate', this._popStateListener);
            this._popStateListener = null;
        }
        
        // Clear overlay stack
        this.clearOverlayStack();
        
        // Clear manager references
        this.navigationManager = null;
        this.authManager = null;
        this.businessManager = null;
        
        console.log('✅ [ROUTER] Router cleanup complete');
    }
}
