// javascript/features/feed/userFeed.js

import { sanitizeText, escapeHtml, createSafeElement } from '../../utils/security.js';

import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

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
        
        console.log('👥 [fetchUsersFromFirebase] Filtering:', {
            totalFromFirebase: snapshot.size,
            likedCount: likedUsers.size,
            passedCount: passedUsers.size
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
                passedUsers.has(docId)) {
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
     * Get liked users from localStorage
     */
    getLikedUsers() {
        try {
            const stored = localStorage.getItem('likedUsers');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (error) {
            console.error('❌ [getLikedUsers] Error:', error);
            return new Set();
        }
    }
    
    /**
     * Get passed users from localStorage  
     */
    getPassedUsers() {
        try {
            const stored = localStorage.getItem('passedUsers');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (error) {
            console.error('❌ [getPassedUsers] Error:', error);
            return new Set();
        }
    }
    
    /**
     * Populate user feed with data
     */
    populateUserFeedWithData(users, container) {
        console.log('👥 [populateUserFeedWithData] Populating with', users.length, 'users');
        
        container.innerHTML = '';
        
        users.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
        
        // Add activity indicator
        const activityIndicator = document.createElement('div');
        activityIndicator.innerHTML = `
            <div style="text-align: center; padding: 20px; background: rgba(0,212,255,0.1); margin: 20px 0; border-radius: 15px;">
                <h3>🔥 ${users.length} travelers active in Hoi An</h3>
                <p>Join the community and start connecting!</p>
            </div>
        `;
        container.appendChild(activityIndicator);
        
        console.log('✅ [populateUserFeedWithData] Feed populated successfully');
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
        demoUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
        
        // Show encouraging message
        const encourageMessage = document.createElement('div');
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
        
        console.log('✅ [populateDemoUserFeed] Demo feed displayed');
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
        
        // Add guest mode banner at top
        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 15px 20px; border-radius: 15px; margin-bottom: 20px; text-align: center; color: white; font-weight: 500; font-size: 14px;">
                🔒 Browsing as guest. Some features may be limited.
            </div>
        `;
        
        // Show first 3-5 users to guests with blur + CTA
        const guestUsers = this.mockData.getUsers().slice(0, 5);
        guestUsers.forEach((user, index) => {
            const feedItem = this.createGuestUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
        
        // Add signup encouragement card
        const signupCard = document.createElement('div');
        signupCard.innerHTML = `
            <div style="background: linear-gradient(135deg, #00D4FF, #0099CC); padding: 35px 25px; border-radius: 20px; text-align: center; margin: 25px 0; box-shadow: 0 8px 24px rgba(0, 212, 255, 0.3);">
                <div style="font-size: 40px; margin-bottom: 15px;">🎉</div>
                <h3 style="margin: 0 0 12px 0; font-size: 22px; color: white; font-weight: 600;">Invite Friends & Get Premium!</h3>
                <p style="margin: 0 0 20px 0; opacity: 0.95; color: white; font-size: 15px;">Both you and your friend get 1 week premium features</p>
                <button onclick="CLASSIFIED.showRegister()" style="background: rgba(255,255,255,0.95); border: none; padding: 14px 32px; border-radius: 25px; color: #0099CC; font-weight: 600; cursor: pointer; font-size: 16px; margin-right: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s ease;">
                    📱 Share App
                </button>
                <button onclick="CLASSIFIED.showLogin()" style="background: transparent; border: 2px solid rgba(255,255,255,0.9); padding: 12px 30px; border-radius: 25px; color: white; font-weight: 600; cursor: pointer; font-size: 16px; transition: all 0.3s ease;">
                    ⚡ My Code
                </button>
            </div>
        `;
        container.appendChild(signupCard);
        
        console.log('✅ [populateGuestUserFeed] Guest feed displayed with', guestUsers.length, 'blurred profiles');
    }
    
    /**
     * Create guest user feed item with blur + CTA (EXACT MATCH TO ORIGINAL DESIGN)
     */
    createGuestUserFeedItem(user, index) {
        console.log('👥 [createGuestUserFeedItem] Creating guest feed item for:', {
            index,
            userName: user.name,
            userId: user.uid || user.id
        });
        
        // Sanitize user data
        const safeName = sanitizeText(user.name || 'User');
        const safeBio = sanitizeText(user.bio || 'No bio');
        const safeAge = parseInt(user.age) || 25;
        const userId = user.uid || user.id || `demo_${safeName.toLowerCase().replace(/\s/g, '_')}`;
        
        // Create card wrapper
        const feedItem = document.createElement('div');
        feedItem.className = 'user-feed-item';
        feedItem.style.cssText = `
            animation: fadeInUp 0.6s ease forwards;
            animation-delay: ${index * 0.1}s;
            opacity: 0;
            margin-bottom: 20px;
            position: relative;
        `;
        
        // Guest Mode badge (yellow, top-left)
        const guestBadge = document.createElement('div');
        guestBadge.style.cssText = `
            position: absolute;
            top: 15px;
            left: 15px;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            color: #333;
            z-index: 5;
            box-shadow: 0 3px 10px rgba(255, 215, 0, 0.4);
        `;
        guestBadge.textContent = '🔒 Guest Mode';
        
        // Status badges (top-right)
        const statusBadges = document.createElement('div');
        statusBadges.className = 'user-status-badges';
        statusBadges.innerHTML = `
            ${user.isOnline ? '<div class="status-badge status-online">🟢 Online</div>' : ''}
            <div class="status-badge status-distance">📍 ${escapeHtml(user.distance)}</div>
            <div class="status-badge status-match">🔥 ${parseInt(user.matchPercentage) || 75}% Match</div>
        `;
        
        // User image container (BLURRED)
        const imageDiv = document.createElement('div');
        imageDiv.className = 'user-image';
        imageDiv.style.cssText = `
            background-image: url('${escapeHtml(user.image)}');
            filter: blur(12px);
            -webkit-filter: blur(12px);
        `;
        
        const imageOverlay = document.createElement('div');
        imageOverlay.className = 'user-image-overlay';
        imageOverlay.innerHTML = `
            <div class="user-name">${escapeHtml(safeName)}, ${safeAge}</div>
        `;
        imageDiv.appendChild(imageOverlay);
        
        // User info section (visible content)
        const infoDiv = document.createElement('div');
        infoDiv.className = 'user-info';
        
        const bioDiv = document.createElement('div');
        bioDiv.className = 'user-bio';
        bioDiv.textContent = safeBio;
        
        const interestsDiv = document.createElement('div');
        interestsDiv.className = 'user-interests';
        interestsDiv.innerHTML = (user.interests || []).slice(0, 3).map(interest => 
            `<span class="interest-tag">${escapeHtml(sanitizeText(interest))}</span>`
        ).join('');
        
        // YELLOW CTA BUTTON (Big, prominent)
        const ctaButton = document.createElement('button');
        ctaButton.style.cssText = `
            width: 100%;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            color: #000;
            font-weight: 700;
            font-size: 16px;
            cursor: pointer;
            margin-top: 15px;
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
            transition: all 0.3s ease;
        `;
        ctaButton.textContent = 'Sign Up to Connect';
        ctaButton.onclick = (e) => {
            e.stopPropagation();
            window.CLASSIFIED.showRegister();
        };
        
        // Add hover effect
        ctaButton.addEventListener('mouseenter', () => {
            ctaButton.style.transform = 'translateY(-2px)';
            ctaButton.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
        });
        ctaButton.addEventListener('mouseleave', () => {
            ctaButton.style.transform = 'translateY(0)';
            ctaButton.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)';
        });
        
        // Assemble card
        infoDiv.appendChild(bioDiv);
        infoDiv.appendChild(interestsDiv);
        infoDiv.appendChild(ctaButton);
        
        feedItem.appendChild(guestBadge);
        feedItem.appendChild(statusBadges);
        feedItem.appendChild(imageDiv);
        feedItem.appendChild(infoDiv);
        
        console.log('✅ [createGuestUserFeedItem] Guest feed item created successfully');
        return feedItem;
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
        
        // Build HTML safely - only using sanitized data
        feedItem.innerHTML = `
            <div class="user-status-badges">
                ${user.isOnline ? '<div class="status-badge status-online">🟢 Online</div>' : ''}
                <div class="status-badge status-distance">📍 ${escapeHtml(user.distance)}</div>
                <div class="status-badge status-match">🔥 ${parseInt(user.matchPercentage) || 75}% Match</div>
            </div>
            <div class="user-image" style="background-image: url('${escapeHtml(user.image)}')">
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
        
        // Get appropriate users based on filter
        let filteredUsers;
        if (filter === 'online') {
            filteredUsers = this.mockData.getOnlineUsers();
        } else if (filter === 'nearby') {
            filteredUsers = this.mockData.getNearbyUsers();
        } else if (filter === 'nomads') {
            filteredUsers = this.mockData.getUsersByCategory('nomads');
        } else {
            filteredUsers = this.mockData.getUsers();
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
}
