import { auth, db, storage } from '../config/firebase.config.js';
import appState from './state.js';
import { setupAuthListener } from '../features/auth.js';
import { populateUserFeed } from '../features/feed.js';
import { initMessaging } from '../features/messaging.js';
import { setupNavigation } from '../ui/navigation.js';

// Main CLASSIFIED App
export const CLASSIFIED = {
    state: appState,
    
    // Initialize App
    init() {
        console.log('🚀 Starting CLASSIFIED v7.0...');
        
        // Setup authentication listener
        setupAuthListener();
        
        // Setup navigation
        setupNavigation();
        
        // Initialize features
        if (this.state.isAuthenticated) {
            populateUserFeed();
            initMessaging();
        }
        
        console.log('✅ CLASSIFIED app ready!');
    }
};

// Make globally available
window.CLASSIFIED = CLASSIFIED;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    CLASSIFIED.init();
});
