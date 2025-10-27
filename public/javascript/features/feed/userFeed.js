// javascript/features/feed/userFeed.js

import { sanitizeText, escapeHtml, createSafeElement } from '../../utils/security.js';
import { getOptimizedImageURL } from '../../utils/imageUtils.js';
import { FeedPaginator } from '../../utils/pagination.js'; 

import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';


import { getUserItem } from '../../utils/storage.js';

/**
 * User Feed Manager
 * Handles all user feed displays - user profiles, filtering, and interactions
 */
export class UserFeedManager {
    constructor(firebaseServices, appState, mockData) {
        console.log('👥 [UserFeedManager] Initializing...');
        
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.mockData = mockData;
        
        // Current filter state
        this.currentUserFilter = 'all';
        
        // Cache for fetched users
        this.currentUsers = [];

        // PERFORMANCE: Cache matched users to avoid repeated Firebase queries
        this.cachedMatchedUsers = null;
        this.matchedUsersCacheTime = 0;
        this.CACHE_DURATION = 60000; // 1 minute cache

        // Pagination for infinite scroll
        this.userPaginator = null;
        this.demoUserPaginator = null;
        this.isLoadingUsers = false;
        
        console.log('✅ [UserFeedManager] Initialized');

    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.uiComponents = managers.ui;
        
        // Get mockData from global app instance if not available
        if (!this.mockData && window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
            console.log('✅ [UserFeedManager] MockData retrieved from global app instance');
        }
    }
    
    /**
     * Initialize user feed system
     */
    async init() {
        console.log('👥 [UserFeedManager] Setting up user feed...');
        
        // Set up filter chip listeners
        this.setupFilterListeners();
        
        console.log('✅ [UserFeedManager] User feed initialized');
    }
    
    /**
     * Handle user login - refresh user feed
     */
    async onUserLogin(user) {
        console.log('👥 [UserFeedManager] ===== USER LOGIN DETECTED =====');
        console.log('👥 [UserFeedManager] User:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        });
        console.log('👥 [UserFeedManager] Triggering user feed population...');
        
        try {
            await this.populateUserFeed();
            console.log('✅ [UserFeedManager] User feed populated successfully');
        } catch (error) {
            console.error('❌ [UserFeedManager] Error populating user feed:', error);
            // Retry once after 1 second if failed
            console.log('🔄 [UserFeedManager] Retrying user feed load...');
            setTimeout(() => {
                this.populateUserFeed();
            }, 1000);
        }
        
        console.log('👥 [UserFeedManager] ===============================');
    }
    
    /**
     * Set up filter chip event listeners
     */
    setupFilterListeners() {
        console.log('👥 [UserFeedManager] Setting up filter listeners...');
        
        // Filter chip listeners - Remove existing onclick handlers first
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.onclick = null;
            chip.addEventListener('click', (e) => {
                const filter = chip.dataset.filter;
                this.filterUsers(filter);
            });
        });
        
