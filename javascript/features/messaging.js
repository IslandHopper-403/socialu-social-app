// javascript/features/messaging.js - COMPLETE VERSION

import { sanitizeMessage, sanitizeText, escapeHtml 
} from '../utils/security.js';

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
    this.chatListeners = new Map();
    this.matchListener = null;
    this.notificationListener = null;
    this.globalMessageListener = null;
    
    // Current chat context
    this.currentChatId = null;
    this.currentChatPartner = null;
    
    // ADDED: Notification state tracking
    this.unreadMessages = new Map(); // chatId -> count
    this.loadUnreadStateFromStorage(); // ADD THIS LINE
    this.lastSeenMessages = new Map(); // chatId -> timestamp
    this.lastNotificationTimes = new Map(); // chatId -> timestamp
    this.notificationQueue = [];
    this.isAppVisible = !document.hidden;
    
    // Notification system
    this.notificationSound = null;
    this.audioContext = null;
    this.setupNotificationSound();
    
    // ADDED: Track app visibility for smart notifications
    document.addEventListener('visibilitychange', () => {
        this.isAppVisible = !document.hidden;
        if (this.isAppVisible) {
            this.markCurrentChatAsRead();
        }
    });
       // Add this line to track seen matches across sessions
       this.seenMatches = new Set(JSON.parse(localStorage.getItem('seenMatches') || '[]'));

       window.addEventListener('beforeunload', () => {
        this.cleanup();
    });
}
    
    /**
     * Set up notification sound
     */
    setupNotificationSound() {
        try {
            // Create notification sound
            this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYrTp66hVFApGn+DyvmEaAzqM0+/ReigGHXNfY');
        } catch (error) {
            console.log('Could not create notification sound:', error);
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
        // Set up event listeners
        this.setupEventListeners();


        // Initialize notification system
        await this.initializeNotifications();


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


        chatListContainer.innerHTML = chats.map(chat => `
            <div class="chat-item" onclick="CLASSIFIED.openChat('${chat.name}', '${chat.avatar}', '${chat.userId}')">
                <div class="chat-avatar" style="background-image: url('${chat.avatar}')"></div>
                <div class="chat-details">
                    <div class="chat-name">${chat.name}</div>
                    <div class="chat-last-message">${chat.message}</div>
                </div>
                <div class="chat-meta">
                    <div class="chat-time">${chat.time}</div>
                </div>
            </div>
        `).join('');
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
        
        // Chat back button
        const chatBackBtn = document.getElementById('chatBackBtn');
        if (chatBackBtn) {
            chatBackBtn.addEventListener('click', () => this.closeChat());
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
     * Load chat list
     */
    async loadChats() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            console.log('💬 Loading chats for user:', currentUser.uid);
            
            const chatList = document.getElementById('chatList');
            if (!chatList) return;
            
            // Try to load real chats from Firebase first
            await this.loadRealChats(currentUser.uid);
            
            // Always show demo chats for testing
            const chats = this.mockData ? this.mockData.getChats() : [];
            
            // Only show demo chats if no real chats exist
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
                        
                     // Check unread status
                    const seenTime = localStorage.getItem(`seen_${chatDoc.id}_${userId}`);
                    const messageTime = chatData.lastMessageTime?.toMillis?.() || 0;
                    
                    // It's unread if: message is from other user AND we haven't seen it yet
                    const hasUnread = chatData.lastMessageSender && 
                                     chatData.lastMessageSender !== userId &&
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
                    
            // If we have real chats, update the UI
            if (realChats.length > 0) {
                console.log(`✅ Updating UI with ${realChats.length} real chats`);
                this.updateChatList(realChats);
            }
            
              } catch (error) {
            if (error.code?.includes('permission')) {
                handleSecurityError(error);
            }
            console.error('❌ Error loading real chats:', error);
        }
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
            // Update UI immediately for better UX
            document.getElementById('chatName').textContent = name;
            document.getElementById('chatAvatar').style.backgroundImage = `url('${avatar}')`;
            
            // Store current chat context
            this.currentChatPartner = { name, avatar, userId };
            this.state.set('currentChatUser', this.currentChatPartner);


            // Generate chat ID (alphabetically sorted user IDs)
            const chatId = this.generateChatId(currentUser.uid, userId);
            this.currentChatId = chatId;
            
            document.dispatchEvent(new CustomEvent('chatOpened', { 
                detail: { chatId: chatId, partnerId: userId }
            }));


            // Mark this chat as seen
            this.unreadMessages.delete(chatId);
            localStorage.setItem(`seen_${chatId}_${currentUser.uid}`, Date.now().toString());
            this.saveUnreadStateToStorage();
            this.updateTotalUnreadCount();
            // setTimeout(() => this.loadChats(), 100); COMMENT OUT TO TEST - CRASHING
            
            console.log('💬 Chat ID:', chatId);
            
            // Show chat screen
            this.navigationManager.showOverlay('individualChat');
            
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
     * Close chat
     */
        closeChat() {
        console.log('🔙 Closing chat');
        document.dispatchEvent(new CustomEvent('chatClosed'));
        this.navigationManager.closeOverlay('individualChat');
        
        // CHANGED: Use new tracking system
        if (this.currentChatId) {
            this.unregisterListener(`chat_${this.currentChatId}`);
        }
        
        this.currentChatId = null;
        this.currentChatPartner = null;
        this.state.set('currentChatUser', null);
    }
    
      /**
     * Send message with proper sanitization
     */
    async sendMessage() {
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
                timeElement.textContent = timeStr;
                messageElement.appendChild(timeElement);
            }
            
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
   /**
 * FIXED: Enhanced real-time message listener with proper notifications
 */
    listenToChatMessages(chatId) {
        // CHANGED: Use new tracking system
        this.unregisterListener(`chat_${chatId}`);
        
        const currentUser = this.state.get('currentUser');
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        try {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messages = [];
                let newMessageCount = 0;
                
                snapshot.forEach(messageDoc => {
                    messages.push({ id: messageDoc.id, ...messageDoc.data() });
                });
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        
                        if (message.senderId !== currentUser.uid) {
                            newMessageCount++;
                            this.playNotificationSound();
                            
                            if (!this.isAppVisible) {
                                this.showBrowserNotification(message);
                            }
                            
                            if (this.currentChatId !== chatId) {
                                this.updateUnreadCount(chatId, 1);
                            } else if (!this.isAppVisible) {
                                this.updateUnreadCount(chatId, 1);
                            }
                        }
                    }
                });
    
                this.displayMessages(messages, currentUser.uid);
                
                if (this.currentChatId === chatId && this.isAppVisible && newMessageCount > 0) {
                    this.markChatAsRead(chatId);
                }
                
            }, (error) => {
                console.error('❌ Error in chat listener:', error);
                this.unregisterListener(`chat_${chatId}`); // ADDED: Cleanup on error
            });
            
            // ADDED: Register with tracking
            this.registerListener(`chat_${chatId}`, unsubscribe, 'chat');
            console.log('👂 Set up real-time listener for chat:', chatId);
            
        } catch (error) {
            console.error('Error setting up chat listener:', error);
        }
    }
    
   /**
 * Listen for new matches (FIXED to prevent showing old matches)
 */
    listenForMatches(userId) {
        // ADDED: Remove existing listener first
        this.unregisterListener('matches_global');
        
        try {
            const matchesRef = collection(this.db, 'matches');
            const q = query(
                matchesRef,
                where('users', 'array-contains', userId)
            );
            
            let isInitialLoad = true;
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    console.log(`👂 Found ${snapshot.size} existing matches, not showing popups`);
                    
                    snapshot.forEach(doc => {
                        const matchId = doc.id;
                        this.seenMatches = this.seenMatches || new Set();
                        this.seenMatches.add(matchId);
                    });
                    return;
                }
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const matchId = change.doc.id;
                        const matchData = change.doc.data();
                        
                        this.seenMatches = this.seenMatches || new Set();
                        if (!this.seenMatches.has(matchId)) {
                            this.seenMatches.add(matchId);
                            
                            const matchTime = matchData.timestamp?.toDate?.() || new Date();
                            const now = new Date();
                            const timeDiff = now - matchTime;
                            
                            if (timeDiff < 30000) {
                                console.log('🎉 New match detected!', matchId);
                                this.handleNewMatch(matchData);
                            } else {
                                console.log('⏭️ Skipping old match popup:', matchId);
                            }
                        }
                    }
                });
                
                this.saveSeenMatches(); // ADDED: Save after processing
                
            }, (error) => {
                console.error('Error in match listener:', error);
                this.unregisterListener('matches_global'); // ADDED: Cleanup on error
            });
            
            // ADDED: Register with tracking
            this.registerListener('matches_global', unsubscribe, 'match');
            console.log('👂 Set up match listener for user:', userId);
            
        } catch (error) {
            console.error('Error setting up match listener:', error);
        }
    }
    
    // Add this method to save seen matches to localStorage:
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
    // ADDED: Remove existing listener first
    this.unregisterListener('chat_updates_global');
    
    try {
        const chatsRef = collection(this.db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', userId)
        );
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            console.log('🔄 Chat updates detected');
            
            for (const change of snapshot.docChanges()) {
                if (change.type === 'modified') {
                    const chatData = change.doc.data();
                    const chatId = change.doc.id;
                    
                    if (chatData.lastMessageSender && 
                        chatData.lastMessageSender !== userId &&
                        this.currentChatId !== chatId) {
                        
                        const currentUnread = this.unreadMessages.get(chatId) || 0;
                        this.unreadMessages.set(chatId, currentUnread + 1);
                    }
                    this.saveUnreadStateToStorage();
                }
            }
            
            await this.loadChats();
            this.updateTotalUnreadCount();
            
        }, (error) => {
             if (error.code?.includes('permission')) {
                console.error('Permission error:', error);
            }
            console.error('Error in chat updates listener:', error);
            this.unregisterListener('chat_updates_global'); // ADDED: Cleanup on error
        });
        
        // ADDED: Register with tracking
        this.registerListener('chat_updates_global', unsubscribe, 'chat_update');
        console.log('👂 Set up chat updates listener for user:', userId);
        
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
            notification.innerHTML = `💬 New message: ${chatData.lastMessage}`;
            
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
        console.log('🎉 Creating match between', userId1, 'and', userId2);
        
        const matchData = {
            users: [userId1, userId2].sort(), // Sort for consistency
            timestamp: serverTimestamp(),
            status: 'active',
            createdBy: 'system', // or userId1 if user-initiated
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
 * NEW: Check if two users have mutual likes (for match detection)
 */
async checkMutualLikes(userId1, userId2) {
    try {
        // Check if user1 liked user2
        const like1Doc = await getDoc(doc(this.db, 'likes', `${userId1}_${userId2}`));
        
        // Check if user2 liked user1
        const like2Doc = await getDoc(doc(this.db, 'likes', `${userId2}_${userId1}`));
        
        return like1Doc.exists() && like2Doc.exists();
    } catch (error) {
        console.error('Error checking mutual likes:', error);
        return false;
    }
}


/**
 * ENHANCED: Better match detection when processing likes
 */
async processLikeAction(fromUserId, toUserId, type = 'like') {
    try {
        // Record the like
        const likeId = `${fromUserId}_${toUserId}`;
        await setDoc(doc(this.db, 'likes', likeId), {
            fromUserId,
            toUserId,
            timestamp: serverTimestamp(),
            type: type // 'like' or 'superlike'
        });
        
        console.log(`✅ ${type} recorded:`, likeId);
        
        // Check for mutual likes
        const isMutual = await this.checkMutualLikes(fromUserId, toUserId);
        
        if (isMutual) {
            // Create match
            const matchId = await this.createMatch(fromUserId, toUserId);
            
            // Trigger match popup for current user
            this.triggerMatchPopup(fromUserId, toUserId);
            
            return { isMatch: true, matchId };
        }
        
        return { isMatch: false };
        
    } catch (error) {
        console.error('Error processing like action:', error);
        throw error;
    }
}


/**
 * NEW: Trigger match popup
 */
async triggerMatchPopup(currentUserId, matchedUserId) {
    try {
        // Get matched user data
        const matchedUserDoc = await getDoc(doc(this.db, 'users', matchedUserId));
        
        if (matchedUserDoc.exists()) {
            const userData = matchedUserDoc.data();
            
            // Store matched user data
            this.state.set('lastMatchedUser', {
                id: matchedUserId,
                name: userData.name,
                avatar: userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100'
            });
            
            // Show match popup
            const matchPopup = document.getElementById('matchPopup');
            if (matchPopup) {
                matchPopup.classList.add('show');
                
                // Update popup content
                const popupText = matchPopup.querySelector('p');
                if (popupText) {
                    popupText.textContent = `You and ${userData.name} both liked each other`;
                }
                
                // Auto-close after 10 seconds
                setTimeout(() => {
                    if (matchPopup.classList.contains('show')) {
                        matchPopup.classList.remove('show');
                    }
                }, 10000);
            }
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
 * NEW: Initialize notification system properly
 */
async initializeNotifications() {
    console.log('🔔 Initializing notification system...');
    
    // Request notification permission
    await this.requestNotificationPermission();
    
    // Set up notification sound
    this.setupNotificationSound();
    
    // Load unread message counts
    await this.loadUnreadCounts();
    
    // Set up periodic cleanup
    this.setupNotificationCleanup();
}


/**
 * NEW: Load unread message counts from storage
 */
 async loadUnreadCounts() {
    const currentUser = this.state.get('currentUser');
    if (!currentUser) return;
    
    console.log('📊 Loading unread message counts...');
    
    try {
        // Get all chats for current user
        const chatsQuery = query(
            collection(this.db, 'chats'),
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const chatsSnapshot = await getDocs(chatsQuery);
        let totalUnread = 0;
        
        for (const chatDoc of chatsSnapshot.docs) {
            const chatId = chatDoc.id;
            const chatData = chatDoc.data();
            
            // Quick check: if last message is from other user and recent
            if (chatData.lastMessageSender && 
                chatData.lastMessageSender !== currentUser.uid &&
                chatData.lastMessageTime) {
                
                // For now, assume it's unread if it's from the other user
                // In production, you'd track read status properly
                this.unreadMessages.set(chatId, 1);
                totalUnread++;
            }
        }
        
        // Update notification display
        if (totalUnread > 0) {
            console.log(`📌 Found ${totalUnread} unread messages`);
            this.showNotificationDot(totalUnread);
        }
        
    } catch (error) {
        console.error('Error loading unread counts:', error);
    }
}


/**
 * ENHANCED: Show notification dot with count
 */
showNotificationDot(count = null) {
    const notificationDot = document.getElementById('messageNotificationDot');
    const countBadge = document.getElementById('unreadCountBadge');
    const socialTab = document.querySelector('.social-tab[data-tab="messaging"]');
    
    // Ensure the tab is positioned relatively
    if (socialTab) {
        socialTab.style.position = 'relative';
    }
    
    if (count && count > 0) {
        // Show count badge instead of dot for specific counts
        if (notificationDot) {
            notificationDot.style.display = 'none';
        }
        if (countBadge) {
            countBadge.style.display = 'flex';
            countBadge.textContent = count > 99 ? '99+' : count.toString();
            countBadge.style.position = 'absolute';
            countBadge.style.top = '4px';
            countBadge.style.right = '4px';
        }
    } else {
        // Show just the dot
        if (notificationDot) {
            notificationDot.style.display = 'block';
            notificationDot.style.position = 'absolute';
            notificationDot.style.top = '8px';
            notificationDot.style.right = '8px';
        }
        if (countBadge) {
            countBadge.style.display = 'none';
        }
    }
    
    console.log('💬 Showing message notification', count ? `(${count})` : '(dot)');
}
    
/**
 * ENHANCED: Hide notification dot
 */
hideNotificationDot() {
    const notificationDot = document.getElementById('messageNotificationDot');
    const countBadge = document.getElementById('unreadCountBadge');
    
    if (notificationDot) notificationDot.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    
    console.log('💬 Hiding message notification');
}


    /**
 * Clear all notifications when messaging tab is opened
 */
clearNotificationsForMessagingTab() {
    // Only clear the main tab notification, not individual chat unreads
    const notificationDot = document.getElementById('messageNotificationDot');
    const countBadge = document.getElementById('unreadCountBadge');
    
    if (notificationDot) notificationDot.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    
    console.log('💬 Cleared messaging tab notifications');
}


/**
 * FIXED: Enhanced in-app notification system
 */
showInAppNotification(messageData, chatId) {
    // Don't show if already showing notification for this chat
    if (document.querySelector(`.chat-notification[data-chat-id="${chatId}"]`)) {
        return;
    }
    
    // Get partner info for notification
    this.getChatPartnerInfo(chatId).then(partnerInfo => {
        const notification = document.createElement('div');
        notification.className = 'chat-notification';
        notification.setAttribute('data-chat-id', chatId);
        notification.setAttribute('data-created', Date.now().toString());
        notification.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; 
                        background: rgba(0,212,255,0.95); color: white; 
                        padding: 16px 20px; border-radius: 12px; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        max-width: 300px; z-index: 1000;
                        animation: slideInRight 0.3s ease; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; 
                                background-image: url('${partnerInfo.avatar}');
                                background-size: cover; background-position: center;
                                flex-shrink: 0;"></div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; margin-bottom: 2px;">
                            ${partnerInfo.name}
                        </div>
                        <div style="font-size: 14px; opacity: 0.9; 
                                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${messageData.text}
                        </div>
                    </div>
                </div>
                <div style="position: absolute; top: 8px; right: 8px; 
                            width: 20px; height: 20px; cursor: pointer;
                            display: flex; align-items: center; justify-content: center;"
                     onclick="event.stopPropagation(); this.parentElement.parentElement.remove();">
                    ×
                </div>
            </div>
        `;
        
        // Click to open chat
        notification.onclick = () => {
            this.openChatFromNotification(chatId, partnerInfo);
            notification.remove();
        };
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    });
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
    
    // Calculate total unread
    const totalUnread = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
    
    // Always show notification if there are unread messages
    if (totalUnread > 0) {
        this.showNotificationDot(totalUnread);
        
        // Make sure the dot stays visible even when switching tabs
        const checkAndShowDot = () => {
            const dot = document.getElementById('messageNotificationDot');
            const badge = document.getElementById('unreadCountBadge');
            if (totalUnread > 0 && (!dot || dot.style.display === 'none') && (!badge || badge.style.display === 'none')) {
                this.showNotificationDot(totalUnread);
            }
        };
        
        // Check periodically to ensure dot stays visible
        setTimeout(checkAndShowDot, 100);
        setTimeout(checkAndShowDot, 500);
    } else {
        this.hideNotificationDot();
    }
    
    // Update chat list UI with unread indicators
    this.updateChatListUnreadIndicators();
    // Save to localStorage
    this.saveUnreadStateToStorage();


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
    this.saveUnreadStateToStorage(); // ADD THIS LINE
    this.lastSeenMessages.set(chatId, Date.now());
    
    // Update total unread count
    const totalUnread = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
    if (totalUnread === 0) {
        this.hideNotificationDot();
    }
    
    // Update notification display
    this.updateNotificationState();
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
 * NEW: Update favicon with unread count
 */
updateFaviconWithCount(count) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // Draw red circle
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(16, 16, 16, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw count text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 9 ? '9+' : count.toString(), 16, 16);
        
        // Update favicon
        let favicon = document.querySelector('link[rel="icon"]');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = canvas.toDataURL();
        
    } catch (error) {
        console.log('Could not update favicon:', error);
    }
}


/**
 * NEW: Reset favicon to default
 */
resetFavicon() {
    try {
        let favicon = document.querySelector('link[rel="icon"]');
        if (favicon) {
            favicon.href = '/favicon.ico'; // Update with your default favicon path
        }
    } catch (error) {
        console.log('Could not reset favicon:', error);
    }
}


/**
 * NEW: Set up notification cleanup (remove old notifications)
 */
setupNotificationCleanup() {
    setInterval(() => {
        // Clean up old in-app notifications
        const notifications = document.querySelectorAll('.chat-notification');
        const now = Date.now();
        
        notifications.forEach(notification => {
            const created = parseInt(notification.dataset.created) || now;
            if (now - created > 30000) { // 30 seconds
                notification.remove();
            }
        });
    }, 10000); // Check every 10 seconds
}


/**
 * ENHANCED: Better notification sound setup
 */
setupNotificationSound() {
    try {
        // Create a more pleasant notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Store for later use
        this.audioContext = audioContext;
        
        // Create notification sound blob
        const notificationSoundData = this.generateNotificationTone();
        const blob = new Blob([notificationSoundData], { type: 'audio/wav' });
        this.notificationSound = new Audio(URL.createObjectURL(blob));
        this.notificationSound.volume = 0.3; // Gentle volume
        
    } catch (error) {
        console.log('Could not create advanced notification sound, using fallback:', error);
        // Fallback to simple beep
        this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYrTp66hVFApGn+DyvmEaAzqM0+/ReigGHXM=');
    }
}


/**
 * NEW: Generate pleasant notification tone
 */
generateNotificationTone() {
    // Generate a pleasant two-tone notification sound
    const sampleRate = 44100;
    const duration = 0.3;
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(samples * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        const frequency1 = 800; // First tone
        const frequency2 = 600; // Second tone
        
        let sample = 0;
        if (t < 0.15) {
            sample = Math.sin(2 * Math.PI * frequency1 * t) * 0.3;
        } else {
            sample = Math.sin(2 * Math.PI * frequency2 * t) * 0.3;
        }
        
        // Apply envelope to avoid clicks
        const envelope = Math.sin(Math.PI * t / duration);
        sample *= envelope;
        
        // Convert to 16-bit PCM
        const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        view.setInt16(i * 2, intSample, true);
    }
    
    return buffer;
}


/**
 * ENHANCED: Smart notification timing
 */
shouldShowNotification(messageData, chatId) {
    const currentUser = this.state.get('currentUser');
    
    // Don't notify for own messages
    if (messageData.senderId === currentUser?.uid) {
        return false;
    }
    
    // Don't notify if chat is currently open and app is visible
    if (this.currentChatId === chatId && this.isAppVisible) {
        return false;
    }
    
    // Check if we recently showed a notification for this chat
    const lastNotificationTime = this.lastNotificationTimes?.get(chatId) || 0;
    const now = Date.now();
    
    if (now - lastNotificationTime < 5000) { // 5 second cooldown
        return false;
    }
    
    this.lastNotificationTimes = this.lastNotificationTimes || new Map();
    this.lastNotificationTimes.set(chatId, now);
    
    return true;
}


/**
 * FIXED: Enhanced browser notification
 */
async showBrowserNotification(messageData) {
    if (Notification.permission !== 'granted') return;
    
    try {
        const partnerInfo = await this.getChatPartnerInfo(this.currentChatId);
        
        const notification = new Notification(`New message from ${partnerInfo.name}`, {
            body: messageData.text,
            icon: partnerInfo.avatar || '/favicon.ico',
            tag: 'chat-message', // Replaces previous notifications
            requireInteraction: false,
            silent: false
        });
        
        notification.onclick = () => {
            window.focus();
            this.openChatFromNotification(this.currentChatId, partnerInfo);
            notification.close();
        };
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
        
    } catch (error) {
        console.error('Error showing browser notification:', error);
    }
}


/**
 * FIXED: Enhanced notification sound
 */
playNotificationSound() {
    try {
        if (this.notificationSound) {
            // Reset and play
            this.notificationSound.currentTime = 0;
            this.notificationSound.play().catch(e => {
                console.log('Could not play notification sound:', e);
            });
        }
    } catch (error) {
        console.log('Error playing notification sound:', error);
    }
}


    /**
     * Cleanup on destroy
     */
   /**
 * ENHANCED: Cleanup on destroy with better resource management
 */
    cleanup() {
        console.log('🧹 Cleaning up messaging listeners and resources');
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
        this.activeListeners.clear();
        
        // 2. Legacy cleanup for backwards compatibility
        this.chatListeners.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                console.error('Error unsubscribing from chat listener:', error);
            }
        });
        this.chatListeners.clear();
        
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
        
        // 5. Clear notification state
        this.unreadMessages.clear();
        this.lastSeenMessages.clear();
        this.lastNotificationTimes.clear();
        this.notificationQueue = [];
        
        // 6. Remove notification elements
        document.querySelectorAll('.chat-notification').forEach(el => el.remove());
        
        // 7. Reset UI
        document.title = 'CLASSIFIED - Hoi An Social Discovery';
        this.resetFavicon();
        this.hideNotificationDot();
        
        console.log('✅ Messaging cleanup complete');
        console.log(`📊 Active listeners after cleanup: ${this.activeListeners.size}`);
    }
    
/**
     * Show notification dot on messaging tab
     */
    showNotificationDot() {
        const notificationDot = document.getElementById('messageNotificationDot');
        if (notificationDot) {
            notificationDot.style.display = 'block';
            console.log('💬 Showing message notification dot');
        }
    }


    /**
     * Hide notification dot
     */
    hideNotificationDot() {
        const notificationDot = document.getElementById('messageNotificationDot');
        if (notificationDot) {
            notificationDot.style.display = 'none';
            console.log('💬 Hiding message notification dot');
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
    
    try {
        console.log('📤 Sending promotion message:', promoData.businessName);
        
        // Create message document with promotion data
        const messageData = {
            text: `Check out this special from ${promoData.businessName}!`,
            type: 'promotion',
            promotion: promoData,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            timestamp: serverTimestamp(),
            read: false
        };
        
        // Add promotion UI to chat immediately
        this.addPromotionToUI(promoData);
        
        // Add to messages subcollection
        await addDoc(collection(this.db, 'chats', this.currentChatId, 'messages'), messageData);
        
        // Update chat document
        await updateDoc(doc(this.db, 'chats', this.currentChatId), {
            lastMessage: `📍 Shared ${promoData.businessName}`,
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
        `;
        promoCard.onclick = () => window.CLASSIFIED.openBusinessProfile(promoData.businessId, 'restaurant');
        
        // Business header with image
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
        
        const imageDiv = document.createElement('div');
        imageDiv.style.cssText = `
            width: 50px; height: 50px; border-radius: 8px; 
            background-image: url('${escapeHtml(promoData.businessImage)}');
            background-size: cover; background-position: center;
        `;
        
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'flex: 1;';
        
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-weight: 700; font-size: 14px; margin-bottom: 2px;';
        nameDiv.textContent = promoData.businessName;
        
        const typeDiv = document.createElement('div');
        typeDiv.style.cssText = 'font-size: 12px; opacity: 0.9;';
        typeDiv.textContent = promoData.businessType;
        
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(typeDiv);
        headerDiv.appendChild(imageDiv);
        headerDiv.appendChild(infoDiv);
        
        // Promo content
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px;';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'promo-title';
        titleDiv.style.cssText = 'font-weight: 700; margin-bottom: 5px;';
        titleDiv.textContent = `🎉 ${promoData.promotionTitle}`;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'promo-details';
        detailsDiv.style.cssText = 'font-size: 12px; opacity: 0.9;';
        detailsDiv.textContent = promoData.promotionDetails;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(detailsDiv);
        
        // Address
        const addressDiv = document.createElement('div');
        addressDiv.style.cssText = 'margin-top: 10px; font-size: 11px; opacity: 0.8;';
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
}
