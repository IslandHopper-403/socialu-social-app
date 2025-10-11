// FILE: javascript/main.js - REFACTORED VERSION 4.0
// Main application entry point with NotificationsManager integration

import { FirebaseServices } from './config/firebase.js';
import { AppState } from './core/state.js';
import { MockData } from './data/mockData.js';
import { AuthManager } from './features/auth.js';
import { NotificationsManager } from './features/notifications.js'; // ADDED: Import NotificationsManager
import { MessagingManager } from './features/messaging.js';
import { MatchingManager } from './features/matching.js';
import { FeedManager } from './features/feed.js';
import { ProfileManager } from './features/profile.js';
import { NavigationManager } from './ui/navigation.js';
import { FavoritesCarousel } from './features/favoritesCarousel.js';
import { BusinessManager } from './features/business.js';
import { AdminManager } from './features/admin.js';

/**
 * Main Application Class - Version 4.0
 * Now includes NotificationsManager as centralized notification handler
 */
class ClassifiedApp {
    constructor() {
        console.log('🚀 [MAIN] Constructing ClassifiedApp v4.0...');
        
        // Core services
        this.firebase = new FirebaseServices();
        this.state = new AppState();
        this.mockData = new MockData();
        
        // Managers (initialized in init())
        this.notifications = null; // ADDED: NotificationsManager - initialized FIRST
        this.auth = null;
        this.messaging = null;
        this.matching = null;
        this.feed = null;
        this.profile = null;
        this.navigation = null;
        this.favorites = null;
        this.business = null;
        this.admin = null;
        
        console.log('✅ [MAIN] ClassifiedApp v4.0 constructed');
    }
    
    /**
     * Initialize the application
     */
    async init() {
        console.log('🚀 [MAIN] Initializing CLASSIFIED App v4.0...');
        console.log('🔔 [MAIN] This version includes centralized NotificationsManager');
        
        try {
            // Initialize Firebase
            console.log('🔥 [MAIN] Initializing Firebase...');
            await this.firebase.init();
            console.log('✅ [MAIN] Firebase initialized');
            
            // Initialize state
            console.log('📊 [MAIN] Initializing AppState...');
            this.state.init();
            console.log('✅ [MAIN] AppState initialized');
            
            // CRITICAL: Initialize NotificationsManager FIRST
            // This must happen before other managers so they can reference it
            console.log('🔔 [MAIN] Initializing NotificationsManager (PRIORITY)...');
            this.notifications = new NotificationsManager(this.firebase, this.state);
            console.log('✅ [MAIN] NotificationsManager constructed');
            
            // Initialize other managers
            console.log('👥 [MAIN] Initializing core managers...');
            this.auth = new AuthManager(this.firebase, this.state);
            console.log('  ✅ AuthManager initialized');
            
            this.messaging = new MessagingManager(this.firebase, this.state);
            console.log('  ✅ MessagingManager initialized');
            
            this.matching = new MatchingManager(this.firebase, this.state);
            console.log('  ✅ MatchingManager initialized');
            
            this.feed = new FeedManager(this.firebase, this.state);
            console.log('  ✅ FeedManager initialized');
            
            this.profile = new ProfileManager(this.firebase, this.state);
            console.log('  ✅ ProfileManager initialized');
            
            this.navigation = new NavigationManager(this.state);
            console.log('  ✅ NavigationManager initialized');
            
            this.favorites = new FavoritesCarousel(this.firebase, this.state);
            console.log('  ✅ FavoritesCarousel initialized');
            
            this.business = new BusinessManager(this.firebase, this.state);
            console.log('  ✅ BusinessManager initialized');
            
            this.admin = new AdminManager(this.firebase, this.state);
            console.log('  ✅ AdminManager initialized');
            
            console.log('✅ [MAIN] All managers constructed');
            
            // Set manager references - INCLUDES notifications
            console.log('🔗 [MAIN] Setting cross-manager references...');
            const managers = {
                navigation: this.navigation,
                profile: this.profile,
                messaging: this.messaging,
                matching: this.matching,
                feed: this.feed,
                favorites: this.favorites,
                business: this.business,
                notifications: this.notifications // ADDED: Make notifications available to all managers
            };
            
            console.log('🔗 [MAIN] Managers object created with notifications:', !!managers.notifications);
            
            // Set references in each manager
            console.log('🔗 [MAIN] Distributing manager references...');
            this.messaging.setManagers(managers);
            console.log('  ✅ MessagingManager references set');
            
            this.matching.setManagers(managers);
            console.log('  ✅ MatchingManager references set');
            
            this.profile.setManagers(managers);
            console.log('  ✅ ProfileManager references set');
            
            this.feed.setManagers(managers);
            console.log('  ✅ FeedManager references set');
            
            this.business.setManagers(managers);
            console.log('  ✅ BusinessManager references set');
            
            this.notifications.setManagers(managers);
            console.log('  ✅ NotificationsManager references set');
            
            console.log('✅ [MAIN] All manager references distributed');
            
            // Initialize components in correct order
            console.log('🎬 [MAIN] Initializing manager features...');
            
            // 1. Auth first (establishes user session)
            console.log('🔐 [MAIN] Initializing AuthManager...');
            await this.auth.init();
            console.log('✅ [MAIN] AuthManager initialized');
            
            // 2. Notifications second (needs auth to set up listeners)
            console.log('🔔 [MAIN] Initializing NotificationsManager features...');
            await this.notifications.init();
            console.log('✅ [MAIN] NotificationsManager features initialized');
            
            // 3. Messaging (depends on notifications)
            console.log('💬 [MAIN] Initializing MessagingManager...');
            await this.messaging.init();
            console.log('✅ [MAIN] MessagingManager initialized');
            
            // 4. Matching (depends on notifications)
            console.log('💕 [MAIN] Initializing MatchingManager...');
            await this.matching.init();
            console.log('✅ [MAIN] MatchingManager initialized');
            
            // 5. Rest of the managers
            console.log('📱 [MAIN] Initializing remaining managers...');
            await this.feed.init();
            console.log('  ✅ FeedManager initialized');
            
            await this.profile.init();
            console.log('  ✅ ProfileManager initialized');
            
            await this.navigation.init();
            console.log('  ✅ NavigationManager initialized');
            
            await this.favorites.init();
            console.log('  ✅ FavoritesCarousel initialized');
            
            await this.business.init();
            console.log('  ✅ BusinessManager initialized');
            
            console.log('✅ [MAIN] All manager features initialized');
            
            // Make managers globally accessible
            console.log('🌍 [MAIN] Setting up window.classifiedApp...');
            window.classifiedApp = {
                firebase: this.firebase,
                state: this.state,
                mockData: this.mockData,
                managers: {
                    auth: this.auth,
                    notifications: this.notifications, // ADDED: Global access to notifications
                    messaging: this.messaging,
                    matching: this.matching,
                    feed: this.feed,
                    profile: this.profile,
                    navigation: this.navigation,
                    favorites: this.favorites,
                    business: this.business,
                    admin: this.admin
                }
            };
            
            console.log('✅ [MAIN] window.classifiedApp configured');
            console.log('🔔 [MAIN] NotificationsManager available at: window.classifiedApp.managers.notifications');
            
            // Setup global error handler
            this.setupErrorHandler();
            
            console.log('✅ [MAIN] CLASSIFIED App v4.0 fully initialized');
            console.log('🎉 [MAIN] Notification system centralized and ready');
            
        } catch (error) {
            console.error('❌ [MAIN] Fatal error during initialization:', error);
            this.showFatalError(error);
        }
    }
    
