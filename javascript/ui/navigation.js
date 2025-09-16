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
    }
    
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
        // Bottom navigation listeners - Remove existing onclick first
        document.querySelectorAll('.nav-item').forEach(item => {
            // Remove any existing onclick
            item.onclick = null;
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
                if (parentOverlay) {
                    this.closeOverlay(parentOverlay.id);
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

            return;
        }
        
        // Update state
        // this.state.set('currentScreen', screenType);
        
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
     * Show overlay screen
     */
    showOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.add('show');
            
            // Update corresponding state
            this.updateOverlayState(overlayId, true);
        }
    }
    
    /**
     * Close overlay screen
     */
    closeOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.remove('show');
            
            // Update corresponding state
            this.updateOverlayState(overlayId, false);
        }
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
