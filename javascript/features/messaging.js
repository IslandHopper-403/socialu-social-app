// javascript/features/messaging.js - REWRITTEN VERSION

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
 * Messaging Manager - REWRITTEN VERSION
 * Clean notification system with proper state management
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
        this.chatListeners = new Map();
        this.matchListener = null;
        this.chatsListener = null;
        
        // Current chat context
        this.currentChatId = null;
        this.currentChatPartner = null;
        
        // SIMPLIFIED: Single source of truth for notifications
        this.chatStates = new Map(); // chatId -> { unreadCount, lastMessageTime, lastSeenTime }
        
        // Track app visibility
        this.isAppVisible = !document.hidden;
        document.addEventListener('visibilitychange', () => {
            this.isAppVisible = !document.hidden;
            if (this.isAppVisible && this.currentChatId) {
                this.markChatAsRead(this.currentChatId);
            }
        });
        
        // Notification sound
        this.notificationSound = null;
        this.setupNotificationSound();
        
        // Track seen matches
        this.seenMatches = new Set(JSON.parse(localStorage.getItem('seenMatches') || '[]'));
    }
    
    /**
     * Set up notification sound
     */
    setupNotificationSound() {
        try {
            this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYrTp66hVFApGn+DyvmEaAzqM0+/ReigGHXNfY');
            this.notificationSound.volume = 0.3;
        } catch (error) {
            console.log('Could not create notification sound:', error);
        }
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
        
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
        
        // Request notification permission
        await this.requestNotificationPermission();
        
        // Load persisted state
        this.loadPersistedState();
        
        // Initialize if authenticated
        if (this.state.get('isAuthenticated')) {
            await this.initializeUserMessaging();
        }
    }
    
    /**
     * Initialize messaging for authenticated user
     */
    async initializeUserMessaging() {
        try {
            await this.loadMatches();
            await this.loadChats();
            this.setupRealtimeListeners();
        } catch (error) {
            console.error('Error initializing messaging:', error);
        }
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
     * SIMPLIFIED: Load persisted state
     */
    loadPersistedState() {
        try {
            const savedStates = localStorage.getItem('chatStates');
            if (savedStates) {
                const parsed = JSON.parse(savedStates);
                Object.entries(parsed).forEach(([chatId, state]) => {
                    this.chatStates.set(chatId, state);
                });
                console.log('📚 Loaded chat states:', this.chatStates.size);
            }
        } catch (error) {
            console.error('Error loading persisted state:', error);
        }
    }
    
    /**
     * SIMPLIFIED: Save state to localStorage
     */
    savePersistedState() {
        try {
            const stateObj = {};
            this.chatStates.forEach((state, chatId) => {
                // Only save if there are unread messages
                if (state.unreadCount > 0) {
                    stateObj[chatId] = state;
                }
            });
            localStorage.setItem('chatStates', JSON.stringify(stateObj));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }
    
    /**
     * Set up real-time listeners
     */
    setupRealtimeListeners() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        console.log('👂 Setting up real-time listeners...');
        
        this.listenForMatches(currentUser.uid);
        this.listenForChats(currentUser.uid);
    }
    
    /**
     * Load matches
     */
    async loadMatches() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            const matchesContainer = document.getElementById('matchesScroll');
            if (!matchesContainer) return;
            
            const realMatches = await this.loadRealMatches(currentUser.uid);
            
            if (realMatches.length > 0) {
                matchesContainer.innerHTML = realMatches.map(match => `
                    <div class="match-avatar" 
                         style="background-image: url('${match.avatar}')"
                         onclick="CLASSIFIED.openChat('${match.name}', '${match.avatar}', '${match.userId}')">
                    </div>
                `).join('');
            } else {
                // Show demo matches
                const matches = this.mockData ? this.mockData.getUsers().slice(0, 5) : [];
                matchesContainer.innerHTML = matches.map(user => `
                    <div class="match-avatar" 
                         style="background-image: url('${user.image}')"
                         onclick="CLASSIFIED.openChat('${user.name}', '${user.image}', '${user.uid}')">
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading matches:', error);
        }
    }
    
    /**
     * Load real matches from Firebase
     */
    async loadRealMatches(userId) {
        const matches = [];
        
        try {
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
                        console.error('Error getting partner data:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading matches:', error);
        }
        
        return matches;
    }
    
    /**
     * SIMPLIFIED: Load and display chats
     */
    async loadChats() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            const chatList = document.getElementById('chatList');
            if (!chatList) return;
            
            // Load real chats
            const realChats = await this.loadRealChats(currentUser.uid);
            
            if (realChats.length > 0) {
                this.updateChatList(realChats);
            } else {
                // Show demo chats
                const demoChats = this.mockData ? this.mockData.getChats() : [];
                chatList.innerHTML = demoChats.map(chat => `
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
            
            this.updateNotificationDisplay();
            
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }
    
    /**
     * SIMPLIFIED: Load real chats from Firebase
     */
    async loadRealChats(userId) {
        const realChats = [];
        
        try {
            const q = query(
                collection(this.db, 'chats'),
                where('participants', 'array-contains', userId),
                limit(20)
            );
            
            const snapshot = await getDocs(q);
            
            for (const chatDoc of snapshot.docs) {
                const chatData = chatDoc.data();
                const partnerId = chatData.participants.find(id => id !== userId);
                
                if (partnerId) {
                    try {
                        const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
                        if (partnerDoc.exists()) {
                            const partnerData = partnerDoc.data();
                            
                            // Get or create chat state
                            let chatState = this.chatStates.get(chatDoc.id);
                            if (!chatState) {
                                chatState = {
                                    unreadCount: 0,
                                    lastMessageTime: 0,
                                    lastSeenTime: 0
                                };
                                this.chatStates.set(chatDoc.id, chatState);
                            }
                            
                            // Update message time
                            const messageTime = chatData.lastMessageTime?.toMillis?.() || 0;
                            chatState.lastMessageTime = messageTime;
                            
                            // Check if unread (message is newer than last seen and not from us)
                            if (chatData.lastMessage && 
                                chatData.lastMessageSender !== userId &&
                                messageTime > chatState.lastSeenTime) {
                                if (chatState.unreadCount === 0) {
                                    chatState.unreadCount = 1;
                                }
                            }
                            
                            realChats.push({
                                id: chatDoc.id,
                                partnerId: partnerId,
                                partnerName: partnerData.name,
                                partnerAvatar: partnerData.photos?.[0] || partnerData.photo || 'https://via.placeholder.com/100',
                                lastMessage: chatData.lastMessage || 'No messages yet',
                                lastMessageTime: chatData.lastMessageTime,
                                unreadCount: chatState.unreadCount
                            });
                        }
                    } catch (error) {
                        console.error('Error getting partner data:', error);
                    }
                }
            }
            
            // Save updated state
            this.savePersistedState();
            
        } catch (error) {
            console.error('Error loading real chats:', error);
        }
        
        return realChats;
    }
    
    /**
     * Update chat list UI
     */
    updateChatList(chats) {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;
        
        // Sort by unread status and time
        chats.sort((a, b) => {
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
            
            const aTime = a.lastMessageTime?.toDate?.() || new Date(0);
            const bTime = b.lastMessageTime?.toDate?.() || new Date(0);
            return bTime - aTime;
        });
        
        chatList.innerHTML = chats.map(chat => {
            const timeAgo = chat.lastMessageTime ? this.getTimeAgo(chat.lastMessageTime) : 'New';
            
            return `
                <div class="chat-item" data-chat-id="${chat.id}" onclick="CLASSIFIED.openChat('${chat.partnerName}', '${chat.partnerAvatar}', '${chat.partnerId}')">
                    <div class="chat-avatar" style="background-image: url('${chat.partnerAvatar}')"></div>
                    <div class="chat-info">
                        <div class="chat-name">${chat.partnerName}</div>
                        <div class="chat-message" ${chat.unreadCount > 0 ? 'style="font-weight: 600;"' : ''}>${chat.lastMessage}</div>
                    </div>
                    <div class="chat-time">${timeAgo}</div>
                    ${chat.unreadCount > 0 ? `<div class="chat-unread-count">${chat.unreadCount > 9 ? '9+' : chat.unreadCount}</div>` : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * SIMPLIFIED: Open chat
     */
    async openChat(name, avatar, userId) {
        console.log(`💬 Opening chat with ${name}`);
        
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            alert('Please login to chat');
            return;
        }
        
        try {
            // Update UI
            document.getElementById('chatName').textContent = name;
            document.getElementById('chatAvatar').style.backgroundImage = `url('${avatar}')`;
            
            // Store context
            this.currentChatPartner = { name, avatar, userId };
            this.state.set('currentChatUser', this.currentChatPartner);
            
            // Generate chat ID
            const chatId = this.generateChatId(currentUser.uid, userId);
            this.currentChatId = chatId;
            
            // Mark as read
            this.markChatAsRead(chatId);
            
            // Show chat screen
            this.navigationManager.showOverlay('individualChat');
            
            // Load messages
            await this.loadChatMessages(chatId);
            
            // Set up real-time listener
            this.listenToChatMessages(chatId);
            
            // Ensure chat exists
            await this.ensureChatExists(chatId, currentUser.uid, userId);
            
        } catch (error) {
            console.error('Error opening chat:', error);
            alert('Failed to open chat. Please try again.');
        }
    }
    
    /**
     * SIMPLIFIED: Mark chat as read
     */
    markChatAsRead(chatId) {
        const chatState = this.chatStates.get(chatId);
        if (chatState) {
            chatState.unreadCount = 0;
            chatState.lastSeenTime = Date.now();
            this.chatStates.set(chatId, chatState);
            this.savePersistedState();
            this.updateNotificationDisplay();
        }
    }
    
    /**
     * Ensure chat document exists
     */
    async ensureChatExists(chatId, userId1, userId2) {
        try {
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            
            if (!chatDoc.exists()) {
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
        
        // Mark as read one more time
        if (this.currentChatId) {
            this.markChatAsRead(this.currentChatId);
            
            // Clean up listener
            if (this.chatListeners.has(this.currentChatId)) {
                const unsubscribe = this.chatListeners.get(this.currentChatId);
                unsubscribe();
                this.chatListeners.delete(this.currentChatId);
            }
        }
        
        this.navigationManager.closeOverlay('individualChat');
        
        this.currentChatId = null;
        this.currentChatPartner = null;
        this.state.set('currentChatUser', null);
        
        // Refresh chat list
        this.loadChats();
    }
    
    /**
     * Send message
     */
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        const currentUser = this.state.get('currentUser');
        if (!currentUser || !this.currentChatId || !this.currentChatPartner) {
            alert('Unable to send message. Please try again.');
            return;
        }
        
        try {
            // Clear input
            messageInput.value = '';
            
            // Add to UI immediately
            this.addMessageToUI({
                text: message,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'You',
                timestamp: new Date()
            }, true);
            
            // Save to Firebase
            const messageData = {
                text: message,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                timestamp: serverTimestamp(),
                read: false
            };
            
            await addDoc(collection(this.db, 'chats', this.currentChatId, 'messages'), messageData);
            
            // Update chat document
            await updateDoc(doc(this.db, 'chats', this.currentChatId), {
                lastMessage: message,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: currentUser.uid
            });
            
            console.log('✅ Message sent');
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
            messageInput.value = message;
        }
    }
    
    /**
     * Add message to UI
     */
    addMessageToUI(messageData, isOptimistic = false) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const currentUser = this.state.get('currentUser');
        const isSent = messageData.senderId === currentUser?.uid;
        const timeStr = messageData.timestamp ? this.formatMessageTime(messageData.timestamp) : 'Sending...';
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}${isOptimistic ? ' optimistic' : ''}`;
        messageElement.innerHTML = `
            <div class="message-bubble">${this.escapeHtml(messageData.text)}</div>
            ${timeStr ? `<div class="message-time">${timeStr}</div>` : ''}
        `;
        
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
            messagesContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            
            if (!chatDoc.exists()) {
                messagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; opacity: 0.7;">
                        <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
                        <div>Start a conversation with ${this.currentChatPartner.name}!</div>
                    </div>
                `;
                return;
            }
            
            const messagesRef = collection(this.db, 'chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            const snapshot = await getDocs(q);
            
            const messages = [];
            snapshot.forEach(messageDoc => {
                messages.push({ id: messageDoc.id, ...messageDoc.data() });
            });
            
            this.displayMessages(messages, currentUser.uid);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div>Unable to load messages</div>
                </div>
            `;
        }
    }
    
    /**
     * Display messages
     */
    displayMessages(messages, currentUserId) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
                    <div>No messages yet. Say hello!</div>
                </div>
            `;
            return;
        }
        
        messagesContainer.innerHTML = messages.map(msg => {
            const isSent = msg.senderId === currentUserId;
            const timeStr = msg.timestamp ? this.formatMessageTime(msg.timestamp.toDate()) : '';
            
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble">${this.escapeHtml(msg.text)}</div>
                    ${timeStr ? `<div class="message-time">${timeStr}</div>` : ''}
                </div>
            `;
        }).join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    /**
     * Listen to chat messages
     */
    listenToChatMessages(chatId) {
        if (this.chatListeners.has(chatId)) {
            const unsubscribe = this.chatListeners.get(chatId);
            unsubscribe();
        }
        
        const currentUser = this.state.get('currentUser');
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        try {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach(messageDoc => {
                    messages.push({ id: messageDoc.id, ...messageDoc.data() });
                });
                
                // Check for new messages from other user
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        if (message.senderId !== currentUser.uid) {
                            // Play sound
                            if (this.notificationSound) {
                                this.notificationSound.play().catch(e => console.log('Could not play sound'));
                            }
                            
                            // Show browser notification if not visible
                            if (!this.isAppVisible) {
                                this.showBrowserNotification(message);
                            }
                        }
                    }
                });
                
                // Update display
                this.displayMessages(messages, currentUser.uid);
                
            }, (error) => {
                console.error('Error in chat listener:', error);
            });
            
            this.chatListeners.set(chatId, unsubscribe);
            
        } catch (error) {
            console.error('Error setting up chat listener:', error);
        }
    }
    
    /**
     * SIMPLIFIED: Listen for all chats updates
     */
    listenForChats(userId) {
        try {
            const q = query(
                collection(this.db, 'chats'),
                where('participants', 'array-contains', userId)
            );
            
            this.chatsListener = onSnapshot(q, async (snapshot) => {
                let needsUpdate = false;
                
                snapshot.docChanges().forEach(change => {
                    const chatId = change.doc.id;
                    const chatData = change.doc.data();
                    
                    if (change.type === 'modified') {
                        // Get or create chat state
                        let chatState = this.chatStates.get(chatId);
                        if (!chatState) {
                            chatState = {
                                unreadCount: 0,
                                lastMessageTime: 0,
                                lastSeenTime: 0
                            };
                            this.chatStates.set(chatId, chatState);
                        }
                        
                        const messageTime = chatData.lastMessageTime?.toMillis?.() || 0;
                        
                        // New message from other user
                        if (chatData.lastMessageSender && 
                            chatData.lastMessageSender !== userId &&
                            messageTime > chatState.lastMessageTime) {
                            
                            // Only increment if chat is not open
                            if (this.currentChatId !== chatId) {
                                chatState.unreadCount = 1; // Always 1, not accumulating
                                chatState.lastMessageTime = messageTime;
                                needsUpdate = true;
                                
                                // Show notification
                                this.showInAppNotification(chatData, chatId);
                            }
                        }
                    }
                });
                
                if (needsUpdate) {
                    this.savePersistedState();
                    await this.loadChats();
                }
                
            }, (error) => {
                console.error('Error in chats listener:', error);
            });
            
        } catch (error) {
            console.error('Error setting up chats listener:', error);
        }
    }
    
    /**
     * Listen for new matches
     */
    listenForMatches(userId) {
        try {
            const q = query(
                collection(this.db, 'matches'),
                where('users', 'array-contains', userId)
            );
            
            let isInitialLoad = true;
            
            this.matchListener = onSnapshot(q, (snapshot) => {
                if (isInitialLoad) {
                    isInitialLoad = false;
                    snapshot.forEach(doc => {
                        this.seenMatches.add(doc.id);
                    });
                    localStorage.setItem('seenMatches', JSON.stringify(Array.from(this.seenMatches)));
                    return;
                }
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const matchId = change.doc.id;
                        if (!this.seenMatches.has(matchId)) {
                            this.seenMatches.add(matchId);
                            localStorage.setItem('seenMatches', JSON.stringify(Array.from(this.seenMatches)));
                            
                            const matchData = change.doc.data();
                            const matchTime = matchData.timestamp?.toDate?.() || new Date();
                            const now = new Date();
                            
                            if (now - matchTime < 30000) {
                                this.handleNewMatch(matchData);
                            }
                        }
                    }
                });
            });
            
        } catch (error) {
            console.error('Error setting up match listener:', error);
        }
    }
    
    /**
     * Handle new match
     */
    async handleNewMatch(matchData) {
        try {
            const matchPopup = document.getElementById('matchPopup');
            if (matchPopup && !matchPopup.classList.contains('show')) {
                matchPopup.classList.add('show');
                
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
                        
                        const popupText = matchPopup.querySelector('p');
                        if (popupText) {
                            popupText.textContent = `You and ${partnerData.name} both liked each other`;
                        }
                    }
                }
                
                setTimeout(() => {
                    if (matchPopup.classList.contains('show')) {
                        matchPopup.classList.remove('show');
                    }
                }, 10000);
            }
        } catch (error) {
            console.error('Error handling new match:', error);
        }
    }
    
    /**
     * Start chat from match popup
     */
    startChatFromMatch() {
        const matchedUser = this.state.get('lastMatchedUser');
        if (matchedUser) {
            const matchPopup = document.getElementById('matchPopup');
            if (matchPopup) {
                matchPopup.classList.remove('show');
            }
            
            if (window.classifiedApp?.managers?.feed) {
                window.classifiedApp.managers.feed.switchSocialTab('messaging');
            }
            
            setTimeout(() => {
                this.openChat(matchedUser.name, matchedUser.avatar, matchedUser.id);
            }, 300);
        }
    }
    
    /**
     * Show in-app notification
     */
    async showInAppNotification(chatData, chatId) {
        if (document.querySelector(`.chat-notification[data-chat-id="${chatId}"]`)) {
            return;
        }
        
        const partnerInfo = await this.getChatPartnerInfo(chatId);
        
        const notification = document.createElement('div');
        notification.className = 'chat-notification';
        notification.setAttribute('data-chat-id', chatId);
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
                                background-size: cover; background-position: center;"></div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${partnerInfo.name}</div>
                        <div style="font-size: 14px; opacity: 0.9;">
                            ${chatData.lastMessage}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        notification.onclick = () => {
            this.openChatFromNotification(chatId, partnerInfo);
            notification.remove();
        };
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        if (this.notificationSound) {
            this.notificationSound.play().catch(e => console.log('Could not play sound'));
        }
    }
    
    /**
     * Get chat partner info
     */
    async getChatPartnerInfo(chatId) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser || !chatId) {
            return { name: 'Someone', avatar: '' };
        }
        
        try {
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            if (chatDoc.exists()) {
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
            }
        } catch (error) {
            console.error('Error getting chat partner info:', error);
        }
        
        return { name: 'Someone', avatar: '' };
    }
    
    /**
     * Open chat from notification
     */
    async openChatFromNotification(chatId, partnerInfo) {
        const feedManager = window.classifiedApp?.managers?.feed;
        if (feedManager) {
            feedManager.switchSocialTab('messaging');
        }
        
        await this.openChat(partnerInfo.name, partnerInfo.avatar, partnerInfo.id);
    }
    
    /**
     * Show browser notification
     */
    async showBrowserNotification(messageData) {
        if (Notification.permission !== 'granted') return;
        
        try {
            const partnerInfo = await this.getChatPartnerInfo(this.currentChatId);
            
            const notification = new Notification(`New message from ${partnerInfo.name}`, {
                body: messageData.text,
                icon: partnerInfo.avatar || '/favicon.ico',
                tag: 'chat-message',
                requireInteraction: false
            });
            
            notification.onclick = () => {
                window.focus();
                this.openChatFromNotification(this.currentChatId, partnerInfo);
                notification.close();
            };
            
            setTimeout(() => notification.close(), 5000);
            
        } catch (error) {
            console.error('Error showing browser notification:', error);
        }
    }
    
    /**
     * Update notification display
     */
    updateNotificationDisplay() {
        let totalUnread = 0;
        this.chatStates.forEach(state => {
            if (state.unreadCount > 0 && this.currentChatId !== state.chatId) {
                totalUnread += state.unreadCount;
            }
        });
        
        const notificationDot = document.getElementById('messageNotificationDot');
        const countBadge = document.getElementById('unreadCountBadge');
        const socialTab = document.querySelector('.social-tab[data-tab="messaging"]');
        
        if (socialTab) {
            socialTab.style.position = 'relative';
        }
        
        if (totalUnread > 0) {
            if (notificationDot) {
                notificationDot.style.display = 'none';
            }
            if (countBadge) {
                countBadge.style.display = 'flex';
                countBadge.textContent = totalUnread > 99 ? '99+' : totalUnread.toString();
            }
        } else {
            if (notificationDot) {
                notificationDot.style.display = 'none';
            }
            if (countBadge) {
                countBadge.style.display = 'none';
            }
        }
    }
    
    /**
     * Clear notifications for messaging tab
     */
    clearNotificationsForMessagingTab() {
        const notificationDot = document.getElementById('messageNotificationDot');
        const countBadge = document.getElementById('unreadCountBadge');
        
        if (notificationDot) notificationDot.style.display = 'none';
        if (countBadge) countBadge.style.display = 'none';
    }
    
    /**
     * Create a match
     */
    async createMatch(userId1, userId2) {
        try {
            const matchData = {
                users: [userId1, userId2].sort(),
                timestamp: serverTimestamp(),
                status: 'active'
            };
            
            const matchId = [userId1, userId2].sort().join('_');
            
            await setDoc(doc(this.db, 'matches', matchId), matchData);
            
            const chatId = matchId;
            await setDoc(doc(this.db, 'chats', chatId), {
                participants: [userId1, userId2].sort(),
                createdAt: serverTimestamp(),
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                lastMessageSender: null
            });
            
            return matchId;
            
        } catch (error) {
            console.error('Error creating match:', error);
            throw error;
        }
    }
    
    /**
     * Process like action
     */
    async processLikeAction(fromUserId, toUserId, type = 'like') {
        try {
            const likeId = `${fromUserId}_${toUserId}`;
            await setDoc(doc(this.db, 'likes', likeId), {
                fromUserId,
                toUserId,
                timestamp: serverTimestamp(),
                type: type
            });
            
            // Check for mutual likes
            const reciprocalLikeDoc = await getDoc(doc(this.db, 'likes', `${toUserId}_${fromUserId}`));
            
            if (reciprocalLikeDoc.exists()) {
                // It's a match!
                const matchId = await this.createMatch(fromUserId, toUserId);
                await this.triggerMatchPopup(fromUserId, toUserId);
                return { isMatch: true, matchId };
            }
            
            return { isMatch: false };
            
        } catch (error) {
            console.error('Error processing like:', error);
            throw error;
        }
    }
    
    /**
     * Trigger match popup
     */
    async triggerMatchPopup(currentUserId, matchedUserId) {
        try {
            const matchedUserDoc = await getDoc(doc(this.db, 'users', matchedUserId));
            
            if (matchedUserDoc.exists()) {
                const userData = matchedUserDoc.data();
                
                this.state.set('lastMatchedUser', {
                    id: matchedUserId,
                    name: userData.name,
                    avatar: userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100'
                });
                
                const matchPopup = document.getElementById('matchPopup');
                if (matchPopup) {
                    matchPopup.classList.add('show');
                    
                    const popupText = matchPopup.querySelector('p');
                    if (popupText) {
                        popupText.textContent = `You and ${userData.name} both liked each other`;
                    }
                    
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
     * Open chat with user
     */
    openChatWithUser(userName) {
        if (this.mockData) {
            const users = this.mockData.getUsers();
            const user = users.find(u => u.name === userName);
            if (user) {
                this.openChat(user.name, user.image, user.uid);
            }
        }
    }
    
    /**
     * Start chat with viewed user
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
            if (this.mockData) {
                const user = this.mockData.getUserById(this.currentChatPartner.userId);
                if (user) {
                    this.profileManager.openUserProfile(user);
                }
            }
        }
    }
    
    /**
     * Utility methods
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
     * Cleanup
     */
    cleanup() {
        console.log('🧹 Cleaning up messaging listeners');
        
        // Remove all chat listeners
        this.chatListeners.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                console.error('Error unsubscribing:', error);
            }
        });
        this.chatListeners.clear();
        
        // Remove global listeners
        if (this.matchListener) {
            this.matchListener();
        }
        
        if (this.chatsListener) {
            this.chatsListener();
        }
        
        // Clear state
        this.chatStates.clear();
        
        // Remove notifications
        document.querySelectorAll('.chat-notification').forEach(el => el.remove());
    }
}