        console.log('✅ [UserFeedManager] Filter listeners attached');
    }


    
    
    /**
     * Populate user feed based on auth state
     */
 async populateUserFeed() {
        console.log('👥 [populateUserFeed] Called with auth state:', {
            isAuthenticated: this.state.get('isAuthenticated'),
            isGuestMode: this.state.get('isGuestMode'),
            currentUser: this.state.get('currentUser')?.uid
        });
        
        if (!this.state.get('isAuthenticated')) {
            console.warn('⚠️ [populateUserFeed] User not authenticated, skipping');
            return;
        }
        
        const container = document.getElementById('userFeedContainer');
        
        // CRITICAL: Check if container exists (Social screen might not be active yet)
        if (!container) {
            console.warn('⚠️ [populateUserFeed] userFeedContainer not found - Social screen may not be active yet');
            return;
        }
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            console.log('👥 [populateUserFeed] Fetching users from Firebase...');
            const users = await this.fetchUsersFromFirebase();
            
            // CACHE THE USERS FOR FILTERING
            this.currentUsers = users;
            
            console.log('👥 [populateUserFeed] Fetched users:', {
                count: users.length,
                userIds: users.map(u => u.id)
            });
            
            if (users.length > 0) {
                this.populateUserFeedWithData(users, container);
            } else {
                // Show demo users with encouraging message
                this.populateDemoUserFeed(container);
            }
            
        } catch (error) {
            console.error('❌ [populateUserFeed] Error loading users:', error);
            this.showUserFeedError(container);
        }
    }
    
   /**
     * Fetch users from Firebase
     */
    async fetchUsersFromFirebase() {
        console.log('👥 [fetchUsersFromFirebase] Starting fetch...');
        console.log('🔍 [FEED-DEBUG-3] fetchUsersFromFirebase() called at:', Date.now());
        
        const users = [];
        const currentUserId = this.state.get('currentUser')?.uid;
        
        if (!currentUserId) {
            console.warn('⚠️ [fetchUsersFromFirebase] No current user ID');
            return users;
        }
        
        console.log('👥 [fetchUsersFromFirebase] Current user ID:', currentUserId);
        
        // Create query that excludes current user
        const q = query(
            collection(this.db, 'users'),
            orderBy('updatedAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        console.log('👥 [fetchUsersFromFirebase] Firebase returned', snapshot.size, 'users');
        
        // Get liked/passed users from localStorage
        const likedUsers = this.getLikedUsers();
        const passedUsers = this.getPassedUsers();
        
        // CRITICAL FIX: Also get MATCHED users from Firebase
        const matchedUsers = await this.getMatchedUsers(currentUserId);
        
        console.log('👥 [fetchUsersFromFirebase] Filtering:', {
            totalFromFirebase: snapshot.size,
            likedCount: likedUsers.size,
            passedCount: passedUsers.size,
            matchedCount: matchedUsers.size
        });
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            const docId = doc.id;
            
            // Skip current user, incomplete profiles, AND already actioned users
            if (docId === currentUserId || 
                !userData.name || 
                !userData.bio || 
                !userData.interests?.length ||
                likedUsers.has(docId) ||
                passedUsers.has(docId) ||
                matchedUsers.has(docId)) {  // ✅ NEW: Filter matched users
                
                // Debug log for filtered users
                if (matchedUsers.has(docId)) {
                    console.log('🔍 [FEED-DEBUG-3] Filtered out matched user:', docId);
                }
                return;
            }
            
            users.push({
                id: doc.id,
                uid: doc.id,
                name: userData.name,
                age: userData.age || 25,
                image: userData.photos?.[0] || userData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop',
                interests: userData.interests || ['Travel', 'Adventure'],
                bio: userData.bio || 'Exploring Hoi An!',
                isOnline: userData.isOnline || false,
                distance: userData.distance || `${Math.floor(Math.random() * 5) + 1} km`,
                matchPercentage: userData.matchPercentage || Math.floor(Math.random() * 30) + 70,
                category: userData.category || 'all',
                career: userData.career,
                lookingFor: userData.lookingFor,
                height: userData.height,
                zodiac: userData.zodiac,
                showHoroscope: userData.showHoroscope || false
            });
        });
        
        console.log('✅ [fetchUsersFromFirebase] Filtered to', users.length, 'valid users');
        return users;
    }
    
   /**
     * Get liked users from localStorage (user-specific)
     * Uses centralized storage utility for consistency
     */
    getLikedUsers() {
        try {
            console.log('🔍 [FEED-DEBUG-1] getLikedUsers() called at:', Date.now());
            
            const currentUser = this.state.get('currentUser');
            if (!currentUser || !currentUser.uid) {
                console.warn('⚠️ [FEED-DEBUG-1] No current user, returning empty set');
                return new Set();
            }
            
            // Use storage utility for user-specific data
            const stored = getUserItem('likedUsers', currentUser.uid);
            
            console.log('🔍 [FEED-DEBUG-1] Reading from storage utility:', {
                userId: currentUser.uid,
                hasData: !!stored,
                dataLength: stored ? stored.length : 0
            });
            
            const likedUsers = stored ? new Set(stored) : new Set();
            console.log('✅ [FEED-DEBUG-1] Loaded', likedUsers.size, 'liked users');
            
            return likedUsers;
        } catch (error) {
            console.error('❌ [FEED-DEBUG-1] Error loading liked users:', error);
            return new Set();
        }
    }
    
   /**
     * Get passed users from localStorage (user-specific)
     * Uses centralized storage utility for consistency
     */
    getPassedUsers() {
        try {
            console.log('🔍 [FEED-DEBUG-2] getPassedUsers() called at:', Date.now());
            
            const currentUser = this.state.get('currentUser');
            if (!currentUser || !currentUser.uid) {
                console.warn('⚠️ [FEED-DEBUG-2] No current user, returning empty set');
                return new Set();
            }
            
            // Use storage utility for user-specific data
            const stored = getUserItem('passedUsers', currentUser.uid);
            
            console.log('🔍 [FEED-DEBUG-2] Reading from storage utility:', {
                userId: currentUser.uid,
                hasData: !!stored,
                dataLength: stored ? stored.length : 0
            });
            
            const passedUsers = stored ? new Set(stored) : new Set();
            console.log('✅ [FEED-DEBUG-2] Loaded', passedUsers.size, 'passed users');
            
            return passedUsers;
        } catch (error) {
            console.error('❌ [FEED-DEBUG-2] Error loading passed users:', error);
            return new Set();
        }
    }

    /**
     * Get matched users from Firebase
     * CRITICAL: Query Firebase for all matches involving current user
     */
   async getMatchedUsers(currentUserId) {
        try {
            // PERFORMANCE: Check cache first
            const now = Date.now();
            if (this.cachedMatchedUsers && (now - this.matchedUsersCacheTime) < this.CACHE_DURATION) {
                console.log('⚡ [UserFeed] Using cached matched users:', this.cachedMatchedUsers.size);
                return this.cachedMatchedUsers;
            }
            
            console.log('🔍 [FEED-DEBUG-4] getMatchedUsers() called at:', Date.now());
            console.log('🔍 [FEED-DEBUG-4] Querying matches for user:', currentUserId);
            
            const matchedUsers = new Set();
            
            if (!currentUserId) {
                console.warn('⚠️ [FEED-DEBUG-4] No current user ID');
                return matchedUsers;
            }
            
            // Query matches collection where current user is a participant
            const matchesQuery = query(
                collection(this.db, 'matches'),
                where('users', 'array-contains', currentUserId)
            );
            
            const matchesSnapshot = await getDocs(matchesQuery);
            
            console.log('🔍 [FEED-DEBUG-4] Firebase returned', matchesSnapshot.size, 'matches');
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                // Get the OTHER user in the match
                const otherUserId = matchData.users?.find(uid => uid !== currentUserId);
                if (otherUserId) {
                    matchedUsers.add(otherUserId);
                    console.log('🔍 [FEED-DEBUG-4] Found matched user:', otherUserId);
                }
            });
            
            console.log('✅ [FEED-DEBUG-4] Total matched users:', matchedUsers.size);
            
            // PERFORMANCE: Cache the results
            this.cachedMatchedUsers = matchedUsers;
            this.matchedUsersCacheTime = Date.now();
            
            return matchedUsers;
            
        } catch (error) {
            console.error('❌ [FEED-DEBUG-4] Error fetching matched users:', error);
            return new Set();
        }
    }
    
    
    /**
     * Populate user feed with data
     */
    populateUserFeedWithData(users, container) {
        console.log('👥 [populateUserFeedWithData] Populating with', users.length, 'users');
        
       container.innerHTML = '';
        
        // 📄 CONDITIONAL PAGINATION: Only use pagination if more than 8 items
        if (users.length > 8) {
            console.log('📄 [UserFeedManager] Using pagination for', users.length, 'users');
            
            // Initialize paginator with 8 items per page
            this.userPaginator = new FeedPaginator(users, 8, 'user');
            
            // Get first page only (8 items)
            const firstPage = this.userPaginator.getNextPage();
            
            // Render first page
            firstPage.forEach((user, index) => {
                const feedItem = this.createUserFeedItem(user, index);
                container.appendChild(feedItem);
            });
            
            console.log('✅ [populateUserFeedWithData] Feed populated with', firstPage.length, 'of', users.length, 'users (paginated)');
        } else {
            console.log('📄 [UserFeedManager] Using direct render for', users.length, 'users (no pagination needed)');
            
            // Direct render - FAST for small datasets
            users.forEach((user, index) => {
                const feedItem = this.createUserFeedItem(user, index);
                container.appendChild(feedItem);
            });
            
            console.log('✅ [populateUserFeedWithData] Feed populated with', users.length, 'users (direct render)');
        }
        
        // Add activity indicator
        const activityIndicator = document.createElement('div');
        activityIndicator.className = 'user-activity-indicator';
        activityIndicator.innerHTML = `
            <div style="text-align: center; padding: 20px; background: rgba(0,212,255,0.1); margin: 20px 0; border-radius: 15px;">
                <h3>🔥 ${users.length} travelers active in Hoi An</h3>
                <p>Join the community and start connecting!</p>
            </div>
        `;
        container.appendChild(activityIndicator);
        
        // 📄 PAGINATION: Set up infinite scroll ONLY if pagination is active and has more pages
        if (this.userPaginator && this.userPaginator.hasMore()) {
            console.log('📄 [UserFeedManager] More users available, setting up infinite scroll');
            this.setupUserInfiniteScroll(container);
        }
    }

    /**
     * Set up infinite scroll for user feed
     * Uses IntersectionObserver to detect when user scrolls near bottom
     */
    setupUserInfiniteScroll(container) {
        console.log('📄 [UserFeedManager] setupUserInfiniteScroll() called');
        
        // Create sentinel element at bottom of feed (before activity indicator)
        const sentinel = document.createElement('div');
        sentinel.className = 'feed-sentinel-user';
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        sentinel.setAttribute('data-feed-type', 'user');
        
        // Insert sentinel BEFORE the activity indicator
        const activityIndicator = container.querySelector('.user-activity-indicator');
        if (activityIndicator) {
            activityIndicator.insertAdjacentElement('beforebegin', sentinel);
        } else {
            container.appendChild(sentinel);
        }
        
        console.log('📄 [UserFeedManager] Sentinel element created for users');
        
        // Create IntersectionObserver
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoadingUsers) {
                    console.log('📄 [UserFeedManager] User sentinel intersecting - loading next page at:', Date.now());
                    this.loadNextUserPage(container, sentinel);
                }
            });
        }, {
            root: null, // Use viewport
            rootMargin: '200px', // Load 200px before user reaches bottom (smooth UX)
            threshold: 0.1
        });
        
        observer.observe(sentinel);
        console.log('📄 [UserFeedManager] IntersectionObserver observing user sentinel');
    }
    
    /**
     * Load next page of users
     */
    async loadNextUserPage(container, sentinel) {
        console.log('📄 [UserFeedManager] loadNextUserPage() called at:', Date.now());
        
        // Check if paginator exists and has more
        if (!this.userPaginator || !this.userPaginator.hasMore()) {
            console.log('📄 [UserFeedManager] No more users to load');
            return;
        }
        
        // Prevent duplicate loads
        if (this.isLoadingUsers) {
            console.log('📄 [UserFeedManager] Already loading users, skipping');
            return;
        }
        
        // Set loading state
        this.isLoadingUsers = true;
        this.userPaginator.setLoading(true);
        console.log('📄 [UserFeedManager] Loading state set to true');
        
        // Show loading spinner
        this.showLoadingSpinner(container, sentinel, 'users');
        
        // Simulate slight delay for smooth UX (optional, can remove)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get next page
        const nextPage = this.userPaginator.getNextPage();
        console.log('📄 [UserFeedManager] Next page retrieved:', nextPage.length, 'users');
        
        // Create and insert new user cards BEFORE sentinel
        nextPage.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            sentinel.insertAdjacentElement('beforebegin', feedItem);
        });
        console.log('📄 [UserFeedManager] New user cards inserted into DOM');
        
        // Hide loading spinner
        this.hideLoadingSpinner(container);
        
        // Reset loading state
        this.isLoadingUsers = false;
        this.userPaginator.setLoading(false);
        
        console.log('✅ [UserFeedManager] User page loaded successfully. Has more?', this.userPaginator.hasMore());
    }
    
   /**
     * Populate demo user feed
     */
    populateDemoUserFeed(container) {
        console.log('👥 [populateDemoUserFeed] Showing demo users...');
        
        // Get container if not provided
        if (!container) {
            container = document.getElementById('userFeedContainer');
            console.log('👥 [populateDemoUserFeed] Container not provided, fetching from DOM');
        }
        
        if (!container) {
            console.error('❌ [populateDemoUserFeed] Container not found');
            return;
        }
        
        const demoUsers = this.mockData.getUsers();
        
        container.innerHTML = '';
        
        // 📄 CONDITIONAL PAGINATION: Only use pagination if more than 8 items
        if (demoUsers.length > 8) {
            console.log('📄 [UserFeedManager] Using pagination for', demoUsers.length, 'demo users');
            
            // Initialize paginator with 8 items per page
            this.demoUserPaginator = new FeedPaginator(demoUsers, 8, 'demo-user');
            
            // Get first page only (8 items)
            const firstPage = this.demoUserPaginator.getNextPage();
            
            // Render first page
            firstPage.forEach((user, index) => {
                const feedItem = this.createUserFeedItem(user, index);
                container.appendChild(feedItem);
            });
            
            console.log('✅ [populateDemoUserFeed] Demo feed displayed with', firstPage.length, 'of', demoUsers.length, 'demo users (paginated)');
        } else {
            console.log('📄 [UserFeedManager] Using direct render for', demoUsers.length, 'demo users (no pagination needed)');
            
            // Direct render - FAST for small datasets
            demoUsers.forEach((user, index) => {
                const feedItem = this.createUserFeedItem(user, index);
                container.appendChild(feedItem);
            });
            
            console.log('✅ [populateDemoUserFeed] Demo feed displayed with', demoUsers.length, 'demo users (direct render)');
        }
        
        // Show encouraging message
        const encourageMessage = document.createElement('div');
        encourageMessage.className = 'demo-user-encourage-message';
        encourageMessage.innerHTML = `
            <div style="text-align: center; padding: 40px; opacity: 0.9;">
                <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
                <div style="font-size: 20px; margin-bottom: 15px; color: #00D4FF;">You're among the first!</div>
                <div style="font-size: 16px; margin-bottom: 10px;">These are demo profiles. Complete your profile and invite friends to start real connections!</div>
                <button onclick="CLASSIFIED.shareApp()" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; border-radius: 25px; color: white; font-weight: 600; cursor: pointer;">
                    Share CLASSIFIED 🚀
                </button>
            </div>
        `;
        container.appendChild(encourageMessage);
        
        // 📄 PAGINATION: Set up infinite scroll ONLY if pagination is active and has more pages
        if (this.demoUserPaginator && this.demoUserPaginator.hasMore()) {
            console.log('📄 [UserFeedManager] More demo users available, setting up infinite scroll');
            this.setupDemoUserInfiniteScroll(container);
        }
    }
    
     /**
     * Set up infinite scroll for demo user feed
     * Uses IntersectionObserver to detect when user scrolls near bottom
     */
    setupDemoUserInfiniteScroll(container) {
        console.log('📄 [UserFeedManager] setupDemoUserInfiniteScroll() called');
        
        // Create sentinel element at bottom of feed (before encourage message)
        const sentinel = document.createElement('div');
        sentinel.className = 'feed-sentinel-demo-user';
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        sentinel.setAttribute('data-feed-type', 'demo-user');
        
        // Insert sentinel BEFORE the encourage message
        const encourageMessage = container.querySelector('.demo-user-encourage-message');
        if (encourageMessage) {
            encourageMessage.insertAdjacentElement('beforebegin', sentinel);
        } else {
            container.appendChild(sentinel);
        }
        
        console.log('📄 [UserFeedManager] Sentinel element created for demo users');
        
        // Create IntersectionObserver
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoadingUsers) {
                    console.log('📄 [UserFeedManager] Demo user sentinel intersecting - loading next page at:', Date.now());
                    this.loadNextDemoUserPage(container, sentinel);
                }
            });
        }, {
            root: null, // Use viewport
            rootMargin: '200px', // Load 200px before user reaches bottom (smooth UX)
            threshold: 0.1
        });
        
        observer.observe(sentinel);
        console.log('📄 [UserFeedManager] IntersectionObserver observing demo user sentinel');
    }
    
    /**
     * Load next page of demo users
     */
    async loadNextDemoUserPage(container, sentinel) {
        console.log('📄 [UserFeedManager] loadNextDemoUserPage() called at:', Date.now());
        
        // Check if paginator exists and has more
        if (!this.demoUserPaginator || !this.demoUserPaginator.hasMore()) {
            console.log('📄 [UserFeedManager] No more demo users to load');
            return;
        }
        
        // Prevent duplicate loads (reuse same flag as regular users)
        if (this.isLoadingUsers) {
            console.log('📄 [UserFeedManager] Already loading demo users, skipping');
            return;
        }
        
        // Set loading state
        this.isLoadingUsers = true;
        this.demoUserPaginator.setLoading(true);
        console.log('📄 [UserFeedManager] Loading state set to true');
        
        // Show loading spinner
        this.showLoadingSpinner(container, sentinel, 'demo users');
        
        // Simulate slight delay for smooth UX (optional, can remove)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get next page
        const nextPage = this.demoUserPaginator.getNextPage();
        console.log('📄 [UserFeedManager] Next page retrieved:', nextPage.length, 'demo users');
        
        // Create and insert new user cards BEFORE sentinel
        nextPage.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            sentinel.insertAdjacentElement('beforebegin', feedItem);
        });
        console.log('📄 [UserFeedManager] New demo user cards inserted into DOM');
        
        // Hide loading spinner
        this.hideLoadingSpinner(container);
        
        // Reset loading state
        this.isLoadingUsers = false;
        this.demoUserPaginator.setLoading(false);
        
        console.log('✅ [UserFeedManager] Demo user page loaded successfully. Has more?', this.demoUserPaginator.hasMore());
    }
    
    /**
     * Populate guest user feed (no auth required)
     */
    populateGuestUserFeed() {
        console.log('👥 [populateGuestUserFeed] Showing guest feed...');
        console.log('👥 [populateGuestUserFeed] Auth state:', {
            isAuthenticated: this.state.get('isAuthenticated'),
            isGuestMode: this.state.get('isGuestMode')
        });
        
        const container = document.getElementById('userFeedContainer');
        if (!container) {
            console.warn('⚠️ [populateGuestUserFeed] Container not found - social screen may not be active');
            return;
        }
        
        container.innerHTML = '';
        
        // Show first 3 users to guests
        const guestUsers = this.mockData.getUsers().slice(0, 3);
        guestUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            
            // Add guest overlay
            const overlay = document.createElement('div');
            overlay.innerHTML = `
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; border-radius: 20px; z-index: 10;">
                    <div style="text-align: center; padding: 20px;">
                        <h3 style="color: #FFD700; margin-bottom: 10px;">🔒 Sign up to connect!</h3>
                        <button onclick="CLASSIFIED.showRegister()" style="background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; padding: 10px 20px; border-radius: 20px; color: white; font-weight: 600; cursor: pointer;">
                            Create Account
                        </button>
                    </div>
                </div>
            `;
            overlay.style.position = 'relative';
            feedItem.appendChild(overlay);
            
            container.appendChild(feedItem);
        });
        
        // Add signup encouragement
        const signupCard = document.createElement('div');
        signupCard.innerHTML = `
            <div style="background: linear-gradient(135deg, #FFD700, #FF6B6B); padding: 30px; border-radius: 20px; text-align: center; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; font-size: 20px;">🚀 Ready to connect?</h3>
                <p style="margin: 0 0 20px 0; opacity: 0.9;">Join ${this.mockData.getUsers().length}+ travelers already using CLASSIFIED</p>
                <button onclick="CLASSIFIED.showRegister()" style="background: rgba(255,255,255,0.2); border: none; padding: 12px 24px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer; margin-right: 10px;">
                    Sign Up Free
                </button>
                <button onclick="CLASSIFIED.showLogin()" style="background: transparent; border: 2px solid rgba(255,255,255,0.3); padding: 10px 22px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer;">
                    Login
                </button>
            </div>
        `;
        container.appendChild(signupCard);
        
        console.log('✅ [populateGuestUserFeed] Guest feed displayed');
    }
    
    /**
     * Create user feed item - SECURED
     */
    createUserFeedItem(user, index) {
        console.log('👥 [createUserFeedItem] Creating feed item for:', {
            index,
            userName: user.name,
            userId: user.uid || user.id
        });
        
        // Sanitize user data FIRST
        const safeName = sanitizeText(user.name || 'User');
        const safeBio = sanitizeText(user.bio || 'No bio');
        const safeAge = parseInt(user.age) || 25;
        
        // Define userId BEFORE using it
        const userId = user.uid || user.id || `demo_${safeName.toLowerCase().replace(/\s/g, '_')}`;
        
        // Now create the element with userId available
        const feedItem = document.createElement('div');
        feedItem.className = 'user-feed-item';
        feedItem.style.animationDelay = `${index * 0.1}s`;
        feedItem.style.cursor = 'pointer';
        feedItem.dataset.userId = userId; // ✅ Safe: data attribute
        
        const userWithId = {
            ...user,
            uid: userId,
            id: userId,
            name: safeName,
            bio: safeBio,
            age: safeAge
        };
        
        feedItem.addEventListener('click', (e) => {
            if (!e.target.closest('.user-actions')) {
                window.CLASSIFIED.openUserProfile(userWithId);
            }
        });
        
        // ✨ OPTIMIZED: Use medium size (800x800) for user card image
        const userPhoto = user.image || user.photos?.[0] || '';
        const optimizedImageUrl = getOptimizedImageURL(userPhoto, 'medium');
        
        console.log('🖼️ [USER-FEED] User card image:', {
            userName: safeName,
            photoFormat: typeof userPhoto,
            optimizedUrl: optimizedImageUrl.substring(0, 50) + '...'
        });
        
        // Build HTML safely - only using sanitized data
        feedItem.innerHTML = `
            <div class="user-status-badges">
                ${user.isOnline ? '<div class="status-badge status-online">🟢 Online</div>' : ''}
                <div class="status-badge status-distance">📍 ${escapeHtml(user.distance)}</div>
                <div class="status-badge status-match">🔥 ${parseInt(user.matchPercentage) || 75}% Match</div>
            </div>
            <div class="user-image" style="background-image: url('${escapeHtml(optimizedImageUrl)}')">
                <div class="user-image-overlay">
                    <div class="user-name">${escapeHtml(safeName)}, ${safeAge}</div>
                </div>
            </div>
            <div class="user-info">
                <div class="user-bio">${escapeHtml(safeBio)}</div>
                <div class="user-interests">
                    ${(user.interests || []).map(interest => 
                        `<span class="interest-tag">${escapeHtml(sanitizeText(interest))}</span>`
                    ).join('')}
                </div>
                <div class="user-actions">
                    <button class="action-btn pass-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('pass', '${userId}')">
                        <span>✕</span> Pass
                    </button>
                    <button class="action-btn like-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('like', '${userId}')">
                        <span>💬</span> Chat
                    </button>
                </div>
            </div>
        `;
        
        console.log('✅ [createUserFeedItem] Feed item created successfully');
        return feedItem;
    }
    
 /**
     * Filter users by category
     */
    filterUsers(filter) {
        console.log('👥 [filterUsers] Filtering users by:', filter);
        
        this.currentUserFilter = filter;
        
        // Update active filter chip
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
        
        // Use cached real users if available, otherwise mock data
        const sourceUsers = this.currentUsers.length > 0 ? this.currentUsers : this.mockData.getUsers();
        
        console.log('👥 [filterUsers] Filtering from:', {
            source: this.currentUsers.length > 0 ? 'Firebase' : 'Mock',
            totalUsers: sourceUsers.length
        });
        
        // Filter based on selection
        let filteredUsers;
        if (filter === 'online') {
            filteredUsers = sourceUsers.filter(u => u.isOnline);
        } else if (filter === 'nearby') {
            // Users within 5km
            filteredUsers = sourceUsers.filter(u => {
                const distance = parseInt(u.distance) || 999;
                return distance <= 5;
            });
        } else if (filter === 'nomads') {
            filteredUsers = sourceUsers.filter(u => u.category === 'nomads');
        } else {
            // 'all' filter
            filteredUsers = sourceUsers;
        }
        
        console.log('👥 [filterUsers] Filtered to', filteredUsers.length, 'users');
        
        // Re-populate feed
        const container = document.getElementById('userFeedContainer');
        if (!container) {
            console.warn('⚠️ [filterUsers] Container not found');
            return;
        }
        
        container.innerHTML = '';
        filteredUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
        
        console.log('✅ [filterUsers] Feed re-populated with filtered users');
    }
    
    /**
     * Show user feed error
     */
    showUserFeedError(container) {
        console.log('👥 [showUserFeedError] Displaying error message');
        
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; opacity: 0.7;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <div style="font-size: 18px; margin-bottom: 10px;">Unable to load users</div>
                <div style="font-size: 14px;">Please check your internet connection and try again.</div>
                <button onclick="CLASSIFIED.populateUserFeed()" style="margin-top: 20px; padding: 12px 24px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 25px; color: white; cursor: pointer;">
                    Try Again
                </button>
            </div>
        `;
    }
    
   /**
     * Show demo data for guest mode
     */
    async showDemoData() {
        console.log('👥 [showDemoData] Loading demo user data for guest mode...');
        this.populateGuestUserFeed();
    }
    
    /**
     * Show loading spinner while loading next page
     */
    showLoadingSpinner(container, sentinel, feedType) {
        console.log(`📄 [UserFeedManager] Showing loading spinner for ${feedType}`);
        
        // Remove any existing spinner
        const existingSpinner = container.querySelector('.pagination-loading');
        if (existingSpinner) existingSpinner.remove();
        
        const spinner = document.createElement('div');
        spinner.className = 'pagination-loading';
        spinner.style.cssText = 'text-align: center; padding: 20px; margin: 20px 0;';
        spinner.innerHTML = `
            <div class="spinner-container">
                <div class="spinner" style="width: 40px; height: 40px; border: 4px solid rgba(0, 212, 255, 0.2); border-top-color: #00D4FF; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <p style="margin-top: 10px; color: #888; font-size: 14px;">Loading more ${feedType}...</p>
            </div>
        `;
        
        // Insert before sentinel
        sentinel.insertAdjacentElement('beforebegin', spinner);
    }
    
    /**
     * Hide loading spinner
     */
    hideLoadingSpinner(container) {
        const spinner = container.querySelector('.pagination-loading');
        if (spinner) {
            console.log('📄 [UserFeedManager] Hiding loading spinner');
            spinner.remove();
        }
    }
}
