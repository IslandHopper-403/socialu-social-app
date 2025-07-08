// javascript/features/messaging.js

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
 * Messaging Manager
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
        
        // Current chat context
        this.currentChatId = null;
        this.currentChatPartner = null;
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
            await this.loadMatches();
            await this.loadChats();
            this.setupRealtimeListeners();
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
        
        // Listen for new matches
        this.listenForMatches(currentUser.uid);
        
        // Listen for chat updates
        this.listenForChatUpdates(currentUser.uid);
    }
    
    /**
     * Load user matches
     */
    async loadMatches() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            // For demo, show mock users as matches
            const matchesContainer = document.getElementById('matchesScroll');
            if (!matchesContainer) return;
            
            // Get demo matches
            const matches = this.mockData ? this.mockData.getUsers().slice(0, 5) : [];
            
            matchesContainer.innerHTML = matches.map(user => `
                <div class="match-avatar" 
                     style="background-image: url('${user.image}')"
                     onclick="CLASSIFIED.openChat('${user.name}', '${user.image}', '${user.uid}')">
                </div>
            `).join('');
            
        } catch (error) {
            console.error('❌ Error loading matches:', error);
        }
    }
    
    /**
     * Load chat list
     */
    async loadChats() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            const chatList = document.getElementById('chatList');
            if (!chatList) return;
            
            // For demo, show mock chats
            const chats = this.mockData ? this.mockData.getChats() : [];
            
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
            
            // Try to load real chats from Firebase
            await this.loadRealChats(currentUser.uid);
            
        } catch (error) {
            console.error('❌ Error loading chats:', error);
        }
    }
    
    /**
     * Load real chats from Firebase
     */
    async loadRealChats(userId) {
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId),
                orderBy('lastMessageTime', 'desc'),
                limit(20)
            );
            
            const snapshot = await getDocs(q);
            const realChats = [];
            
            for (const doc of snapshot.docs) {
                const chatData = doc.data();
                const partnerId = chatData.participants.find(id => id !== userId);
                
                if (partnerId) {
                    // Get partner info
                    const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
                    if (partnerDoc.exists()) {
                        const partnerData = partnerDoc.data();
                        realChats.push({
                            id: doc.id,
                            partnerId: partnerId,
                            partnerName: partnerData.name,
                            partnerAvatar: partnerData.photos?.[0] || 'https://via.placeholder.com/100',
                            lastMessage: chatData.lastMessage,
                            lastMessageTime: chatData.lastMessageTime
                        });
                    }
                }
            }
            
            // If we have real chats, update the UI
            if (realChats.length > 0) {
                this.updateChatList(realChats);
            }
            
        } catch (error) {
            console.error('Error loading real chats:', error);
        }
    }
    
    /**
     * Update chat list UI
     */
    updateChatList(chats) {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;
        
        chatList.innerHTML = chats.map(chat => {
            const timeAgo = this.getTimeAgo(chat.lastMessageTime);
            return `
                <div class="chat-item" onclick="CLASSIFIED.openChat('${chat.partnerName}', '${chat.partnerAvatar}', '${chat.partnerId}')">
                    <div class="chat-avatar" style="background-image: url('${chat.partnerAvatar}')"></div>
                    <div class="chat-info">
                        <div class="chat-name">${chat.partnerName}</div>
                        <div class="chat-message">${chat.lastMessage}</div>
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
        console.log(`💬 Opening chat with ${name}`);
        
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            alert('Please login to chat');
            return;
        }
        
        // Update UI
        document.getElementById('chatName').textContent = name;
        document.getElementById('chatAvatar').style.backgroundImage = `url('${avatar}')`;
        
        // Store current chat context
        this.currentChatPartner = { name, avatar, userId };
        this.state.set('currentChatUser', this.currentChatPartner);
        
        // Generate chat ID (alphabetically sorted user IDs)
        const chatId = this.generateChatId(currentUser.uid, userId);
        this.currentChatId = chatId;
        
        // Show chat screen
        this.navigationManager.showOverlay('individualChat');
        
        // Load chat messages
        await this.loadChatMessages(chatId);
        
        // Set up real-time listener for this chat
        this.listenToChatMessages(chatId);
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
            // Clear input immediately for better UX
            messageInput.value = '';
            
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
            await setDoc(doc(this.db, 'chats', this.currentChatId), {
                participants: [currentUser.uid, this.currentChatPartner.userId],
                lastMessage: message,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: currentUser.uid
            }, { merge: true });
            
            console.log('✅ Message sent');
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            alert('Failed to send message. Please try again.');
            messageInput.value = message; // Restore message on error
        }
    }
    
    /**
     * Load chat messages
     */
    async loadChatMessages(chatId) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const currentUser = this.state.get('currentUser');
        
        try {
            // Show loading state
            messagesContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Check if chat exists
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            
            if (!chatDoc.exists()) {
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
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            // Display messages
            this.displayMessages(messages, currentUser.uid);
            
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div>Unable to load messages</div>
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
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            this.displayMessages(messages, currentUser.uid);
        });
        
        this.chatListeners.set(chatId, unsubscribe);
    }
    
    /**
     * Listen for new matches
     */
    listenForMatches(userId) {
        const matchesRef = collection(this.db, 'matches');
        const q = query(
            matchesRef,
            where('users', 'array-contains', userId),
            orderBy('timestamp', 'desc')
        );
        
        this.matchListener = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const matchData = change.doc.data();
                    // Handle new match
                    this.handleNewMatch(matchData);
                }
            });
        });
    }
    
    /**
     * Listen for chat updates
     */
    listenForChatUpdates(userId) {
        const chatsRef = collection(this.db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', userId),
            orderBy('lastMessageTime', 'desc')
        );
        
        onSnapshot(q, (snapshot) => {
            this.loadChats(); // Reload chat list when updates occur
        });
    }
    
    /**
     * Handle new match
     */
    async handleNewMatch(matchData) {
        console.log('🎉 New match!', matchData);
        
        // Show match popup
        const matchPopup = document.getElementById('matchPopup');
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
                        avatar: partnerData.photos?.[0]
                    });
                    
                    // Update popup text
                    matchPopup.querySelector('p').textContent = 
                        `You and ${partnerData.name} both liked each other`;
                }
            }
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
        // Remove all chat listeners
        this.chatListeners.forEach(unsubscribe => unsubscribe());
        this.chatListeners.clear();
        
        // Remove match listener
        if (this.matchListener) {
            this.matchListener();
        }
    }
}