    /**
     * Setup global error handler
     */
    setupErrorHandler() {
        console.log('⚠️ [MAIN] Setting up global error handler...');
        
        window.addEventListener('error', (event) => {
            console.error('❌ [MAIN] Global error caught:', event.error);
            
            // Log to analytics (placeholder)
            this.logError('global_error', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('❌ [MAIN] Unhandled promise rejection:', event.reason);
            
            // Log to analytics (placeholder)
            this.logError('unhandled_rejection', event.reason);
        });
        
        console.log('✅ [MAIN] Global error handler active');
    }
    
    /**
     * Log error (placeholder for analytics)
     */
    logError(type, error) {
        console.log('📊 [MAIN] Logging error:', type, error);
        // In production, send to analytics service
    }
    
    /**
     * Show fatal error to user
     */
    showFatalError(error) {
        console.error('💀 [MAIN] Showing fatal error to user:', error);
        
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 400px;
            text-align: center;
            z-index: 10000;
        `;
        
        errorContainer.innerHTML = `
            <h2 style="color: #e74c3c; margin-bottom: 1rem;">Oops! Something went wrong</h2>
            <p style="margin-bottom: 1rem;">We're having trouble loading the app. Please refresh the page to try again.</p>
            <button onclick="location.reload()" style="
                background: #3498db;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 1rem;
            ">Refresh Page</button>
        `;
        
        document.body.appendChild(errorContainer);
    }
    
    /**
     * Cleanup on app destroy (for SPA scenarios)
     */
    async cleanup() {
        console.log('🧹 [MAIN] Cleaning up ClassifiedApp...');
        
        try {
            // Cleanup managers in reverse order
            if (this.business) await this.business.cleanup();
            if (this.favorites) await this.favorites.cleanup();
            if (this.navigation) await this.navigation.cleanup();
            if (this.profile) await this.profile.cleanup();
            if (this.feed) await this.feed.cleanup();
            if (this.matching) await this.matching.cleanup();
            if (this.messaging) await this.messaging.cleanup();
            if (this.notifications) await this.notifications.cleanup(); // ADDED: Cleanup notifications
            if (this.auth) await this.auth.cleanup();
            
            console.log('✅ [MAIN] All managers cleaned up');
            
            // Clear global reference
            delete window.classifiedApp;
            
            console.log('✅ [MAIN] ClassifiedApp cleanup complete');
            
        } catch (error) {
            console.error('❌ [MAIN] Error during cleanup:', error);
        }
    }
}

// Initialize app when DOM is ready
console.log('📄 [MAIN] Script loaded, waiting for DOM...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 [MAIN] DOM ready, initializing app...');
        const app = new ClassifiedApp();
        app.init();
    });
} else {
    console.log('📄 [MAIN] DOM already ready, initializing app immediately...');
    const app = new ClassifiedApp();
    app.init();
}

// Export for module usage (if needed)
export { ClassifiedApp };
