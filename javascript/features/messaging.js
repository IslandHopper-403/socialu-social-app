// javascript/features/messaging.js - COMPLETE VERSION 3.21

import { sanitizeMessage, sanitizeText, escapeHtml, sanitizeHtml } from '../utils/security.js';
import { handleSecurityError } from '../utils/security.js';

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    addDoc,
    updateDoc,
    writeBatch,
    arrayUnion,
    arrayRemove,
    increment,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import { BusinessMessagingManager } from './businessMessaging.js';

/**
 * Messaging Manager - COMPLETE VERSION
 * Handles all messaging and chat functionality
 */
export class MessagingManager {
   constructor(firebaseServices, appState) {
    this.auth = firebaseServices.auth;
    this.db = firebaseServices.db;
    this.state = appState;
    
    // References to other managers (set later)
    this.navigationManager = null;
    this.profileManager = null;
    this.mockData = null;
    
    // Real-time listeners
    this.activeListeners = new Map(); // Track ALL listeners with metadata
    // Business messaging handler
    this.businessMessaging = new BusinessMessagingManager(firebaseServices, appState, this);
    this.chatListeners = new Map();
    this.matchListener = null;
    this.notificationListener = null;
    this.globalMessageListener = null;
    
    // Current chat context
    this.currentChatId = null;
    this.currentChatPartner = null;
    
   // Keep unread messages for UI display only
    this.unreadMessages = new Map();
    this.loadUnreadStateFromStorage();
    this.isAppVisible = !document.hidden;
    this.isChatVisible = false; // Track if chat overlay is actually visible

    // FIXED: Track when messages were last seen per chat
    this.lastSeenTimestamps = new Map(); // chatId -> timestamp
    this.loadLastSeenTimestamps();
    
    // Track read receipts per message
    this.messageReadStates = new Map(); // messageId -> {read: boolean, readAt: timestamp}
    this.loadMessageReadStates();
    
    // FIXED: Track seen matches across sessions
    this.seenMatches = new Set(JSON.parse(localStorage.getItem('seenMatches') || '[]'));
    
    // FIXED: Better last active tracking
    this.lastAppActive = parseInt(localStorage.getItem('lastAppActive') || Date.now().toString(), 10);
    
    // FIXED: Track initial loads to prevent notifications
    this.initialLoadComplete = new Set();
    this.firstLoadTimestamp = Date.now(); // When THIS session started
    this.seenMatches = new Set(JSON.parse(localStorage.getItem('seenMatches') || '[]'));
       
      // ADDED: Track app visibility for smart notifications
    document.addEventListener('visibilitychange', () => {
        this.isAppVisible = !document.hidden;
        
        if (document.hidden) {
            // App going to background - save timestamp
            localStorage.setItem('lastAppActive', Date.now().toString());
            this.isChatVisible = false; // Chat can't be visible if app is hidden
        } else {
            // App coming to foreground - update timestamp
            this.lastAppActive = parseInt(localStorage.getItem('lastAppActive') || Date.now().toString(), 10);
            
            // Only mark as read if chat is actually open
            if (this.currentChatId && this.isChatVisible) {
                this.markCurrentChatAsRead();
                this.markAllMessagesAsRead(this.currentChatId);
            }
        }
    });
       // Add this line to track seen matches across sessions
       this.seenMatches = new Set(JSON.parse(localStorage.getItem('seenMatches') || '[]'));

    window.addEventListener('beforeunload', () => {
        this.cleanup();
    });
    
    // Auto-cleanup stale listeners every 5 minutes
    this.listenerCleanupInterval = setInterval(() => {
        this.cleanupStaleListeners();
    }, 300000); // 5 minutes
}

/**
     * Load last seen timestamps from localStorage
     */
    loadLastSeenTimestamps() {
        try {
            const saved = localStorage.getItem('lastSeenTimestamps');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([chatId, timestamp]) => {
                    this.lastSeenTimestamps.set(chatId, timestamp);
                });
            }
        } catch (error) {
            console.error('Error loading last seen timestamps:', error);
        }
    }

    /**
     * Save last seen timestamps to localStorage
     */
    saveLastSeenTimestamps() {
        try {
            const toSave = {};
            this.lastSeenTimestamps.forEach((timestamp, chatId) => {
                toSave[chatId] = timestamp;
            });
            localStorage.setItem('lastSeenTimestamps', JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving last seen timestamps:', error);
        }
    }
    
    /**
     * Load message read states from localStorage
     */
    loadMessageReadStates() {
        try {
            const saved = localStorage.getItem('messageReadStates');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([messageId, state]) => {
                    this.messageReadStates.set(messageId, state);
                });
            }
        } catch (error) {
            console.error('Error loading message read states:', error);
        }
    }
    
    /**
     * Save message read states to localStorage
     */
    saveMessageReadStates() {
        try {
            const toSave = {};
            // Only save last 100 message states to prevent localStorage bloat
            const entries = Array.from(this.messageReadStates.entries()).slice(-100);
            entries.forEach(([messageId, state]) => {
                toSave[messageId] = state;
            });
            localStorage.setItem('messageReadStates', JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving message read states:', error);
        }
    }

        /**
         * Register a listener with tracking
         */
        registerListener(id, unsubscribe, type = 'generic') {
            if (this.activeListeners.has(id)) {
                console.warn(`⚠️ Replacing existing listener: ${id}`);
                const existing = this.activeListeners.get(id);
                existing.unsubscribe();
            }
            
            this.activeListeners.set(id, {
                unsubscribe,
                type,
                createdAt: Date.now()
            });
            
            console.log(`📌 Registered listener: ${id} (${type})`);
        }
        
        /**
         * Unregister a specific listener
         */
        unregisterListener(id) {
            const listener = this.activeListeners.get(id);
            if (listener) {
                try {
                    listener.unsubscribe();
                    this.activeListeners.delete(id);
                    console.log(`🗑️ Unregistered listener: ${id}`);
                } catch (error) {
                    console.error(`Error unregistering listener ${id}:`, error);
                }
            }
        }

    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
        
        // Get mock data reference from app
        if (window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
        }
    }
    
    /**
     * Initialize messaging system
     */

    async init() {
        console.log('💬 Initializing messaging manager...');
        
        // Clean up old data on startup
        this.cleanupOldMatchTimestamps();
        
        // Set up event listeners
        this.setupEventListeners();

        // Load initial data if authenticated or in guest mode
        if (this.state.get('isAuthenticated')) {
            try {
                await this.loadMatches();
                await this.loadChats();
                this.setupRealtimeListeners();
            } catch (error) {
                console.error('Error initializing messaging:', error);
            }
        } else if (this.state.get('isGuestMode')) { // ADD THIS BLOCK
            console.log('📝 Guest mode active, showing demo chats');
            this.showDemoOnlineUsers(); // ADD THIS LINE
            this.showDemoChats();
        }
    }


    /**
     * Initialize messaging in business mode
     */
    initBusinessMode() {
        console.log('💬 Initializing business messaging mode');
        
        // Set business mode flag
        this.isBusinessMode = true;
        
        // Load business messages only
        this.loadBusinessMessages();
        
        // Set up business-specific listeners
        this.setupBusinessMessageListeners();
    }
    
    /**
     * Load business messages (customer inquiries)
     */
    async loadBusinessMessages() {
        const user = this.state.get('currentUser');
        if (!user) return;
        
        try {
            // Query for chats where business is a participant
            const chatsQuery = query(
                collection(this.db, 'chats'),
                where('participants', 'array-contains', user.uid)
            );
            
            const snapshot = await getDocs(chatsQuery);
            const messages = [];
            
            for (const doc of snapshot.docs) {
                const chatData = doc.data();
                const otherUserId = chatData.participants.find(id => id !== user.uid);
                
                // Get other user's data
                const userDoc = await getDoc(doc(this.db, 'users', otherUserId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    messages.push({
                        chatId: doc.id,
                        userId: otherUserId,
                        userName: userData.name || 'Customer',
                        lastMessage: chatData.lastMessage || 'New inquiry',
                        timestamp: chatData.lastMessageTime,
                        unread: chatData.unreadCount?.[user.uid] || 0
                    });
                }
            }
            
            // Update business messages list
            this.updateBusinessMessagesList(messages);
            
        } catch (error) {
            console.error('Error loading business messages:', error);
        }
    }
    
    /**
     * Set up business message listeners
     */
    setupBusinessMessageListeners() {
        const user = this.state.get('currentUser');
        if (!user) return;
        
        try {
            // Listen for new messages in business chats
            const chatsQuery = query(
                collection(this.db, 'chats'),
                where('participants', 'array-contains', user.uid)
            );
            
            const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
                console.log('📬 Business messages updated');
                this.loadBusinessMessages();
            });
            
            // SECURITY: Track listener for cleanup
            this.registerListener(`business_messages_${user.uid}`, unsubscribe, 'business');
            
            // Store reference for cleanup
            if (this.businessManager) {
                this.businessManager.businessMessageListener = unsubscribe;
            }
            
        } catch (error) {
            console.error('Error setting up business message listeners:', error);
        }
    }
    
   /**
     * Set up business message listeners
     */
    setupBusinessMessageListeners() {
        const user = this.state.get('currentUser');
        if (!user) return;
        
        try {
            // Listen for new messages in business chats
            const chatsQuery = query(
                collection(this.db, 'chats'),
                where('participants', 'array-contains', user.uid)
            );
            
            const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
                console.log('📬 Business messages updated');
                this.loadBusinessMessages();
            });
            
            // SECURITY: Track listener for cleanup
            this.registerListener(`business_messages_${user.uid}`, unsubscribe, 'business');
            
            // Store reference for cleanup
            if (this.businessManager) {
                this.businessManager.businessMessageListener = unsubscribe;
            }
            
        } catch (error) {
            console.error('Error setting up business message listeners:', error);
        }
    }
    
    /**
     * Update business messages list in dashboard
     */
    updateBusinessMessagesList(messages) {
        const container = document.getElementById('businessMessagesList');
        const emptyState = document.getElementById('businessMessagesEmpty');
        
        if (!container) return;
        
        if (messages.length === 0) {
            container.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        
        // Clear and populate - SAFE
        container.innerHTML = '';
        
        messages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = 'message-item' + (msg.unread > 0 ? ' unread' : '');
            messageEl.setAttribute('data-message-id', sanitizeText(msg.chatId));
            
            // Create elements safely
            const avatarEl = document.createElement('div');
            avatarEl.className = 'customer-avatar';
            avatarEl.textContent = '👤';
            
            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            
            const headerEl = document.createElement('div');
            headerEl.className = 'message-header';
            
            const nameEl = document.createElement('span');
            nameEl.className = 'customer-name';
            nameEl.textContent = sanitizeText(msg.userName);
            
            const timeEl = document.createElement('span');
            timeEl.className = 'message-time';
            timeEl.textContent = this.formatMessageTime(msg.timestamp);
            
            const previewEl = document.createElement('div');
            previewEl.className = 'message-preview';
            previewEl.textContent = sanitizeText(msg.lastMessage);
            
            // Assemble elements
            headerEl.appendChild(nameEl);
            headerEl.appendChild(timeEl);
            contentEl.appendChild(headerEl);
            contentEl.appendChild(previewEl);
            
            messageEl.appendChild(avatarEl);
            messageEl.appendChild(contentEl);
            
            // Add click handler
            messageEl.onclick = () => {
                this.openBusinessChat(msg.userId, msg.userName, msg.chatId);
            };
            
            container.appendChild(messageEl);
        });
        
        // Update message count
        const totalUnread = messages.reduce((sum, msg) => sum + msg.unread, 0);
        const countEl = document.getElementById('businessMessagesCount');
        if (countEl) {
            countEl.textContent = totalUnread.toString();
        }
    }
    
    /**
     * Open chat in business context
     */
    openBusinessChat(userId, userName, chatId) {
        // SECURITY: Validate userId
        if (!userId || typeof userId !== 'string') {
            console.error('Invalid userId for business chat');
            return;
        }
        
        // SECURITY: Sanitize userId to prevent injection
        const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
        
        console.log('💬 Opening business chat with:', userName);
        
        // Set business chat context
        this.currentChatContext = 'business';
        
        // Open chat with business-specific UI (use safe ID)
        this.openChat(userName, '👤', safeUserId);
        
        // Hide favorites button in business chat
        const favBtn = document.querySelector('#individualChat .chat-input button');
        if (favBtn) favBtn.style.display = 'none';
    }


    /**
     * Display mock chats for guest mode
     */
    showDemoOnlineUsers() {
        // Make sure you have the mock data
        if (!this.mockData && window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
        }
    
        const onlineUsers = this.mockData ? this.mockData.getOnlineUsers() : [];
        const onlineUsersContainer = document.getElementById('matchesScroll');
    
        if (onlineUsersContainer && onlineUsers.length > 0) {
            onlineUsersContainer.innerHTML = onlineUsers.map(user => `
                <div class="online-user" onclick="CLASSIFIED.openChatWithUser('${user.name}')">
                    <div class="match-avatar" style="background-image: url('${user.image}')"></div>
                    <div class="online-user-name" style="text-align: center;">${user.name}</div>
                </div>
            `).join('');
        } else if (onlineUsersContainer) {
            onlineUsersContainer.innerHTML = '<p>No online users available.</p>';
        }
    }
    
    showDemoChats() {
        const chats = this.mockData ? this.mockData.getChats() : [];
        if (chats.length > 0) {
            this.populateChatList(chats);
        } else {
            console.warn('❌ Mock chat data is not available.');
            // Optional: Display a message to the user
            this.showEmptyChatState('No demo chats available.');
        }
    }


    /**
     * Populate the chat list with provided data
     */
   populateChatList(chats) {
        const chatListContainer = document.getElementById('chatList');
        if (!chatListContainer) return;

        chatListContainer.innerHTML = chats.map(chat => {
            // Escape quotes for onclick attribute
            const safeName = chat.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const safeAvatar = chat.avatar.replace(/'/g, "\\'");
            
            return `
                <div class="chat-item" onclick="CLASSIFIED.openChat('${safeName}', '${safeAvatar}', '${chat.userId}')">
                    <div class="chat-avatar" style="background-image: url('${chat.avatar}')"></div>
                    <div class="chat-details">
                        <div class="chat-name">${sanitizeText(chat.name)}</div>
                        <div class="chat-last-message">${sanitizeText(chat.message)}</div>
                    </div>
                    <div class="chat-meta">
                        <div class="chat-time">${chat.time}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        try {
            if ('Notification' in window && Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                console.log('🔔 Notification permission:', permission);
            }
        } catch (error) {
            console.log('Could not request notification permission:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Only set up once
        if (this.eventListenersSetup) return;
        this.eventListenersSetup = true;
        
        // Send button
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        // Enter key to send
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }
    
    /**
     * Set up real-time listeners
     */
    setupRealtimeListeners() {
        const currentUser = this.state.get('currentUser');
       
        
        console.log('👂 Setting up real-time listeners for user:', currentUser.uid);
        
        try {
            // Listen for new matches
            this.listenForMatches(currentUser.uid);
            
            // Listen for chat updates
            this.listenForChatUpdates(currentUser.uid);
            
            // Listen for new messages (global)
            this.listenForNewMessages(currentUser.uid);
        } catch (error) {
            console.error('Error setting up real-time listeners:', error);
        }
    }
    
    /**
     * Load user matches
     */
    async loadMatches() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            console.log('👥 Loading matches for user:', currentUser.uid);
            
            const matchesContainer = document.getElementById('matchesScroll');
            if (!matchesContainer) return;
            
            // Try to load real matches from Firebase first
            const realMatches = await this.loadRealMatches(currentUser.uid);
            
            if (realMatches.length > 0) {
                console.log(`✅ Found ${realMatches.length} real matches`);
                matchesContainer.innerHTML = realMatches.map(match => `
                    <div class="match-avatar" 
                         style="background-image: url('${match.avatar}')"
                         onclick="CLASSIFIED.openChat('${match.name}', '${match.avatar}', '${match.userId}')">
                    </div>
                `).join('');
            } else {
                // Fallback to demo matches
                console.log('📝 No real matches found, showing demo matches');
                const matches = this.mockData ? this.mockData.getUsers().slice(0, 5) : [];
                
                matchesContainer.innerHTML = matches.map(user => `
                    <div class="match-avatar" 
                         style="background-image: url('${user.image}')"
                         onclick="CLASSIFIED.openChat('${user.name}', '${user.image}', '${user.uid}')">
                    </div>
                `).join('');
            }
            
        } catch (error) {
            console.error('❌ Error loading matches:', error);
        }
    }
    
    /**
     * Load real matches from Firebase
     */
    async loadRealMatches(userId) {
        const matches = [];
        
        try {
            // Query matches where current user is involved
            const q = query(
                collection(this.db, 'matches'),
                where('users', 'array-contains', userId),
                limit(10)
            );
            
            const snapshot = await getDocs(q);
            
            for (const matchDoc of snapshot.docs) {
                const matchData = matchDoc.data();
                const partnerId = matchData.users.find(id => id !== userId);
                
                if (partnerId) {
                    try {
                        // Get partner info
                        const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
                        if (partnerDoc.exists()) {
                            const partnerData = partnerDoc.data();
                            matches.push({
                                userId: partnerId,
                                name: partnerData.name,
                                avatar: partnerData.photos?.[0] || partnerData.photo || 'https://via.placeholder.com/100'
                            });
                        }
                    } catch (error) {
                        console.error('Error getting match partner data:', error);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error loading real matches:', error);
        }
        
        return matches;
    }
    
           /**
         * Load chat list - UNIFIED INBOX (social + business chats)
         */
        async loadChats() {
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            try {
                console.log('💬 Loading UNIFIED chats for user:', currentUser.uid);
                
                const chatList = document.getElementById('chatList');
                if (!chatList) return;
                
                // Load both social and business chats
                const socialChats = await this.loadRealChats(currentUser.uid);
                const businessChats = await this.loadBusinessConversations(currentUser.uid);
                
                // Merge and sort by time
                const allChats = [...socialChats, ...businessChats];
                allChats.sort((a, b) => {
                    const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
                    const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
                    return timeB - timeA;
                });
                
                console.log(`📊 Unified inbox: ${socialChats.length} social + ${businessChats.length} business = ${allChats.length} total`);
                
                // Display unified list
                if (allChats.length > 0) {
                    this.displayUnifiedChats(allChats);
                }
                
        // Show demo chats if no real chats exist
        if (allChats.length === 0) {
            const chats = this.mockData ? this.mockData.getChats() : [];
            const existingChats = chatList.querySelectorAll('.chat-item');
            if (existingChats.length === 0) {
                console.log('📝 No real chats found, showing demo chats');
                chatList.innerHTML = chats.map(chat => `
                    <div class="chat-item" onclick="CLASSIFIED.openChat('${chat.name}', '${chat.avatar}', '${chat.userId}')">
                        <div class="chat-avatar" style="background-image: url('${chat.avatar}')"></div>
                        <div class="chat-info">
                            <div class="chat-name">${chat.name}</div>
                            <div class="chat-message">${chat.message}</div>
                        </div>
                        <div class="chat-time">${chat.time}</div>
                    </div>
                `).join('');
            }
            
        } catch (error) {
            console.error('❌ Error loading chats:', error);
        }
    }
    
    /**
     * Load real chats from Firebase
     */
    async loadRealChats(userId) {
        try {
            console.log('🔍 Querying chats for user:', userId);
            
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId),
                limit(20)
            );
            
            const snapshot = await getDocs(q);
            console.log(`📊 Found ${snapshot.size} chats`);
            
            const realChats = [];
            
                        for (const chatDoc of snapshot.docs) {
            const chatData = chatDoc.data();
            const partnerId = chatData.participants.find(id => id !== userId);
            
            if (partnerId) {
                try {
                    // Get partner info
                    const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
                    if (partnerDoc.exists()) {
                        const partnerData = partnerDoc.data();
                        
                 // Check unread status - use lastAppActive as the cutoff
                const seenTime = localStorage.getItem(`seen_${chatDoc.id}_${userId}`);
                const messageTime = chatData.lastMessageTime?.toMillis?.() || 0;
                
                // It's unread if: message is from other user AND newer than last app active AND not seen
                const hasUnread = chatData.lastMessageSender && 
                     chatData.lastMessageSender !== userId &&
                     messageTime > this.lastAppActive &&
                     (!seenTime || messageTime > parseInt(seenTime));
                        
                        realChats.push({
                            id: chatDoc.id,
                            partnerId: partnerId,
                            partnerName: partnerData.name,
                            partnerAvatar: partnerData.photos?.[0] || partnerData.photo || 'https://via.placeholder.com/100',
                            lastMessage: chatData.lastMessage || 'No messages yet',
                            lastMessageTime: chatData.lastMessageTime,
                            lastMessageSender: chatData.lastMessageSender,
                            isNew: !chatData.lastMessage,
                            hasUnread: hasUnread
                        });
                        
                        // Initialize unread count if needed
                        if (hasUnread && !this.unreadMessages.has(chatDoc.id)) {
                            this.unreadMessages.set(chatDoc.id, 1);
                        }
                    }
                } catch (error) {
                    console.error('Error getting partner data:', error);
                }
            }
        }
                    
          return realChats; // CHANGED: Return data instead of updating UI
        
            } catch (error) {
                if (error.code?.includes('permission')) {
                    handleSecurityError(error);
                }
                console.error('❌ Error loading real chats:', error);
                return []; // Return empty array on error
            }
        }


    /**
 * Load business conversations for unified inbox
 */
async loadBusinessConversations(userId) {
    try {
        console.log('🏪 Loading business conversations for user:', userId);
        
        const businessChatsRef = collection(this.db, 'businessConversations');
        const q = query(
            businessChatsRef,
            where('userId', '==', userId),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        console.log(`📊 Found ${snapshot.size} business conversations`);
        
        const businessChats = [];
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            businessChats.push({
                id: doc.id,
                type: 'business', // Mark as business chat
                partnerId: data.businessId,
                partnerName: data.businessName || 'Business',
                partnerAvatar: '🏪', // Business emoji
                lastMessage: data.lastMessage || 'Business inquiry',
                lastMessageTime: data.lastMessageTime,
                lastMessageSender: data.lastMessageSender,
                hasUnread: (data.userUnread || 0) > 0,
                unreadCount: data.userUnread || 0
            });
        }
        
        return businessChats;
        
    } catch (error) {
        console.error('❌ Error loading business conversations:', error);
        return [];
    }
}


    /**
 * Display unified chat list (social + business)
 */
displayUnifiedChats(chats) {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;
    
    console.log('🔄 Displaying', chats.length, 'unified chats');
    
    chatList.innerHTML = chats.map(chat => {
        const timeAgo = chat.lastMessageTime ? this.getTimeAgo(chat.lastMessageTime) : 'New';
        const unreadCount = chat.hasUnread ? (chat.unreadCount || 1) : 0;
        
        if (chat.type === 'business') {
            // Business chat item
            return `
                <div class="chat-item business-chat" data-chat-id="${chat.id}" onclick="window.classifiedApp.managers.messaging.businessMessaging.openBusinessChat('${chat.partnerId}', '${chat.id}')">
                    <div class="chat-avatar" style="font-size: 28px; display: flex; align-items: center; justify-content: center;">${chat.partnerAvatar}</div>
                    <div class="chat-info">
                        <div class="chat-name">${chat.partnerName} <span class="business-badge">Business</span></div>
                        <div class="chat-message" ${unreadCount > 0 ? 'style="font-weight: 600;"' : ''}>${chat.lastMessage}</div>
                    </div>
                    <div class="chat-time">${timeAgo}</div>
                    ${unreadCount > 0 ? `<div class="chat-unread-count">${unreadCount > 9 ? '9+' : unreadCount}</div>` : ''}
                </div>
            `;
        } else {
            // Social chat item (existing format)
            return `
                <div class="chat-item" data-chat-id="${chat.id}" onclick="CLASSIFIED.openChat('${chat.partnerName}', '${chat.partnerAvatar}', '${chat.partnerId}')">
                    <div class="chat-avatar" style="background-image: url('${chat.partnerAvatar}')"></div>
                    <div class="chat-info">
                        <div class="chat-name">${chat.partnerName}</div>
                        <div class="chat-message" ${unreadCount > 0 ? 'style="font-weight: 600;"' : ''}>${chat.lastMessage}</div>
                    </div>
                    <div class="chat-time">${timeAgo}</div>
                    ${unreadCount > 0 ? `<div class="chat-unread-count">${unreadCount > 9 ? '9+' : unreadCount}</div>` : ''}
                </div>
            `;
        }
    }).join('');
}
    
    /**
     * Update chat list UI
     */
 updateChatList(chats) {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;
    
    console.log('🔄 Updating chat list with', chats.length, 'chats');
    
    // Sort chats by last message time (newest first) and unread status
    chats.sort((a, b) => {
        // First priority: unread messages
        const aUnread = this.unreadMessages.get(a.id) || 0;
        const bUnread = this.unreadMessages.get(b.id) || 0;
        
        if (aUnread > 0 && bUnread === 0) return -1;
        if (bUnread > 0 && aUnread === 0) return 1;
        
        // Second priority: last message time
        const aTime = a.lastMessageTime?.toDate?.() || new Date(0);
        const bTime = b.lastMessageTime?.toDate?.() || new Date(0);
        return bTime - aTime;
    });
    
    chatList.innerHTML = chats.map(chat => {
        const timeAgo = chat.lastMessageTime ? this.getTimeAgo(chat.lastMessageTime) : 'New';
        const messageText = chat.isNew ? 'Start a conversation!' : chat.lastMessage;
        const unreadCount = this.unreadMessages.get(chat.id) || 0;
        
        return `
            <div class="chat-item" data-chat-id="${chat.id}" onclick="CLASSIFIED.openChat('${chat.partnerName}', '${chat.partnerAvatar}', '${chat.partnerId}')">
                <div class="chat-avatar" style="background-image: url('${chat.partnerAvatar}')"></div>
                <div class="chat-info">
                    <div class="chat-name">${chat.partnerName}</div>
                    <div class="chat-message" ${unreadCount > 0 ? 'style="font-weight: 600;"' : ''}>${messageText}</div>
                </div>
                <div class="chat-time">${timeAgo}</div>
                ${unreadCount > 0 ? `<div class="chat-unread-count">${unreadCount > 9 ? '9+' : unreadCount}</div>` : ''}
            </div>
        `;
    }).join('');
}
    
    /**
     * Open chat with user
     */
    async openChat(name, avatar, userId) {
    console.log(`💬 Opening chat with ${name} (${userId})`);
    
    const currentUser = this.state.get('currentUser');
    if (!currentUser) {
        alert('Please login to chat');
        return;
    }
    
    try {
        // Check if this is a business chat
        const chatType = this.state.get('currentChatType');
        
        // Update UI immediately for better UX
        document.getElementById('chatName').textContent = name;
        
        // FIXED: Don't override avatar if business chat already set it
        if (chatType !== 'business') {
            document.getElementById('chatAvatar').style.backgroundImage = `url('${avatar}')`;
        }
            
            // Store current chat context
            this.currentChatPartner = { name, avatar, userId };
            this.state.set('currentChatUser', this.currentChatPartner);


            // Generate chat ID (alphabetically sorted user IDs)
            const chatId = this.generateChatId(currentUser.uid, userId);
            this.currentChatId = chatId;
            this.markChatAsRead(chatId);
            
            document.dispatchEvent(new CustomEvent('chatOpened', { 
                detail: { chatId: chatId, partnerId: userId }
            }));


            // Mark this chat as seen IMMEDIATELY
            this.unreadMessages.set(chatId, 0);
            localStorage.setItem(`seen_${chatId}_${currentUser.uid}`, Date.now().toString());
            this.saveUnreadStateToStorage();
            this.updateTotalUnreadCount();
            this.updateChatListUnreadIndicators();
            
            // Also remove the red dot from the specific chat item
            const chatItems = document.querySelectorAll('.chat-item');
            chatItems.forEach(item => {
                if (item.dataset.chatId === chatId) {
                    const indicator = item.querySelector('.chat-unread-count, .chat-unread-dot');
                    if (indicator) indicator.remove();
                }
            });
            
            console.log('💬 Chat ID:', chatId);
            
           // Show chat screen
            this.navigationManager.showOverlay('individualChat');
            this.isChatVisible = true; // Track that chat is now visible
            
            // Load chat messages
            await this.loadChatMessages(chatId);
            
            // Set up real-time listener for this chat
            this.listenToChatMessages(chatId);
            
            // Create chat document if it doesn't exist
            await this.ensureChatExists(chatId, currentUser.uid, userId);
        } catch (error) {
            console.error('Error opening chat:', error);
            alert('Failed to open chat. Please try again.');
        }
    }
    
    /**
     * Ensure chat document exists
     */
    async ensureChatExists(chatId, userId1, userId2) {
        try {
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            
            if (!chatDoc.exists()) {
                console.log('📝 Creating new chat document');
                await setDoc(doc(this.db, 'chats', chatId), {
                    participants: [userId1, userId2],
                    createdAt: serverTimestamp(),
                    lastMessage: '',
                    lastMessageTime: serverTimestamp(),
                    lastMessageSender: null
                });
            }
        } catch (error) {
            console.error('Error ensuring chat exists:', error);
        }
    }

/**
 * Cleanup chat state (called by navigation manager)
 */
closeChat() {
    console.log('🧹 Messaging cleanup');
    
    if (this.currentChatId) {
        this.markChatAsRead(this.currentChatId);
        this.markAllMessagesAsRead(this.currentChatId);
        this.unregisterListener(`chat_${this.currentChatId}`);
    }
    
    // Clear ALL chat-related state
    this.currentChatId = null;
    this.currentChatPartner = null;
    this.isChatVisible = false;
    this.state.set('currentChatUser', null);
    this.state.set('chatOpenedFrom', null);
    this.state.set('currentChatType', null);
    this.state.set('currentBusinessConversationId', null);
    this.state.set('currentChatBusinessId', null);
}
    
      /**
     * Send message with proper sanitization
     */
    async sendMessage() {
        // SECURITY: Check if this is a business chat
        const chatType = this.state.get('currentChatType');
        if (chatType === 'business') {
            return this.sendBusinessMessage();
        }
        
        const messageInput = document.getElementById('messageInput');
        const rawMessage = messageInput.value.trim();
        
        if (!rawMessage) return;
        
        const currentUser = this.state.get('currentUser');
        if (!currentUser || !this.currentChatId || !this.currentChatPartner) {
            alert('Unable to send message. Please try again.');
            return;
        }
        
        try {
            console.log('📤 Sending message (sanitized)');
            
            // Clear input immediately
            messageInput.value = '';
            
            // Sanitize message data
            const messageData = sanitizeMessage({
                text: rawMessage,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                timestamp: new Date(),
                read: false
            });
            
            // Add message to UI immediately (optimistic update)
            this.addMessageToUI(messageData, true);
            
            // Save to Firestore with server timestamp
            await addDoc(collection(this.db, 'chats', this.currentChatId, 'messages'), {
                ...messageData,
                timestamp: serverTimestamp()
            });
            
            // Update chat document
            await updateDoc(doc(this.db, 'chats', this.currentChatId), {
                lastMessage: messageData.text,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: currentUser.uid
            });
            
            console.log('✅ Message sent successfully');
            
            // Send notification to other user
            this.sendNotificationToUser(this.currentChatPartner.userId, {
                title: `New message from ${currentUser.displayName || 'Someone'}`,
                body: messageData.text,
                data: {
                    type: 'message',
                    chatId: this.currentChatId,
                    senderId: currentUser.uid
                }
            });
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            alert('Failed to send message. Please try again.');
            messageInput.value = rawMessage; // Restore message on error
            
            // Remove optimistic message
            const messagesContainer = document.getElementById('chatMessages');
            const lastMessage = messagesContainer?.lastElementChild;
            if (lastMessage?.classList.contains('optimistic')) {
                lastMessage.remove();
            }
        }
    }

    /**
     * Delegate to business messaging
     */
    startBusinessConversation(businessId) {
        return this.businessMessaging.startBusinessConversation(businessId);
    }
    
    sendBusinessMessage() {
        return this.businessMessaging.sendBusinessMessage();
    }
    
    /**
     * Add message to UI with sanitization
     */
    addMessageToUI(messageData, isOptimistic = false) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const currentUser = this.state.get('currentUser');
        const isSent = messageData.senderId === currentUser?.uid;
        const timeStr = messageData.timestamp ? this.formatMessageTime(messageData.timestamp) : 'Sending...';
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}${isOptimistic ? ' optimistic' : ''}`;
        
        // Create message bubble safely
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.textContent = messageData.text; // Safe - uses textContent
        
        messageElement.appendChild(messageBubble);
        
       if (timeStr) {
            const timeElement = document.createElement('div');
            timeElement.className = 'message-time';
            timeElement.textContent = timeStr;
            messageElement.appendChild(timeElement);
        }
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    /**
     * Load chat messages
     */
    async loadChatMessages(chatId) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const currentUser = this.state.get('currentUser');
        
        try {
            console.log('💬 Loading messages for chat:', chatId);
            
            // Show loading state
            messagesContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Check if chat exists
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            
            if (!chatDoc.exists()) {
                console.log('📝 New chat - showing welcome message');
                // New chat - show welcome message
                messagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; opacity: 0.7;">
                        <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
                        <div>Start a conversation with ${this.currentChatPartner.name}!</div>
                    </div>
                `;
                return;
            }
            
            // Load messages
            const messagesRef = collection(this.db, 'chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            const snapshot = await getDocs(q);
            
            const messages = [];
            snapshot.forEach(messageDoc => {
                messages.push({ id: messageDoc.id, ...messageDoc.data() });
            });
            
            console.log(`💬 Loaded ${messages.length} messages`);
            
            // Display messages
            this.displayMessages(messages, currentUser.uid);
            
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div>Unable to load messages</div>
                    <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 15px; color: white; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * Display messages with sanitization
     */
    displayMessages(messages, currentUserId) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'text-align: center; padding: 40px; opacity: 0.7;';
            emptyDiv.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
                <div>No messages yet. Say hello!</div>
            `;
            messagesContainer.appendChild(emptyDiv);
            return;
        }
        
        // Clear container
        messagesContainer.innerHTML = '';
       
        // Add each message safely
        messages.forEach(msg => {
            // Check if it's a promotion message
            if (msg.type === 'promotion' && msg.promotion) {
                // Create promotion card
                const isSent = msg.senderId === currentUserId;
                const promoElement = document.createElement('div');
                promoElement.className = `message ${isSent ? 'sent' : 'received'}`;

                // Get promotion data FIRST
                const promo = msg.promotion;
                
                // Create styled promo card
                const promoCard = document.createElement('div');
                promoCard.className = 'promo-message-card';

                // Choose color based on card type
                const isBusinessCard = promo.cardType === 'business' || (!promo.offerTitle && !promo.promotionTitle.includes('Special'));
                const gradient = isBusinessCard 
                    ? 'linear-gradient(135deg, #4A9EFF, #0066CC)'  // Blue for business
                    : 'linear-gradient(135deg, #FF6B6B, #FF8C42)'; // Salmon for offers
                
                promoCard.style.cssText = `
                    background: ${gradient};
                    border-radius: 15px;
                    padding: 15px;
                    margin: 10px 0;
                    max-width: 250px;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    color: white;
                `;
            
                // Make entire card clickable
                promoCard.style.cursor = 'pointer';
              promoCard.addEventListener('click', () => {
                console.log('🔗 Opening business profile:', promo);
                const businessId = promo.businessId || promo.id;
                const businessType = promo.businessType || promo.type || 'restaurant';
                
                if (businessId) {
                    console.log('📍 Navigating to business:', businessId, businessType);
                    window.CLASSIFIED.openBusinessProfile(businessId, businessType);
                } else {
                    console.error('No businessId found in promotion object:', promo);
                    alert('Unable to open business profile. Please try again.');
                }
            });
                
                // Business name header
                const nameDiv = document.createElement('div');
                nameDiv.style.cssText = 'font-weight: 700; font-size: 16px; margin-bottom: 8px; color: white;';
                nameDiv.textContent = promo.businessName || 'Business';
                
                const typeDiv = document.createElement('div');
                typeDiv.style.cssText = 'font-size: 12px; opacity: 0.9; margin-bottom: 10px; color: white;';
                typeDiv.textContent = promo.businessType || 'restaurant';
                
                // Promo content box
                const contentDiv = document.createElement('div');
                contentDiv.style.cssText = 'background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px; margin-bottom: 10px;';
                
                const titleDiv = document.createElement('div');
                titleDiv.style.cssText = 'font-weight: 700; margin-bottom: 5px; color: white; font-size: 14px;';
                titleDiv.textContent = `🎉 ${promo.promotionTitle || 'Special Offer'}`;
                
                const detailsDiv = document.createElement('div');
                detailsDiv.style.cssText = 'font-size: 12px; opacity: 0.9; color: white;';
                detailsDiv.textContent = promo.promotionDetails || 'Ask about our current promotions!';
                
                contentDiv.appendChild(titleDiv);
                contentDiv.appendChild(detailsDiv);
                
                // Address
                const addressDiv = document.createElement('div');
                addressDiv.style.cssText = 'font-size: 11px; opacity: 0.8; color: white; margin-bottom: 5px;';
                addressDiv.textContent = `📍 ${promo.businessAddress || 'Tap to view location'}`;
                
                // Business hours (if available)
                if (promo.businessHours) {
                    const hoursDiv = document.createElement('div');
                    hoursDiv.style.cssText = 'font-size: 11px; opacity: 0.8; color: white;';
                    hoursDiv.textContent = `🕐 ${promo.businessHours}`;
                    
                    // Assemble card with hours
                    promoCard.appendChild(nameDiv);
                    promoCard.appendChild(typeDiv);
                    promoCard.appendChild(contentDiv);
                    promoCard.appendChild(addressDiv);
                    promoCard.appendChild(hoursDiv);
                } else {
                    // Assemble card without hours
                    promoCard.appendChild(nameDiv);
                    promoCard.appendChild(typeDiv);
                    promoCard.appendChild(contentDiv);
                    promoCard.appendChild(addressDiv);
                }
                
                // Add time
                if (msg.timestamp) {
                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'message-time';
                    timeDiv.textContent = this.formatMessageTime(msg.timestamp.toDate());
                    promoElement.appendChild(promoCard);
                    promoElement.appendChild(timeDiv);
                } else {
                    promoElement.appendChild(promoCard);
                }
                
                messagesContainer.appendChild(promoElement);
                
            } else {
                // Regular text message (keep existing code)
                const sanitizedMsg = sanitizeMessage(msg);
                const isSent = sanitizedMsg.senderId === currentUserId;
                const timeStr = msg.timestamp ? this.formatMessageTime(msg.timestamp.toDate()) : '';
                
                const messageElement = document.createElement('div');
                messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
                
                const messageBubble = document.createElement('div');
                messageBubble.className = 'message-bubble';
                messageBubble.textContent = sanitizedMsg.text; // Safe
                
                messageElement.appendChild(messageBubble);
                
                if (timeStr) {
                    const timeElement = document.createElement('div');
                    timeElement.className = 'message-time';
                    
                    // Add read receipt indicator for sent messages
                    if (isSent) {
                        const messageId = `${this.currentChatId}_${msg.id}`;
                        const readState = this.messageReadStates.get(messageId) || msg;
                        
                        if (readState.read) {
                            timeElement.textContent = `${timeStr} ✓✓`;
                            timeElement.style.color = '#00D4FF'; // Blue checkmarks for read
                        } else {
                            timeElement.textContent = `${timeStr} ✓`;
                            timeElement.style.opacity = '0.6'; // Gray single check for sent
                        }
                    } else {
                        timeElement.textContent = timeStr;
                        
                        // Mark incoming message as read if chat is visible
                        if (this.isChatVisible && this.isAppVisible && msg.id) {
                            const messageId = `${this.currentChatId}_${msg.id}`;
                            if (!this.messageReadStates.has(messageId)) {
                                this.messageReadStates.set(messageId, {
                                    read: true,
                                    readAt: Date.now()
                                });
                                // Don't await - fire and forget
                                this.updateMessageReadStatus(msg.id, this.currentChatId);
                            }
                        }
                    }
                    
                    messageElement.appendChild(timeElement);
                }
                
                messagesContainer.appendChild(messageElement);
            }
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
   /**

     * FIXED: Enhanced real-time message listener with proper notifications
     */
        listenToChatMessages(chatId) {
            this.unregisterListener(`chat_${chatId}`);
            
            const currentUser = this.state.get('currentUser');
            const messagesRef = collection(this.db, 'chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            // FIXED: Track if this is the first snapshot for THIS chat
            let isInitialLoad = true;
            const lastSeen = this.lastSeenTimestamps.get(chatId) || this.lastAppActive;
            
            try {
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const messages = [];
                    
                    snapshot.forEach(messageDoc => {
                        messages.push({ id: messageDoc.id, ...messageDoc.data() });
                    });
                    
                    // FIXED: Only process notifications after initial load
                    if (!isInitialLoad) {
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                const message = change.doc.data();
                                
                                if (message.senderId !== currentUser.uid) {
                                    // Get notification manager safely
                                    const notificationManager = window.classifiedApp?.managers?.notifications;
                                    if (notificationManager && notificationManager.shouldShowNotification(message, chatId)) {
                                        // Don't use async in forEach - handle separately
                                        this.handleMessageNotification(message, chatId);
                                    }
                                }
                            }
                        });
                    }
                    
                    this.displayMessages(messages, currentUser.uid);
                    
                    // FIXED: Update last seen for this chat
                    if (this.currentChatId === chatId && this.isAppVisible) {
                        this.lastSeenTimestamps.set(chatId, Date.now());
                        this.saveLastSeenTimestamps();
                    }
                    
                    isInitialLoad = false;
                    
                }, (error) => {
                    console.error('❌ Error in chat listener:', error);
                    this.unregisterListener(`chat_${chatId}`);
                });
                
                this.registerListener(`chat_${chatId}`, unsubscribe, 'chat');
                console.log('👂 Set up real-time listener for chat:', chatId);
                
            } catch (error) {
                console.error('Error setting up chat listener:', error);
            }
        }
    /**
     * Handle message notification properly
     */
    async handleMessageNotification(message, chatId) {
        try {
            const partnerInfo = await this.getChatPartnerInfo(chatId);
            const notificationManager = window.classifiedApp?.managers?.notifications;
            
            if (notificationManager) {
                notificationManager.showNotification(message, chatId, partnerInfo);
                
                if (this.currentChatId !== chatId) {
                    notificationManager.updateUnreadCount(chatId, 1);
                }
            }
        } catch (error) {
            console.error('Error handling message notification:', error);
        }
    }
    
        /**
     * Listen for new matches (FIXED to prevent showing old matches)
     */
       listenForMatches(userId) {
            this.unregisterListener('matches_global');
            
            try {
                const matchesRef = collection(this.db, 'matches');
                const q = query(
                    matchesRef,
                    where('users', 'array-contains', userId)
                );
                
                // FIXED: Track initial load and session start time
                let isInitialLoad = true;
                const sessionStartTime = Date.now();
                const thirtySecondsAgo = Date.now() - 30000; // 30 second window
                
                // FIXED: Load seen matches from localStorage
                if (!this.seenMatches) {
                    this.seenMatches = new Set(JSON.parse(localStorage.getItem('seenMatches') || '[]'));
                }
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (isInitialLoad) {
                    // FIXED: On initial load, mark ALL matches as seen (no popups for old matches)
                    snapshot.forEach(doc => {
                        const matchId = doc.id;
                        const matchData = doc.data();
                        
                        // Add to seen matches regardless of age
                        this.seenMatches.add(matchId);
                        
                        // Also store match timestamp for future validation
                        const matchTime = matchData.timestamp?.toDate?.()?.getTime() || 0;
                        localStorage.setItem(`match_time_${matchId}`, matchTime.toString());
                    });
                    
                    // Save to localStorage
                    this.saveSeenMatches();
                    isInitialLoad = false;
                    console.log(`👂 Initial load complete, marked ${snapshot.size} existing matches as seen`);
                    return;
                }
                
          // FIXED: Only process changes after initial load
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const matchId = change.doc.id;
                        const matchData = change.doc.data();
                        
                        // FIXED: Skip if already seen
                        if (this.seenMatches.has(matchId)) {
                            console.log('⏭️ Skipping already seen match:', matchId);
                            return;
                        }
                        
                        // FIXED: Get match timestamp properly
                        const matchTime = matchData.timestamp?.toDate?.() || new Date();
                        const matchTimeMs = matchTime.getTime();
                        
                        // FIXED: THREE validation checks for match popup
                        
                        // 1. Must be created AFTER this session started
                        if (matchTimeMs < sessionStartTime) {
                            console.log('⏭️ Skipping old match from before session:', matchId);
                            this.seenMatches.add(matchId);
                            localStorage.setItem(`match_time_${matchId}`, matchTimeMs.toString());
                            this.saveSeenMatches();
                            return;
                        }
                        
                        // 2. Must be less than 30 seconds old
                        const timeDiff = Date.now() - matchTimeMs;
                        if (timeDiff > 30000) {
                            console.log('⏭️ Skipping stale match (>30s old):', matchId, `Age: ${Math.round(timeDiff/1000)}s`);
                            this.seenMatches.add(matchId);
                            localStorage.setItem(`match_time_${matchId}`, matchTimeMs.toString());
                            this.saveSeenMatches();
                            return;
                        }
                        
                        // 3. Must be created after the 30-second window started
                        if (matchTimeMs < thirtySecondsAgo) {
                            console.log('⏭️ Match outside 30s window:', matchId);
                            this.seenMatches.add(matchId);
                            localStorage.setItem(`match_time_${matchId}`, matchTimeMs.toString());
                            this.saveSeenMatches();
                            return;
                        }
                        
                        // This is a genuinely new, recent match!
                        console.log('🎉 New match detected!', matchId);
                        this.seenMatches.add(matchId);
                        this.saveSeenMatches();
                        this.handleNewMatch(matchData);
                    }
                });
                
            }, (error) => {
                console.error('Error in match listener:', error);
                this.unregisterListener('matches_global');
            });
            
            this.registerListener('matches_global', unsubscribe, 'match');
            
        } catch (error) {
            console.error('Error setting up match listener:', error);
        }
    }
    
    /**
     * Save seen matches to localStorage
     */
    saveSeenMatches() {
        if (this.seenMatches) {
            localStorage.setItem('seenMatches', JSON.stringify(Array.from(this.seenMatches)));
        }
    }
            /**
         * Load unread state from localStorage
         */
        loadUnreadStateFromStorage() {
            try {
                const savedUnreadState = localStorage.getItem('unreadMessages');
                if (savedUnreadState) {
                    const parsed = JSON.parse(savedUnreadState);
                    Object.entries(parsed).forEach(([chatId, count]) => {
                        this.unreadMessages.set(chatId, count);
                    });
                    console.log('📚 Loaded unread state from storage:', this.unreadMessages.size, 'chats');
                }
            } catch (error) {
                console.error('Error loading unread state:', error);
            }
        }


        /**
         * Save unread state to localStorage
         */
        saveUnreadStateToStorage() {
            try {
                const unreadObject = {};
                this.unreadMessages.forEach((count, chatId) => {
                    if (count > 0) {
                        unreadObject[chatId] = count;
                    }
                });
                localStorage.setItem('unreadMessages', JSON.stringify(unreadObject));
                console.log('💾 Saved unread state to storage');
            } catch (error) {
                console.error('Error saving unread state:', error);
            }
        }
    
    
    /**
     * Listen for chat updates
     */
       listenForChatUpdates(userId) {
        this.unregisterListener('chat_updates_global');
        
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            let isInitialLoad = true;
            
            const unsubscribe = onSnapshot(q, async (snapshot) => {
                if (isInitialLoad) {
                    snapshot.forEach(doc => {
                        const chatData = doc.data();
                        const chatId = doc.id;
                        
                   if (chatData.lastMessageSender && 
                        chatData.lastMessageSender !== userId &&
                        chatData.lastMessageTime) {
                        
                        // FIX: Add missing messageTime variable
                        const messageTime = chatData.lastMessageTime.toMillis ? chatData.lastMessageTime.toMillis() : 0;
                        
                        // On initial load, only count as unread if:
                        // 1. Message is from before last session ended AND
                        // 2. We haven't marked it as seen
                        const seenKey = `seen_${chatId}_${userId}`;
                        const lastSeen = localStorage.getItem(seenKey);
                            
                            if (messageTime > this.lastAppActive) {
                                const currentUnread = this.unreadMessages.get(chatId) || 0;
                                // Only set unread if we don't already have it marked as read
                                if (!this.unreadMessages.has(chatId) || this.unreadMessages.get(chatId) > 0) {
                                    this.unreadMessages.set(chatId, 1);
                                }
                            }
                        }
                    });
                    
                    isInitialLoad = false;
                    this.saveUnreadStateToStorage();
                    this.updateTotalUnreadCount();
                    await this.loadChats();
                    return;
                }
                
                for (const change of snapshot.docChanges()) {
                    if (change.type === 'modified') {
                        const chatData = change.doc.data();
                        const chatId = change.doc.id;
                        
                        if (chatData.lastMessageSender && 
                            chatData.lastMessageSender !== userId &&
                            this.currentChatId !== chatId &&
                            chatData.lastMessageTime) {
                            
                            const messageTime = chatData.lastMessageTime.toMillis();
                            
                            if (messageTime > this.lastAppActive) {
                                const currentUnread = this.unreadMessages.get(chatId) || 0;
                                this.unreadMessages.set(chatId, currentUnread + 1);
                            }
                        }
                        this.saveUnreadStateToStorage();
                    }
                }
                
                await this.loadChats();
                this.updateTotalUnreadCount();
                
            }, (error) => {
                console.error('Error in chat updates listener:', error);
                this.unregisterListener('chat_updates_global');
            });
            
            this.registerListener('chat_updates_global', unsubscribe, 'chat_update');
            
        } catch (error) {
            console.error('Error setting up chat updates listener:', error);
        }
    }
    
    /**
     * Listen for new messages globally (for notifications)
     */
    listenForNewMessages(userId) {
        // ADDED: Remove existing listener first
        this.unregisterListener('messages_global');
        
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified') {
                        const chatData = change.doc.data();
                        const chatId = change.doc.id;
                        
                        if (chatData.lastMessageSender && chatData.lastMessageSender !== userId) {
                            if (this.currentChatId !== chatId) {
                                this.showInAppNotification(chatData, chatId);
                                this.updateUnreadCount(chatId, 1);
                            }
                        }
                    }
                });
            }, (error) => {
                if (error.code?.includes('permission')) {
                    handleSecurityError(error);
                }
                console.error('Error in global message listener:', error);
                this.unregisterListener('messages_global'); // ADDED: Cleanup on error
            });
            
            // ADDED: Register with tracking
            this.registerListener('messages_global', unsubscribe, 'message');
            console.log('👂 Set up global message notifications for user:', userId);
            
        } catch (error) {
            console.error('Error setting up global message listener:', error);
        }
    }


    /**
     * Show in-app notification
     */
        showInAppNotification(chatData) {
            // Don't show notification if chat is currently open
            if (this.currentChatId && this.currentChatId.includes(chatData.lastMessageSender)) {
                return;
            }
            
            // Create notification element
            const notification = document.createElement('div');
            notification.className = 'social-proof-notification';
            notification.textContent = `💬 New message: ${chatData.lastMessage}`;
            
            document.body.appendChild(notification);
            // Show notification dot
            this.showNotificationDot();
            
            // Play sound
            if (this.notificationSound) {
                this.notificationSound.play().catch(e => console.log('Could not play sound:', e));
            }
            
            // Show browser notification if permission granted
            try {
                if (Notification.permission === 'granted') {
                    new Notification('New message', {
                        body: chatData.lastMessage,
                        icon: '/path/to/icon.png' // Add your app icon
                    });
                }
            } catch (error) {
                console.log('Could not show browser notification:', error);
            }
            
            // Remove after 3 seconds
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
        
        /**
         * Handle new match
         */
           async handleNewMatch(matchData) {
            console.log('🎉 New match!', matchData);
            
            try {
                // SECURITY: Validate match data structure
                if (!matchData.users || !Array.isArray(matchData.users) || matchData.users.length !== 2) {
                    console.error('Invalid match data structure');
                    return;
                }
                
                // FIXED: Double-check match age before showing popup
                const matchTime = matchData.timestamp?.toDate?.() || new Date();
                const matchAge = Date.now() - matchTime.getTime();
                
                if (matchAge > 30000) {
                    console.log('⏭️ Match too old for popup, age:', Math.round(matchAge/1000), 'seconds');
                    return;
                }
                
                // Prevent duplicate match popups
                const matchPopup = document.getElementById('matchPopup');
                if (matchPopup && matchPopup.classList.contains('show')) {
                    console.log('Match popup already showing, skipping duplicate');
                    return;
                }
                
                // Show match popup
                if (matchPopup) {
                    matchPopup.classList.add('show');
                    
                    // Update match popup content
                    const currentUser = this.state.get('currentUser');
                    const partnerId = matchData.users.find(id => id !== currentUser.uid);
                    
                    if (partnerId) {
                        const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
                        if (partnerDoc.exists()) {
                            const partnerData = partnerDoc.data();
                            this.state.set('lastMatchedUser', {
                                id: partnerId,
                                name: partnerData.name,
                                avatar: partnerData.photos?.[0] || 'https://via.placeholder.com/100'
                            });
                            
                            // Update popup text
                            const popupText = matchPopup.querySelector('p');
                            if (popupText) {
                                popupText.textContent = `You and ${partnerData.name} both liked each other`;
                            }
                        }
                    }
                    
                    // Auto-close after 10 seconds if user doesn't interact
                    setTimeout(() => {
                        if (matchPopup.classList.contains('show')) {
                            matchPopup.classList.remove('show');
                            console.log('🕐 Match popup auto-closed after 10 seconds');
                        }
                    }, 10000);
                }
            } catch (error) {
                console.error('Error handling new match:', error);
            }
            // At the end of the method:
            this.saveSeenMatches();
        }
    
   /**
     * Start chat from match popup
     */
    startChatFromMatch() {
        const matchedUser = this.state.get('lastMatchedUser');
        if (matchedUser) {
            console.log('🚀 Starting chat with matched user:', matchedUser.name);
            
            // Hide match popup first
            const matchPopup = document.getElementById('matchPopup');
            if (matchPopup) {
                matchPopup.classList.remove('show');
            }
            
            // Switch to social tab first
            if (window.classifiedApp?.managers?.feed) {
                window.classifiedApp.managers.feed.switchSocialTab('messaging');
            }
            
            // Small delay to ensure UI updates, then open chat
            setTimeout(() => {
                this.openChat(matchedUser.name, matchedUser.avatar, matchedUser.id);
            }, 300);
        } else {
            console.error('No matched user found');
            alert('Unable to start chat. Please try again.');
        }
    }
    
    /**
     * Open chat with viewed user
     */
    openChatWithUser(userName) {
        // Find user by name in mock data
        if (this.mockData) {
            const users = this.mockData.getUsers();
            const user = users.find(u => u.name === userName);
            if (user) {
                this.openChat(user.name, user.image, user.uid);
            }
        }
    }
    
    /**
     * Start chat with currently viewed user
     */
    startChatWithViewedUser() {
        const viewedUser = this.state.get('currentViewedUser');
        if (viewedUser) {
            this.openChat(viewedUser.name, viewedUser.image, viewedUser.uid);
        }
    }
    
    /**
     * Open profile from chat
     */
    openProfileFromChat() {
        if (this.currentChatPartner && this.profileManager) {
            // Get full user data
            if (this.mockData) {
                const user = this.mockData.getUserById(this.currentChatPartner.userId);
                if (user) {
                    this.profileManager.openUserProfile(user);
                }
            }
        }
    }
    
    /**
     * Send notification to user (placeholder for push notifications)
     */
    sendNotificationToUser(userId, notificationData) {
        console.log('🔔 Sending notification to user:', userId, notificationData);
        // In a real app, this would integrate with Firebase Cloud Messaging
        // or another push notification service
        
        // For now, we'll just log it
        // You could implement server-side logic to send actual push notifications
    }
    
    /**
     * Create a match between two users
     */
  /**
 * FIXED: Create a match between two users with proper chat setup
 */
async createMatch(userId1, userId2) {
    try {
        // SECURITY: Validate user IDs
        if (!userId1 || !userId2 || userId1 === userId2) {
            throw new Error('Invalid user IDs for match creation');
        }
        
        console.log('🎉 Creating match between', userId1, 'and', userId2);
        
        // FIXED: Add creation timestamp for 30-second validation
        const matchData = {
            users: [userId1, userId2].sort(), // Sort for consistency
            timestamp: serverTimestamp(),
            createdTimestamp: Date.now(), // Client timestamp for immediate validation
            status: 'active',
            createdBy: 'system',
            chatCreated: false
        };
        
        // Use sorted IDs as document ID for consistency
        const matchId = [userId1, userId2].sort().join('_');
        
        // Create the match document
        await setDoc(doc(this.db, 'matches', matchId), matchData);
        
        // Create corresponding chat document
        const chatId = matchId; // Use same ID for simplicity
        await setDoc(doc(this.db, 'chats', chatId), {
            participants: [userId1, userId2].sort(),
            createdAt: serverTimestamp(),
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            lastMessageSender: null,
            matchId: matchId,
            type: 'match_chat'
        });
        
        // Update match to indicate chat was created
        await updateDoc(doc(this.db, 'matches', matchId), {
            chatCreated: true,
            chatId: chatId
        });
        
        // Send match notification to both users
        await this.sendMatchNotifications(userId1, userId2, matchId);
        
        console.log('✅ Match created successfully:', matchId);
        return matchId;
        
    } catch (error) {
        console.error('❌ Error creating match:', error);
        throw error;
    }
}


/**
 * NEW: Send match notifications to both users
 */
async sendMatchNotifications(userId1, userId2, matchId) {
    try {
        // Get user data for notifications
        const [user1Doc, user2Doc] = await Promise.all([
            getDoc(doc(this.db, 'users', userId1)),
            getDoc(doc(this.db, 'users', userId2))
        ]);
        
        const user1Data = user1Doc.exists() ? user1Doc.data() : null;
        const user2Data = user2Doc.exists() ? user2Doc.data() : null;
        
        // Create notification documents
        const notifications = [];
        
        if (user1Data && user2Data) {
            // Notification for user1
            notifications.push(
                setDoc(doc(collection(this.db, 'notifications')), {
                    userId: userId1,
                    type: 'match',
                    title: '🎉 It\'s a Match!',
                    message: `You and ${user2Data.name} liked each other!`,
                    matchId: matchId,
                    partnerId: userId2,
                    partnerName: user2Data.name,
                    partnerPhoto: user2Data.photos?.[0] || user2Data.photo,
                    read: false,
                    timestamp: serverTimestamp()
                })
            );
            
            // Notification for user2
            notifications.push(
                setDoc(doc(collection(this.db, 'notifications')), {
                    userId: userId2,
                    type: 'match',
                    title: '🎉 It\'s a Match!',
                    message: `You and ${user1Data.name} liked each other!`,
                    matchId: matchId,
                    partnerId: userId1,
                    partnerName: user1Data.name,
                    partnerPhoto: user1Data.photos?.[0] || user1Data.photo,
                    read: false,
                    timestamp: serverTimestamp()
                })
            );
            
            await Promise.all(notifications);
            console.log('📬 Match notifications sent');
        }
        
    } catch (error) {
        console.error('Error sending match notifications:', error);
        // Don't throw - match creation should still succeed
    }
}


/**
 * SECURED: Check if two users have mutual likes (for match detection)
 */
async checkMutualLikes(userId1, userId2) {
    try {
        // SECURITY: Validate and sanitize user IDs
        if (!userId1 || !userId2 || userId1 === userId2) {
            console.error('Invalid user IDs for mutual like check');
            return false;
        }
        
        // SECURITY: Ensure IDs are alphanumeric only
        const safeUserId1 = userId1.replace(/[^a-zA-Z0-9_-]/g, '');
        const safeUserId2 = userId2.replace(/[^a-zA-Z0-9_-]/g, '');
        
        if (safeUserId1 !== userId1 || safeUserId2 !== userId2) {
            console.error('User IDs contain invalid characters');
            return false;
        }
        
        // Check both directions for likes
        const [like1Doc, like2Doc] = await Promise.all([
            getDoc(doc(this.db, 'likes', `${userId1}_${userId2}`)),
            getDoc(doc(this.db, 'likes', `${userId2}_${userId1}`))
        ]);
        
        const hasMutualLikes = like1Doc.exists() && like2Doc.exists();
        
        if (hasMutualLikes) {
            console.log('💕 Mutual likes detected between', userId1, 'and', userId2);
        }
        
        return hasMutualLikes;
    } catch (error) {
        console.error('Error checking mutual likes:', error);
        return false;
    }
}

/**
 * ENHANCED: Process like action with proper match detection
 */
async processLikeAction(fromUserId, toUserId, type = 'like') {
    try {
        // Validate inputs
        if (!fromUserId || !toUserId || fromUserId === toUserId) {
            throw new Error('Invalid user IDs for like action');
        }
        
        // Check if already liked (prevent duplicates)
        const likeId = `${fromUserId}_${toUserId}`;
        const existingLike = await getDoc(doc(this.db, 'likes', likeId));
        
        if (existingLike.exists()) {
            console.log('⚠️ Like already exists:', likeId);
            return { isMatch: false, alreadyLiked: true };
        }
        
        // Record the like with timestamp
        await setDoc(doc(this.db, 'likes', likeId), {
            fromUserId: fromUserId,
            toUserId: toUserId,
            timestamp: serverTimestamp(),
            type: type // 'like' or 'superlike'
        });
        
        console.log(`✅ ${type} recorded:`, likeId);
        
        // Check for mutual likes
        const isMutual = await this.checkMutualLikes(fromUserId, toUserId);
        
        if (isMutual) {
            // Create match only if mutual
            const matchId = await this.createMatch(fromUserId, toUserId);
            
            // Trigger match popup for current user
            await this.triggerMatchPopup(fromUserId, toUserId);
            
            return { isMatch: true, matchId: matchId };
        }
        
        return { isMatch: false };
        
    } catch (error) {
        console.error('Error processing like action:', error);
        throw error;
    }
}

/**
 * ENHANCED: Trigger match popup with timestamp validation
 */
async triggerMatchPopup(currentUserId, matchedUserId) {
    try {
        // Get matched user data with validation
        const matchedUserDoc = await getDoc(doc(this.db, 'users', matchedUserId));
        
        if (!matchedUserDoc.exists()) {
            console.error('Matched user not found:', matchedUserId);
            return;
        }
        
        const userData = matchedUserDoc.data();
        
        // Sanitize user data
        const safeName = this.escapeHtml(userData.name || 'Someone');
        const safeAvatar = userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100';
        
        // Store matched user data
        this.state.set('lastMatchedUser', {
            id: matchedUserId,
            name: safeName,
            avatar: safeAvatar
        });
        
        // Show match popup
        const matchPopup = document.getElementById('matchPopup');
        if (matchPopup) {
            // Prevent duplicate popups
            if (matchPopup.classList.contains('show')) {
                console.log('Match popup already showing');
                return;
            }
            
            matchPopup.classList.add('show');
            
            // Update popup content safely
            const popupText = matchPopup.querySelector('p');
            if (popupText) {
                popupText.textContent = `You and ${safeName} both liked each other`;
            }
            
            // Auto-close after 10 seconds
            setTimeout(() => {
                if (matchPopup.classList.contains('show')) {
                    matchPopup.classList.remove('show');
                }
            }, 10000);
            
            // Mark this match as seen
            this.seenMatches.add(`${currentUserId}_${matchedUserId}`);
            this.saveSeenMatches();
        }
        
    } catch (error) {
        console.error('Error triggering match popup:', error);
    }
}
    
    /**
     * Utility Methods
     */
    
    generateChatId(userId1, userId2) {
        return [userId1, userId2].sort().join('_');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatMessageTime(date) {
        if (!date) return '';
        
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    }
    
    getTimeAgo(timestamp) {
        if (!timestamp) return '';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return this.formatMessageTime(date);
    }


/**
 * NEW: Get chat partner information
 */
async getChatPartnerInfo(chatId) {
    const currentUser = this.state.get('currentUser');
    if (!currentUser) return { name: 'Someone', avatar: '' };
    
    // Add validation for chatId
    if (!chatId) {
        console.error('getChatPartnerInfo called without chatId');
        return { name: 'Someone', avatar: '' };
    }
    
    try {
        // Get chat document to find participants
        const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
        if (!chatDoc.exists()) {
            console.error('Chat document not found:', chatId);
            return { name: 'Someone', avatar: '' };
        }
        
        const chatData = chatDoc.data();
        const partnerId = chatData.participants?.find(id => id !== currentUser.uid);
        
        if (partnerId) {
            const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
            if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                return {
                    id: partnerId,
                    name: partnerData.name || 'Someone',
                    avatar: partnerData.photos?.[0] || partnerData.photo || 'https://via.placeholder.com/40'
                };
            }
        }
    } catch (error) {
        console.error('Error getting chat partner info:', error);
        // Don't throw - return fallback values
    }
    
    return { name: 'Someone', avatar: '' };
}


/**
 * NEW: Open chat from notification
 */
async openChatFromNotification(chatId, partnerInfo) {
    // Clear notification dot
    this.hideNotificationDot();
    
    // Switch to messaging tab
    const feedManager = window.classifiedApp?.managers?.feed;
    if (feedManager) {
        feedManager.switchSocialTab('messaging');
    }
    
    // Open the specific chat
    await this.openChat(partnerInfo.name, partnerInfo.avatar, partnerInfo.id);
}


/**
 * NEW: Unread message tracking
 */
updateUnreadCount(chatId, increment) {
    const current = this.unreadMessages.get(chatId) || 0;
    const newCount = Math.max(0, current + increment);
    
    this.unreadMessages.set(chatId, newCount);
    
    // FIXED: Save immediately after every update
    this.saveUnreadStateToStorage();
    
    // Calculate total unread
    const totalUnread = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
    
    // Always show notification if there are unread messages
    if (totalUnread > 0) {
        this.showNotificationDot(totalUnread);
    } else {
        this.hideNotificationDot();
    }
    
    // Update chat list UI with unread indicators
    this.updateChatListUnreadIndicators();
}


    /**
 * Update total unread count from all chats
 */
updateTotalUnreadCount() {
    // Calculate total unread from all chats
    let totalUnread = 0;
    this.unreadMessages.forEach((count, chatId) => {
        // Only count chats that are not currently open
        if (chatId !== this.currentChatId) {
            totalUnread += count;
        }
    });
    
    // Update the notification badge
    if (totalUnread > 0) {
        this.showNotificationDot(totalUnread);
    } else {
        this.hideNotificationDot();
    }
    
    console.log(`📊 Total unread messages: ${totalUnread}`);
}
    
/**
 * NEW: Mark chat as read
 */
async markChatAsRead(chatId) {
    this.unreadMessages.set(chatId, 0);
    
    // FIXED: Save immediately
    this.saveUnreadStateToStorage();
    
    // FIXED: Also save timestamp of when we last read this chat
    localStorage.setItem(`lastRead_${chatId}`, Date.now().toString());
    localStorage.setItem(`seen_${chatId}_${this.state.get('currentUser').uid}`, Date.now().toString());
    
    // Update total unread count
    const totalUnread = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
    if (totalUnread === 0) {
        this.hideNotificationDot();
    } else {
        this.showNotificationDot(totalUnread);
    }
}

/**
 * NEW: Mark current chat as read when app becomes visible
 */
markCurrentChatAsRead() {
    if (this.currentChatId) {
        this.markChatAsRead(this.currentChatId);
    }
}

/**
 * Mark all messages in a chat as read and update Firebase
 */
async markAllMessagesAsRead(chatId) {
    if (!chatId || !this.isChatVisible || !this.isAppVisible) return;
    
    try {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        // Query unread messages in this chat
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(
            messagesRef,
            where('senderId', '!=', currentUser.uid),
            where('read', '==', false)
        );
        
        const snapshot = await getDocs(q);
        const batch = writeBatch(this.db);
        
        snapshot.forEach(doc => {
            // Update local state
            const messageId = `${chatId}_${doc.id}`;
            this.messageReadStates.set(messageId, {
                read: true,
                readAt: Date.now()
            });
            
            // Prepare batch update
            batch.update(doc.ref, {
                read: true,
                readAt: serverTimestamp()
            });
        });
        
        // Execute batch update
        if (!snapshot.empty) {
            await batch.commit();
            this.saveMessageReadStates();
            console.log(`✅ Marked ${snapshot.size} messages as read in chat ${chatId}`);
        }
        
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

/**
 * Update read status for a single message in Firebase
 */
async updateMessageReadStatus(messageId, chatId) {
    try {
        const messageRef = doc(this.db, 'chats', chatId, 'messages', messageId);
        await updateDoc(messageRef, {
            read: true,
            readAt: serverTimestamp()
        });
        this.saveMessageReadStates();
    } catch (error) {
        console.error('Error updating message read status:', error);
    }
}

/**
 * NEW: Update chat list with unread indicators
 */
updateChatListUnreadIndicators() {
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(chatItem => {
        const chatId = chatItem.dataset.chatId;
        if (chatId) {
            const unreadCount = this.unreadMessages.get(chatId) || 0;
            
            // Remove existing indicator
            const existingIndicator = chatItem.querySelector('.unread-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Add new indicator if unread messages exist
            if (unreadCount > 0) {
                const indicator = document.createElement('div');
                indicator.className = 'unread-indicator';
                indicator.innerHTML = unreadCount > 9 ? '9+' : unreadCount.toString();
                indicator.style.cssText = `
                    position: absolute; top: 10px; right: 10px;
                    background: #FF4444; color: white;
                    border-radius: 50%; width: 20px; height: 20px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; font-weight: bold;
                `;
                
                chatItem.style.position = 'relative';
                chatItem.appendChild(indicator);
            }
        }
    });
}


/**
 * NEW: Batch notification updates
 */
updateNotificationState() {
    const totalUnread = Array.from(this.unreadMessages.values())
        .reduce((sum, count) => sum + count, 0);
    
    if (totalUnread > 0) {
        this.showNotificationDot(totalUnread);
        
        // Update document title
        document.title = `(${totalUnread}) CLASSIFIED - Hoi An Social Discovery`;
        
        // Update favicon if available
        this.updateFaviconWithCount(totalUnread);
    } else {
        this.hideNotificationDot();
        document.title = 'CLASSIFIED - Hoi An Social Discovery';
        this.resetFavicon();
    }
    
    // Update chat list
    this.updateChatListUnreadIndicators();
}

     /**
     * Clean up stale listeners (older than 10 minutes)
     */
    cleanupStaleListeners() {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const staleListeners = [];
        
        this.activeListeners.forEach((listener, id) => {
            if (listener.createdAt < tenMinutesAgo && !id.startsWith('chat_')) {
                // Don't auto-cleanup active chat listeners
                staleListeners.push(id);
            }
        });
        
        if (staleListeners.length > 0) {
            console.log(`🧹 Cleaning up ${staleListeners.length} stale listeners`);
            staleListeners.forEach(id => {
                this.unregisterListener(id);
            });
        }
    }
    
    /**
 * ENHANCED: Cleanup on destroy with better resource management
 */
       cleanup() {
        console.log('🧹 Cleaning up messaging listeners and resources');
        
        // Save state first
        try {
            this.saveUnreadStateToStorage();
            this.saveSeenMatches();
            this.saveLastSeenTimestamps();
            this.saveMessageReadStates();
        } catch (error) {
            console.error('Error saving messaging state:', error);
        }
            
        console.log(`📊 Active listeners before cleanup: ${this.activeListeners.size}`);
        
        // 1. Remove ALL tracked listeners
        this.activeListeners.forEach((listener, id) => {
            try {
                listener.unsubscribe();
                console.log(`✓ Cleaned up listener: ${id} (${listener.type})`);
            } catch (error) {
                console.error(`Error cleaning up listener ${id}:`, error);
            }
        });
       if (this.activeListeners) this.activeListeners.clear();
        
        // 2. Legacy cleanup for backwards compatibility
        if (this.chatListeners) {
            this.chatListeners.forEach(unsubscribe => {
                try {
                    unsubscribe();
                } catch (error) {
                    console.error('Error unsubscribing from chat listener:', error);
                }
            });
            this.chatListeners.clear();
        }
        
        // 3. Clean up singleton listeners
        [this.matchListener, this.globalMessageListener, this.notificationListener].forEach(listener => {
            if (listener) {
                try {
                    listener();
                } catch (error) {
                    console.error('Error unsubscribing from singleton listener:', error);
                }
            }
        });
        
        this.matchListener = null;
        this.globalMessageListener = null;
        this.notificationListener = null;
        
        // 4. Clean up audio resources
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (error) {
                console.error('Error closing audio context:', error);
            }
        }
        
        // 5. Clear intervals
        if (this.listenerCleanupInterval) {
            clearInterval(this.listenerCleanupInterval);
            this.listenerCleanupInterval = null;
        }
        
        // 6. Clear notification state
        if (this.unreadMessages) this.unreadMessages.clear();
        if (this.lastSeenMessages) this.lastSeenMessages.clear();
        if (this.lastNotificationTimes) this.lastNotificationTimes.clear();
        this.notificationQueue = [];
        
        // 7. Remove notification elements
        document.querySelectorAll('.chat-notification').forEach(el => el.remove());
        
        // 8. Reset UI
        document.title = 'CLASSIFIED - Hoi An Social Discovery';
        // this.resetFavicon(); // Function doesn't exist
        this.hideNotificationDot();
        
        console.log('✅ Messaging cleanup complete');
        console.log(`📊 Active listeners after cleanup: ${this.activeListeners.size}`);
    }


        /**
     * Diagnostic method to check active listeners
     * Call this in console: window.classifiedApp.managers.messaging.diagnosticListeners()
     */
    /**
     * Diagnostic method to check active listeners
     * Call this in console: window.classifiedApp.managers.messaging.diagnosticListeners()
     */
    diagnosticListeners() {
        console.log('🔍 LISTENER DIAGNOSTIC REPORT');
        console.log('================================');
        console.log(`Total active listeners: ${this.activeListeners.size}`);
        
        const byType = {};
        const listenerDetails = [];
        this.activeListeners.forEach((listener, id) => {
            byType[listener.type] = (byType[listener.type] || 0) + 1;
            const age = ((Date.now() - listener.createdAt) / 1000).toFixed(1);
            listenerDetails.push({
                id,
                type: listener.type,
                age: `${age}s`,
                created: new Date(listener.createdAt).toISOString()
            });
        });
        
        console.log('\nActive Listeners:');
        console.table(listenerDetails);
        
        console.log('\nBreakdown by type:');
        Object.entries(byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
        // Check for potential leaks
        const potentialLeaks = [];
        this.activeListeners.forEach((listener, id) => {
            const age = (Date.now() - listener.createdAt) / 1000;
            if (age > 300) { // Older than 5 minutes
                potentialLeaks.push(id);
            }
        });
        
        if (potentialLeaks.length > 0) {
            console.warn('\n⚠️ Potential memory leaks (listeners >5 min old):');
            potentialLeaks.forEach(id => console.warn(`  - ${id}`));
        }
        
        console.log('\nLegacy chat listeners:', this.chatListeners?.size || 0);
        console.log('================================');
        
        return {
            total: this.activeListeners.size,
            byType,
            potentialLeaks: potentialLeaks.length
        };
    }
    
    /**
     * Show notification dot (delegates to NotificationManager)
     */
    showNotificationDot(count = null) {
        const notificationManager = window.classifiedApp?.managers?.notifications;
        if (notificationManager) {
            notificationManager.showNotificationDot(count);
        }
    }
    
    /**
     * Hide notification dot (delegates to NotificationManager)
     */
    hideNotificationDot() {
        const notificationManager = window.classifiedApp?.managers?.notifications;
        if (notificationManager) {
            notificationManager.hideNotificationDot();
        }
    }


/**
 * Send promotion message in chat
 */
async sendPromotionMessage(promoData) {
    const messageInput = document.getElementById('messageInput');
    const currentUser = this.state.get('currentUser');
    
    if (!currentUser || !this.currentChatId || !this.currentChatPartner) {
        throw new Error('Chat context not available');
    }
    
    // Validate and ensure no undefined fields
    const sanitizedPromo = {
        businessId: promoData.businessId || '',
        businessName: promoData.businessName || 'Business',
        businessImage: promoData.businessImage || 'https://via.placeholder.com/400',
        businessType: promoData.businessType || 'Business',
        promotionTitle: promoData.promotionTitle || 'Special Offer',
        promotionDetails: promoData.promotionDetails || 'Contact for details',
        businessAddress: promoData.businessAddress || 'Hoi An, Vietnam'
    };
    
    try {
        console.log('📤 Sending promotion message:', sanitizedPromo);
        
        // Create message document with sanitized promotion data
        const messageData = {
            text: `Check out this special from ${sanitizedPromo.businessName}!`,
            type: 'promotion',
            promotion: sanitizedPromo,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            timestamp: serverTimestamp(),
            read: false
        };
        
        // Add promotion UI to chat immediately
        this.addPromotionToUI(sanitizedPromo);
        
        // Add to messages subcollection
        await addDoc(collection(this.db, 'chats', this.currentChatId, 'messages'), messageData);
        
        // Update chat document
        await updateDoc(doc(this.db, 'chats', this.currentChatId), {
            lastMessage: `📍 Shared ${sanitizedPromo.businessName}`,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: currentUser.uid
        });
        
        console.log('✅ Promotion sent successfully');
        
    } catch (error) {
        console.error('❌ Error sending promotion:', error);
        throw error;
    }
}

    /**
     * Add promotion to chat UI - SECURED
     */
    addPromotionToUI(promoData) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const promoElement = document.createElement('div');
        promoElement.className = 'message sent';
        
        // Create promo card safely
        const promoCard = document.createElement('div');
        promoCard.className = 'promo-message-card';
        promoCard.style.cssText = `
            background: linear-gradient(135deg, #FF6B6B, #FF8C42);
            border-radius: 15px;
            padding: 15px;
            margin: 10px 0;
            max-width: 250px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        promoCard.onclick = () => window.CLASSIFIED.openBusinessProfile(promoData.businessId, promoData.businessType || 'restaurant');
        
        // Business header with image
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
        
        // Only add image if it exists and is not placeholder
        if (promoData.businessImage && !promoData.businessImage.includes('placeholder')) {
            const imageDiv = document.createElement('div');
            imageDiv.style.cssText = `
                width: 50px; height: 50px; border-radius: 8px; 
                background-image: url('${escapeHtml(promoData.businessImage)}');
                background-size: cover; background-position: center;
                flex-shrink: 0;
            `;
            headerDiv.appendChild(imageDiv);
        }
        
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'flex: 1; color: white;';
        
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-weight: 700; font-size: 16px; margin-bottom: 2px; color: white;';
        nameDiv.textContent = promoData.businessName;
        
        const typeDiv = document.createElement('div');
        typeDiv.style.cssText = 'font-size: 12px; opacity: 0.9; color: white;';
        typeDiv.textContent = promoData.businessType;
        
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(typeDiv);
        headerDiv.appendChild(infoDiv);
        
        // Promo content
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px; margin-bottom: 10px;';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'promo-title';
        titleDiv.style.cssText = 'font-weight: 700; margin-bottom: 5px; color: white; font-size: 14px;';
        titleDiv.textContent = `🎉 ${promoData.promotionTitle}`;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'promo-details';
        detailsDiv.style.cssText = 'font-size: 12px; opacity: 0.9; color: white;';
        detailsDiv.textContent = promoData.promotionDetails;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(detailsDiv);
        
        // Address
        const addressDiv = document.createElement('div');
        addressDiv.style.cssText = 'margin-top: 5px; font-size: 11px; opacity: 0.8; color: white;';
        addressDiv.textContent = `📍 ${promoData.businessAddress || 'Tap to view location'}`;
        
        // Assemble
        promoCard.appendChild(headerDiv);
        promoCard.appendChild(contentDiv);
        promoCard.appendChild(addressDiv);
        
        // Add time
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatMessageTime(new Date());
        
        promoElement.appendChild(promoCard);
        promoElement.appendChild(timeDiv);
        
        messagesContainer.appendChild(promoElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
     /**
     * Clean up old match timestamps from localStorage (housekeeping)
     */
    cleanupOldMatchTimestamps() {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('match_time_')) {
                const timestamp = parseInt(localStorage.getItem(key) || '0');
                if (timestamp < oneWeekAgo) {
                    keysToRemove.push(key);
                }
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`🧹 Cleaned up ${keysToRemove.length} old match timestamps`);
    }
}
