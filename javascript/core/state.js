// javascript/core/state.js
export const AppState = {
    // Configuration
    config: {
        enableDemoData: true,
        demoUserPrefix: 'demo_',
        minUsersToShow: 6,
        firebaseReady: false
    },
    
    // Current state
    currentScreen: 'restaurant',
    currentSocialTab: 'userFeed',
    currentBusiness: null,
    currentViewedUser: null,
    currentChatUser: null,
    currentUser: null,
    isAuthenticated: false,
    isGuestMode: false,
    isBusinessUser: false,
    isProfileOpen: false,
    isChatOpen: false,
    isProfileEditorOpen: false,
    isUserProfileOpen: false,
    isBusinessProfileEditorOpen: false,
    currentUploadSlot: null,
    currentBusinessUploadSlot: null,
    
    // User data
    userProfile: {
        name: '',
        age: '',
        bio: '',
        birthday: '',
        zodiac: '',
        height: '',
        career: '',
        interests: [],
        priority: '',
        relationship: '',
        lookingFor: '',
        marriage: '',
        photos: [],
        referralCode: ''
    },
    
    businessProfile: {
        name: '',
        type: '',
        description: '',
        address: '',
        phone: '',
        hours: '',
        priceRange: '',
        promoTitle: '',
        promoDetails: '',
        photos: []
    },
    
    // Combined data stores
    allUsers: [],
    firebaseUsers: [],
    
    // Helper methods
    isDemoUser: (userId) => userId && userId.startsWith(AppState.config.demoUserPrefix),
    
    // Listeners storage
    listeners: {
        messageListener: null,
        chatListListener: null,
        matchListener: null
    }
};

// Make it globally available for migration period
window.AppState = AppState;
