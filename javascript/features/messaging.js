// javascript/features/messaging.js - COMPLETE VERSION

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
    updateDoc
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
        this.chatListeners = new Map();
        this.matchListener = null;
        this.notificationListener = null;
        
        // Current chat context
        this.currentChatId = null;
        this.currentChatPartner = null;
        
        // Notification system
        this.notificationSound = null;
        this.setupNotificationSound();
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
        
        // Load initial data if authenticated
        if (this.state.get('isAuthenticated')) {
            try {
                await this.loadMatches();
                await this.loadChats();
                this.setupRealtimeListeners();
                this.requestNotificationPermission();
            } catch (error) {
                console.error('Error initializing messaging:', error);
            }
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
     * Set up real-time listeners
     */
    setupRealtimeListeners() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
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
                            realChats.push({
                                id: chatDoc.id,
                                partnerId: partnerId,
                                partnerName: partnerData.name,
                                partnerAvatar: partnerData.photos?.[0] || partnerData.photo || 'https://via.placeholder.com/100',
                                lastMessage: chatData.lastMessage || 'No messages yet',
                                lastMessageTime: chatData.lastMessageTime,
                                isNew: !chatData.lastMessage // Flag for new chats
                            });
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
        
        chatList.innerHTML = chats.map(chat => {
            const timeAgo = chat.lastMessageTime ? this.getTimeAgo(chat.lastMessageTime) : 'New';
            const messageText = chat.isNew ? 'Start a conversation!' : chat.lastMessage;
            
            return `
                <div class="chat-item" onclick="CLASSIFIED.openChat('${chat.partnerName}', '${chat.partnerAvatar}', '${chat.partnerId}')">
                    <div class="chat-avatar" style="background-image: url('${chat.partnerAvatar}')"></div>
                    <div class="chat-info">
                        <div class="chat-name">${chat.partnerName}</div>
                        <div class="chat-message">${messageText}</div>
                    </div>
                    <div class="chat-time">${timeAgo}</div>
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
        this.navigationManager.closeOverlay('individualChat');
        
        // Clean up listener
        if (this.currentChatId && this.chatListeners.has(this.currentChatId)) {
            const unsubscribe = this.chatListeners.get(this.currentChatId);
            unsubscribe();
            this.chatListeners.delete(this.currentChatId);
        }
        
        this.currentChatId = null;
        this.currentChatPartner = null;
        this.state.set('currentChatUser', null);
    }
    
    /**
     * Send message with proper error handling
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
            console.log('📤 Sending message:', message);
            
            // Clear input immediately for better UX
            messageInput.value = '';
            
            // Add message to UI immediately (optimistic update)
            this.addMessageToUI({
                text: message,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'You',
                timestamp: new Date(),
                read: false
            }, true);
            
            // Create message document
            const messageData = {
                text: message,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                timestamp: serverTimestamp(),
                read: false
            };
            
            // Add to messages subcollection
            await addDoc(collection(this.db, 'chats', this.currentChatId, 'messages'), messageData);
            
            // Update chat document
            await updateDoc(doc(this.db, 'chats', this.currentChatId), {
                lastMessage: message,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: currentUser.uid
            });
            
            console.log('✅ Message sent successfully');
            
            // Send notification to other user
            this.sendNotificationToUser(this.currentChatPartner.userId, {
                title: `New message from ${currentUser.displayName || 'Someone'}`,
                body: message,
                data: {
                    type: 'message',
                    chatId: this.currentChatId,
                    senderId: currentUser.uid
                }
            });
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            alert('Failed to send message. Please try again.');
            messageInput.value = message; // Restore message on error
            
            // Remove optimistic message from UI
            const messagesContainer = document.getElementById('chatMessages');
            const lastMessage = messagesContainer?.lastElementChild;
            if (lastMessage?.classList.contains('optimistic')) {
                lastMessage.remove();
            }
        }
    }
    
    /**
     * Add message to UI (for optimistic updates)
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
     * Display messages in chat
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
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    /**
     * Listen to chat messages in real-time
     */
    listenToChatMessages(chatId) {
        // Remove existing listener if any
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
                
                this.displayMessages(messages, currentUser.uid);
                
                // Play notification sound for new messages
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        if (message.senderId !== currentUser.uid && this.notificationSound) {
                            this.notificationSound.play().catch(e => console.log('Could not play sound:', e));
                        }
                    }
                });
            }, (error) => {
                console.error('❌ Error in chat listener:', error);
            });
            
            this.chatListeners.set(chatId, unsubscribe);
            console.log('👂 Set up real-time listener for chat:', chatId);
        } catch (error) {
            console.error('Error setting up chat listener:', error);
        }
    }
    
    /**
     * Listen for new matches
     */
    listenForMatches(userId) {
        try {
            const matchesRef = collection(this.db, 'matches');
            const q = query(
                matchesRef,
                where('users', 'array-contains', userId)
            );
            
            this.matchListener = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const matchData = change.doc.data();
                        // Handle new match
                        this.handleNewMatch(matchData);
                    }
                });
            }, (error) => {
                console.error('Error in match listener:', error);
            });
            
            console.log('👂 Set up match listener for user:', userId);
        } catch (error) {
            console.error('Error setting up match listener:', error);
        }
    }
    
    /**
     * Listen for chat updates
     */
    listenForChatUpdates(userId) {
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            onSnapshot(q, (snapshot) => {
                console.log('🔄 Chat updates detected, refreshing chat list');
                this.loadChats(); // Reload chat list when updates occur
            }, (error) => {
                console.error('Error in chat updates listener:', error);
            });
            
            console.log('👂 Set up chat updates listener for user:', userId);
        } catch (error) {
            console.error('Error setting up chat updates listener:', error);
        }
    }
    
    /**
     * Listen for new messages globally (for notifications)
     */
    listenForNewMessages(userId) {
        try {
            // This is a simplified approach - in production you'd want a more efficient solution
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            this.notificationListener = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified') {
                        const chatData = change.doc.data();
                        // Check if there's a new message not from current user
                        if (chatData.lastMessageSender && chatData.lastMessageSender !== userId) {
                            this.showInAppNotification(chatData);
                        }
                    }
                });
            }, (error) => {
                console.error('Error in global message listener:', error);
            });
            
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
    }
    
    /**
     * Start chat from match popup
     */
    startChatFromMatch() {
        const matchedUser = this.state.get('lastMatchedUser');
        if (matchedUser) {
            this.openChat(matchedUser.name, matchedUser.avatar, matchedUser.id);
        }
        
        // Hide match popup
        const matchPopup = document.getElementById('matchPopup');
        if (matchPopup) {
            matchPopup.classList.remove('show');
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
    async createMatch(userId1, userId2) {
        try {
            const matchData = {
                users: [userId1, userId2].sort(), // Sort for consistency
                timestamp: serverTimestamp(),
                status: 'active'
            };
            
            // Use sorted IDs as document ID
            const matchId = `${userId1}_${userId2}`.split('_').sort().join('_');
            
            await setDoc(doc(this.db, 'matches', matchId), matchData);
            console.log('🎉 Match created:', matchId);
            
            return matchId;
        } catch (error) {
            console.error('Error creating match:', error);
            throw error;
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
     * Cleanup on destroy
     */
    cleanup() {
        console.log('🧹 Cleaning up messaging listeners');
        
        // Remove all chat listeners
        this.chatListeners.forEach(unsubscribe => unsubscribe());
        this.chatListeners.clear();
        
        // Remove match listener
        if (this.matchListener) {
            this.matchListener();
        }
        
        // Remove notification listener
        if (this.notificationListener) {
            this.notificationListener();
        }
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
}
