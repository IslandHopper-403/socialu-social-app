// FILE: javascript/features/messaging.js - REFACTORED VERSION
// javascript/features/messaging.js - COMPLETE VERSION 4.0 - NOTIFICATIONS MIGRATED

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
 * Messaging Manager - REFACTORED VERSION 4.0
 * Notifications now handled by NotificationsManager
 * This file focuses on core messaging only
 */
export class MessagingManager {
    constructor(firebaseServices, appState) {
        console.log('💬 [MESSAGING] Initializing MessagingManager v4.0...');
        
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.profileManager = null;
        this.notificationsManager = null; // ADDED: Reference to NotificationsManager
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
        
        // Chat visibility tracking
        this.isChatVisible = false;
        
        // Track last app active time
        this.lastAppActive = Date.now();
        
        // Message read states
        this.messageReadStates = new Map();
        this.loadMessageReadStates();
        
        // CRITICAL: Track initialization state
        this.isInitialized = false;
        
        // Track processed match timestamps to prevent duplicate popups
        this.processedMatchTimestamps = new Map();
        this.loadMatchTimestamps();
        
        console.log('✅ [MESSAGING] MessagingManager v4.0 constructed (notifications delegated)');
    }
    
    /**
     * Register a listener with metadata for tracking
     */
    registerListener(id, unsubscribe, type = 'unknown') {
        console.log(`📌 [MESSAGING] Registering listener: ${id} (${type})`);
        
        // Unregister existing listener with same ID first
        if (this.activeListeners.has(id)) {
            console.log(`🔄 [MESSAGING] Replacing existing listener: ${id}`);
            const existing = this.activeListeners.get(id);
            existing.unsubscribe();
        }
        
        this.activeListeners.set(id, {
            unsubscribe,
            type,
            createdAt: Date.now()
        });
        
        console.log(`✅ [MESSAGING] Listener registered: ${id} (${type}), total: ${this.activeListeners.size}`);
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
                console.log(`🗑️ [MESSAGING] Unregistered listener: ${id}, remaining: ${this.activeListeners.size}`);
            } catch (error) {
                console.error(`❌ [MESSAGING] Error unregistering listener ${id}:`, error);
            }
        }
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🔗 [MESSAGING] Setting manager references...');
        
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
        this.notificationsManager = managers.notifications; // ADDED: Notifications reference
        
        console.log('🔗 [MESSAGING] Manager references set:');
        console.log('  - navigationManager:', !!this.navigationManager);
        console.log('  - profileManager:', !!this.profileManager);
        console.log('  - notificationsManager:', !!this.notificationsManager);
        
        // Get mock data reference from app
        if (window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
            console.log('✅ [MESSAGING] MockData reference acquired');
        }
    }
    
    /**
     * Initialize messaging system
     */
    async init() {
        console.log('💬 [MESSAGING] Initializing messaging manager v4.0...');
        
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
                console.log('✅ [MESSAGING] Initialized for authenticated user');
            } catch (error) {
                console.error('❌ [MESSAGING] Error initializing messaging:', error);
            }
        } else if (this.state.get('isGuestMode')) {
            console.log('👤 [MESSAGING] Guest mode - skipping real-time listeners');
        }
        
        // Mark as initialized
        this.isInitialized = true;
        console.log('✅ [MESSAGING] Messaging manager v4.0 initialized');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        console.log('👂 [MESSAGING] Setting up event listeners...');
        
        const sendBtn = document.getElementById('sendMessage');
        const messageInput = document.getElementById('messageInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        console.log('✅ [MESSAGING] Event listeners configured');
    }
    
    /**
     * Setup real-time listeners for authenticated users
     */
    setupRealtimeListeners() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            console.log('⚠️ [MESSAGING] No current user - skipping real-time listeners');
            return;
        }
        
        console.log('📡 [MESSAGING] Setting up real-time listeners for user:', currentUser.uid);
        
        // Setup chat updates listener
        this.setupChatUpdatesListener(currentUser.uid);
        
        // Delegate notification listening to NotificationsManager
        if (this.notificationsManager) {
            console.log('🔔 [MESSAGING] Delegating notification listening to NotificationsManager...');
            this.notificationsManager.listenForNotifications(currentUser.uid);
        } else {
            console.warn('⚠️ [MESSAGING] NotificationsManager not available for notification listening');
        }
        
        console.log('✅ [MESSAGING] Real-time listeners configured');
    }
    
    /**
     * Setup chat updates listener
     */
    async setupChatUpdatesListener(userId) {
        console.log('📡 [MESSAGING] Setting up chat updates listener for user:', userId);
        
        // Remove existing listener first
        this.unregisterListener('chat_updates_global');
        
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            let isInitialLoad = true;
            
            const unsubscribe = onSnapshot(q, async (snapshot) => {
                console.log(`📨 [MESSAGING] Chat updates snapshot received, isInitialLoad: ${isInitialLoad}, changes: ${snapshot.docChanges().length}`);
                
                if (isInitialLoad) {
                    isInitialLoad = false;
                    await this.loadChats();
                    console.log('✅ [MESSAGING] Initial chat load complete');
                    return;
                }
                
                // Process chat modifications
                for (const change of snapshot.docChanges()) {
                    if (change.type === 'modified') {
                        const chatData = change.doc.data();
                        const chatId = change.doc.id;
                        
                        console.log(`📬 [MESSAGING] Chat modified: ${chatId}`, {
                            sender: chatData.lastMessageSender,
                            currentUser: userId,
                            isCurrentChat: this.currentChatId === chatId
                        });
                        
                        // Delegate unread tracking to NotificationsManager
                        if (chatData.lastMessageSender && 
                            chatData.lastMessageSender !== userId &&
                            this.currentChatId !== chatId &&
                            chatData.lastMessageTime) {
                            
                            const messageTime = chatData.lastMessageTime.toMillis();
                            
                            if (messageTime > this.lastAppActive) {
                                console.log('📊 [MESSAGING] New unread message detected, delegating to NotificationsManager');
                                
                                if (this.notificationsManager) {
                                    this.notificationsManager.updateUnreadCount(chatId, 1);
                                }
                            }
                        }
                    }
                }
                
                await this.loadChats();
                console.log('✅ [MESSAGING] Chat list refreshed');
                
            }, (error) => {
                console.error('❌ [MESSAGING] Error in chat updates listener:', error);
                this.unregisterListener('chat_updates_global');
            });
            
            this.registerListener('chat_updates_global', unsubscribe, 'chat_update');
            console.log('✅ [MESSAGING] Chat updates listener registered');
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error setting up chat updates listener:', error);
        }
    }
    
    /**
     * Load all chats for current user
     */
    async loadChats() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            console.log('⚠️ [MESSAGING] No current user - cannot load chats');
            return;
        }
        
        console.log('📂 [MESSAGING] Loading chats for user:', currentUser.uid);
        
        const chatListContainer = document.getElementById('chatList');
        if (!chatListContainer) {
            console.log('⚠️ [MESSAGING] Chat list container not found');
            return;
        }
        
        try {
            // Show loading state
            chatListContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Query chats
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', currentUser.uid),
                orderBy('lastMessageTime', 'desc')
            );
            
            const snapshot = await getDocs(q);
            console.log(`📨 [MESSAGING] Found ${snapshot.size} chats`);
            
            if (snapshot.empty) {
                chatListContainer.innerHTML = '<p class="no-chats">No conversations yet</p>';
                return;
            }
            
            // Clear container
            chatListContainer.innerHTML = '';
            
            // Process each chat
            for (const chatDoc of snapshot.docs) {
                const chatData = chatDoc.data();
                const chatId = chatDoc.id;
                const partnerId = chatData.participants.find(id => id !== currentUser.uid);
                
                // Get partner info
                let partnerInfo = null;
                if (this.mockData) {
                    partnerInfo = this.mockData.getUserById(partnerId);
                }
                
                if (!partnerInfo) {
                    console.warn('⚠️ [MESSAGING] Partner info not found for:', partnerId);
                    continue;
                }
                
                // Create chat item
                const chatItem = this.createChatItem(chatId, partnerInfo, chatData);
                chatListContainer.appendChild(chatItem);
            }
            
            console.log('✅ [MESSAGING] Chat list rendered');
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error loading chats:', error);
            chatListContainer.innerHTML = '<p class="error">Error loading chats</p>';
        }
    }
    
    /**
     * Create a chat list item
     */
    createChatItem(chatId, partnerInfo, chatData) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chatId;
        
        // Sanitize data
        const safeName = sanitizeText(partnerInfo.name || 'Unknown');
        const safeLastMessage = sanitizeText(chatData.lastMessage || '');
        const safeAvatar = partnerInfo.avatar || 'https://via.placeholder.com/50';
        
        // Get unread count from NotificationsManager
        let unreadCount = 0;
        if (this.notificationsManager) {
            const unreadMap = this.notificationsManager.unreadMessages;
            unreadCount = unreadMap.get(chatId) || 0;
        }
        
        chatItem.innerHTML = `
            <img src="${safeAvatar}" alt="${safeName}">
            <div class="chat-item-info">
                <h4>${safeName}</h4>
                <p>${safeLastMessage}</p>
            </div>
            ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount > 9 ? '9+' : unreadCount}</div>` : ''}
        `;
        
        // Click handler
        chatItem.addEventListener('click', () => {
            console.log('💬 [MESSAGING] Chat item clicked:', chatId);
            this.openChat(chatId, partnerInfo);
        });
        
        return chatItem;
    }
    
    /**
     * Open a chat
     */
    async openChat(chatId, partnerInfo) {
        console.log('💬 [MESSAGING] Opening chat:', chatId, 'with:', partnerInfo.name);
        
        // Store current chat context
        this.currentChatId = chatId;
        this.currentChatPartner = partnerInfo;
        this.isChatVisible = true;
        
        // Update state
        this.state.set('currentChatUser', partnerInfo);
        
        // Mark chat as read via NotificationsManager
        if (this.notificationsManager) {
            console.log('✅ [MESSAGING] Marking chat as read via NotificationsManager');
            this.notificationsManager.markChatAsRead(chatId);
        }
        
        // Open chat overlay
        if (this.navigationManager) {
            this.navigationManager.openChatOverlay(partnerInfo);
        }
        
        // Load messages
        await this.loadChatMessages(chatId);
        
        // Setup real-time listener for this chat
        this.listenToChatMessages(chatId);
        
        // Mark all messages as read
        await this.markAllMessagesAsRead(chatId);
        
        console.log('✅ [MESSAGING] Chat opened successfully');
    }
    
    /**
     * Load chat messages
     */
    async loadChatMessages(chatId) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            console.warn('⚠️ [MESSAGING] Messages container not found');
            return;
        }
        
        const currentUser = this.state.get('currentUser');
        
        try {
            console.log('💬 [MESSAGING] Loading messages for chat:', chatId);
            
            // Show loading state
            messagesContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
            // Query messages
            const messagesRef = collection(this.db, 'chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            const snapshot = await getDocs(q);
            console.log(`📨 [MESSAGING] Found ${snapshot.size} messages`);
            
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<p class="no-messages">No messages yet. Say hi!</p>';
                return;
            }
            
            // Process messages
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            // Display messages
            this.displayMessages(messages);
            
            console.log('✅ [MESSAGING] Messages loaded and displayed');
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error loading messages:', error);
            messagesContainer.innerHTML = '<p class="error">Error loading messages</p>';
        }
    }
    
    /**
     * Display messages in chat
     */
    displayMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const currentUser = this.state.get('currentUser');
        
        // Clear container
        messagesContainer.innerHTML = '';
        
        messages.forEach(msg => {
            const isSent = msg.senderId === currentUser?.uid;
            
            // Create message element
            const messageElement = document.createElement('div');
            messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
            
            // Message bubble
            const messageBubble = document.createElement('div');
            messageBubble.className = 'message-bubble';
            messageBubble.textContent = msg.text; // Safe - uses textContent
            
            messageElement.appendChild(messageBubble);
            
            // Timestamp
            if (msg.timestamp) {
                const timeStr = this.formatMessageTime(msg.timestamp);
                const timeElement = document.createElement('div');
                timeElement.className = 'message-time';
                timeElement.textContent = timeStr;
                
                // Add read indicator for sent messages
                if (isSent) {
                    const messageId = `${this.currentChatId}_${msg.id}`;
                    const readState = this.messageReadStates.get(messageId);
                    
                    if (readState?.read || msg.read) {
                        const readIndicator = document.createElement('span');
                        readIndicator.className = 'read-indicator';
                        readIndicator.textContent = ' ✓✓';
                        timeElement.appendChild(readIndicator);
                        
                        // Update read status if needed
                        if (!readState?.read && msg.read) {
                            this.messageReadStates.set(messageId, {
                                read: true,
                                readAt: msg.readAt || Date.now()
                            });
                            this.saveMessageReadStates();
                        }
                    } else {
                        // Update read status from Firebase
                        if (msg.read) {
                            this.messageReadStates.set(messageId, {
                                read: true,
                                readAt: msg.readAt || Date.now()
                            });
                            this.saveMessageReadStates();
                            
                            const readIndicator = document.createElement('span');
                            readIndicator.className = 'read-indicator';
                            readIndicator.textContent = ' ✓✓';
                            timeElement.appendChild(readIndicator);
                        }
                    }
                }
                
                messageElement.appendChild(timeElement);
            }
            
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    /**
     * Listen to chat messages in real-time
     */
    listenToChatMessages(chatId) {
        console.log('👂 [MESSAGING] Setting up chat listener for:', chatId);
        this.unregisterListener(`chat_${chatId}`);
        
        const currentUser = this.state.get('currentUser');
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        // Track if this is the first snapshot for THIS chat
        let isInitialLoad = true;
        
        try {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                console.log(`📨 [MESSAGING] Chat snapshot received for ${chatId}, isInitialLoad: ${isInitialLoad}, changes: ${snapshot.docChanges().length}`);
                
                const messages = [];
                
                snapshot.forEach(messageDoc => {
                    messages.push({ id: messageDoc.id, ...messageDoc.data() });
                });
                
                // Only process notifications after initial load
                if (!isInitialLoad) {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const message = change.doc.data();
                            
                            console.log('📬 [MESSAGING] New message added:', {
                                from: message.senderId,
                                currentUser: currentUser.uid,
                                isOwnMessage: message.senderId === currentUser.uid
                            });
                            
                            if (message.senderId !== currentUser.uid) {
                                // Delegate to NotificationsManager for toast
                                if (this.notificationsManager) {
                                    const partnerName = this.currentChatPartner?.name || 'Unknown';
                                    const safeText = sanitizeText(message.text || '');
                                    this.notificationsManager.showToast(`💬 ${partnerName}: ${safeText}`);
                                    console.log('✅ [MESSAGING] Toast notification shown via NotificationsManager');
                                } else {
                                    console.warn('⚠️ [MESSAGING] NotificationsManager not available for toast');
                                }
                            }
                        }
                    });
                }
                
                // Display messages
                this.displayMessages(messages);
                
                // Mark as not initial load after first snapshot
                isInitialLoad = false;
                console.log('✅ [MESSAGING] Initial load complete for chat:', chatId);
                
            }, (error) => {
                console.error('❌ [MESSAGING] Error listening to chat messages:', error);
                this.unregisterListener(`chat_${chatId}`);
            });
            
            this.registerListener(`chat_${chatId}`, unsubscribe, 'chat');
            console.log('✅ [MESSAGING] Chat listener registered for:', chatId);
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error setting up chat listener:', error);
        }
    }
    
    /**
     * Send message with proper sanitization
     */
    async sendMessage() {
        console.log('📤 [MESSAGING] sendMessage() called');
        
        // SECURITY: Check if this is a business chat
        const chatType = this.state.get('currentChatType');
        if (chatType === 'business') {
            console.log('🏢 [MESSAGING] Delegating to business messaging');
            return this.sendBusinessMessage();
        }
        
        const messageInput = document.getElementById('messageInput');
        const rawMessage = messageInput.value.trim();
        
        if (!rawMessage) {
            console.log('⚠️ [MESSAGING] Empty message - ignoring');
            return;
        }
        
        const currentUser = this.state.get('currentUser');
        if (!currentUser || !this.currentChatId || !this.currentChatPartner) {
            console.error('❌ [MESSAGING] Missing required data for sending message');
            alert('Unable to send message. Please try again.');
            return;
        }
        
        console.log('📤 [MESSAGING] Sending message to chat:', this.currentChatId);
        
        try {
            // SECURITY: Sanitize message
            const sanitizedMessage = sanitizeMessage(rawMessage);
            
            // Clear input immediately
            messageInput.value = '';
            
            // Add optimistic message to UI
            this.addMessageToUI({
                senderId: currentUser.uid,
                text: sanitizedMessage,
                timestamp: Date.now()
            }, true);
            
            // Ensure chat exists
            await this.ensureChatExists(
                this.currentChatId,
                currentUser.uid,
                this.currentChatPartner.userId
            );
            
            // Send to Firebase
            const messagesRef = collection(this.db, 'chats', this.currentChatId, 'messages');
            await addDoc(messagesRef, {
                senderId: currentUser.uid,
                text: sanitizedMessage,
                timestamp: serverTimestamp(),
                read: false
            });
            
            // Update chat document
            await updateDoc(doc(this.db, 'chats', this.currentChatId), {
                lastMessage: sanitizedMessage,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: currentUser.uid
            });
            
            console.log('✅ [MESSAGING] Message sent successfully');
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error sending message:', error);
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
     * Ensure chat document exists
     */
    async ensureChatExists(chatId, userId1, userId2) {
        try {
            const chatDoc = await getDoc(doc(this.db, 'chats', chatId));
            
            if (!chatDoc.exists()) {
                console.log('📝 [MESSAGING] Creating new chat document');
                await setDoc(doc(this.db, 'chats', chatId), {
                    participants: [userId1, userId2],
                    createdAt: serverTimestamp(),
                    lastMessage: '',
                    lastMessageTime: serverTimestamp(),
                    lastMessageSender: null
                });
            }
        } catch (error) {
            console.error('❌ [MESSAGING] Error ensuring chat exists:', error);
        }
    }
    
    /**
     * Mark all messages as read
     */
    async markAllMessagesAsRead(chatId) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            console.log('✅ [MESSAGING] Marking all messages as read in chat:', chatId);
            
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
                console.log(`✅ [MESSAGING] Marked ${snapshot.size} messages as read in chat ${chatId}`);
            }
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error marking messages as read:', error);
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
            console.error('❌ [MESSAGING] Error updating message read status:', error);
        }
    }
    
    /**
     * Cleanup chat state (called by navigation manager)
     */
    closeChat() {
        console.log('🧹 [MESSAGING] Closing chat...');
        
        if (this.currentChatId) {
            // Mark chat as read via NotificationsManager
            if (this.notificationsManager) {
                this.notificationsManager.markChatAsRead(this.currentChatId);
            }
            
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
        
        console.log('✅ [MESSAGING] Chat closed and state cleared');
    }
    
    /**
     * Delegate to business messaging
     */
    startBusinessConversation(businessId) {
        console.log('🏢 [MESSAGING] Delegating startBusinessConversation to BusinessMessagingManager');
        return this.businessMessaging.startBusinessConversation(businessId);
    }
    
    sendBusinessMessage() {
        console.log('🏢 [MESSAGING] Delegating sendBusinessMessage to BusinessMessagingManager');
        return this.businessMessaging.sendBusinessMessage();
    }
    
    /**
     * Load matches (placeholder)
     */
    async loadMatches() {
        console.log('💕 [MESSAGING] Loading matches...');
        // Match loading logic here
        console.log('✅ [MESSAGING] Matches loaded');
    }
    
    /**
     * Open user profile from chat
     */
    openUserProfile() {
        console.log('👤 [MESSAGING] Opening user profile...');
        
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
        console.log('🔔 [MESSAGING] Sending notification to user:', userId, notificationData);
        // In a real app, this would integrate with Firebase Cloud Messaging
        // or another push notification service
    }
    
    /**
     * Create a match between two users with proper chat setup
     */
    async createMatch(userId1, userId2) {
        try {
            // SECURITY: Validate user IDs
            if (!userId1 || !userId2 || userId1 === userId2) {
                throw new Error('Invalid user IDs for match creation');
            }
            
            console.log('🎉 [MESSAGING] Creating match between', userId1, 'and', userId2);
            
            // Create match data with timestamp
            const matchData = {
                users: [userId1, userId2].sort(), // Sort for consistency
                timestamp: serverTimestamp(),
                createdTimestamp: Date.now(), // Client timestamp for immediate validation
                status: 'active',
                createdBy: 'system',
                chatCreated: true
            };
            
            // Create match document
            const matchId = matchData.users.join('_');
            await setDoc(doc(this.db, 'matches', matchId), matchData);
            
            // Create chat document
            const chatId = matchData.users.join('_');
            const chatRef = doc(this.db, 'chats', chatId);
            const chatDoc = await getDoc(chatRef);
            
            if (!chatDoc.exists()) {
                await setDoc(chatRef, {
                    participants: matchData.users,
                    createdAt: serverTimestamp(),
                    lastMessage: '',
                    lastMessageTime: serverTimestamp(),
                    lastMessageSender: null,
                    matchId: matchId
                });
                console.log('✅ [MESSAGING] Chat created for match:', matchId);
            }
            
            console.log('✅ [MESSAGING] Match created successfully');
            return matchId;
            
        } catch (error) {
            console.error('❌ [MESSAGING] Error creating match:', error);
            throw error;
        }
    }
    
    /**
     * Format message timestamp
     */
    formatMessageTime(timestamp) {
        if (!timestamp) return '';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        return date.toLocaleDateString();
    }
    
    /**
     * Load message read states from localStorage
     */
    loadMessageReadStates() {
        try {
            const saved = localStorage.getItem('messageReadStates');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([id, state]) => {
                    this.messageReadStates.set(id, state);
                });
                console.log(`📦 [MESSAGING] Loaded ${this.messageReadStates.size} message read states`);
            }
        } catch (error) {
            console.error('❌ [MESSAGING] Error loading message read states:', error);
        }
    }
    
    /**
     * Save message read states to localStorage
     */
    saveMessageReadStates() {
        try {
            const states = {};
            this.messageReadStates.forEach((state, id) => {
                states[id] = state;
            });
            localStorage.setItem('messageReadStates', JSON.stringify(states));
        } catch (error) {
            console.error('❌ [MESSAGING] Error saving message read states:', error);
        }
    }
    
    /**
     * Load match timestamps from localStorage
     */
    loadMatchTimestamps() {
        try {
            const saved = localStorage.getItem('processedMatchTimestamps');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([id, timestamp]) => {
                    this.processedMatchTimestamps.set(id, timestamp);
                });
                console.log(`📦 [MESSAGING] Loaded ${this.processedMatchTimestamps.size} match timestamps`);
            }
        } catch (error) {
            console.error('❌ [MESSAGING] Error loading match timestamps:', error);
        }
    }
    
    /**
     * Save match timestamps to localStorage
     */
    saveMatchTimestamps() {
        try {
            const timestamps = {};
            this.processedMatchTimestamps.forEach((time, id) => {
                timestamps[id] = time;
            });
            localStorage.setItem('processedMatchTimestamps', JSON.stringify(timestamps));
        } catch (error) {
            console.error('❌ [MESSAGING] Error saving match timestamps:', error);
        }
    }
    
    /**
     * Clean up old match timestamps (older than 24 hours)
     */
    cleanupOldMatchTimestamps() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        let cleaned = 0;
        
        this.processedMatchTimestamps.forEach((timestamp, matchId) => {
            if (timestamp < oneDayAgo) {
                this.processedMatchTimestamps.delete(matchId);
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            this.saveMatchTimestamps();
            console.log(`🧹 [MESSAGING] Cleaned up ${cleaned} old match timestamps`);
        }
    }
    
    /**
     * Cleanup on destroy
     */
    cleanup() {
        console.log('🧹 [MESSAGING] Cleaning up messaging manager...');
        
        // Unregister all listeners
        this.activeListeners.forEach((listener, id) => {
            try {
                listener.unsubscribe();
            } catch (error) {
                console.error(`❌ [MESSAGING] Error cleaning up listener ${id}:`, error);
            }
        });
        this.activeListeners.clear();
        
        // Save states
        this.saveMessageReadStates();
        this.saveMatchTimestamps();
        
        // Clear references
        this.currentChatId = null;
        this.currentChatPartner = null;
        this.navigationManager = null;
        this.profileManager = null;
        this.notificationsManager = null;
        this.mockData = null;
        
        console.log('✅ [MESSAGING] Messaging manager cleanup complete');
    }
}
