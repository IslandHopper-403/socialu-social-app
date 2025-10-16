// User-to-Business Messaging Module

import { sanitizeMessage, sanitizeText, escapeHtml, sanitizeHtml } from '../../utils/security.js';
import { handleSecurityError } from '../../utils/security.js';
import { formatMessageTime } from '../../utils/helpers.js';


import {
    collection,
    doc,
    getDoc,
    setDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

export class BusinessMessagingManager {
    constructor(firebaseServices, appState, parentMessaging = null) {
        this.db = firebaseServices.db;
        this.state = appState;
        this.parentMessaging = parentMessaging;
        // Any other initialization
    }


// ========== BUSINESS MESSAGING FUNCTIONS ==========

    /**
     * Start a business conversation
     * SECURITY: Separate from social messaging
     */
       async startBusinessConversation(businessId) {
        console.log('🚀 [START-CONV] Opening chat window (NO conversation created yet)');
        
        const user = this.state.get('currentUser');
        const businessData = this.state.get('currentBusiness');
        
        // Extract business name from various possible properties
        const businessName = businessData?.businessName || businessData?.name || businessData?.title || 'Business';
        
        console.log('📬 [START-CONV] Preparing chat for:', {
            businessId,
            businessName,
            user: user?.displayName
        });
        
        if (!user) {
            alert('Please sign in to message businesses');
            return;
        }
        
        try {
            // Create unique conversation ID for business chats
            // Format: business_[businessId]_user_[userId]
            const conversationId = `business_${businessId}_user_${user.uid}`;
            
            console.log('💬 [START-CONV] Generated conversation ID:', conversationId);
            
            // 🔧 FIX: Store business name in state for later use when creating conversation
            this.state.set('pendingBusinessName', businessName);
            
            // 🔧 FIX: Don't create conversation document yet - wait for first message
            // Just open the chat interface
            this.openBusinessChat(businessId, conversationId);
            
            console.log('✅ [START-CONV] Chat window opened (conversation will be created on first message)');
            
        } catch (error) {
            console.error('❌ [START-CONV] Error opening chat:', error);
            alert('Unable to open chat. Please try again.');
        }
    }
    
         /**
         * Open business chat interface
         * SECURITY: Uses new businessChat overlay, separate from social chat
         */
       async openBusinessChat(businessId, conversationId) {
            console.log('🔄 Opening chat:', { businessId, conversationId });
            console.log('🔄 Previous conversation:', this.state.get('currentBusinessConversationId'));
            
            // Get business data from Firestore conversation document
            let businessName = 'Business';
            let avatarUrl = '';
                
        try {
            const conversationRef = doc(this.db, 'businessConversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);
            
            if (conversationDoc.exists()) {
                const data = conversationDoc.data();
                businessName = data.businessName || data.name || 'Business';
                
                   // Get avatar from businesses collection
                const businessRef = doc(this.db, 'businesses', businessId);
                const businessDoc = await getDoc(businessRef);
                if (businessDoc.exists()) {
                    const bizData = businessDoc.data();
                    avatarUrl = bizData.photos?.[1] || bizData.photos?.[0] || '';
                }
            }
        } catch (error) {
            console.error('Error fetching business data:', error);
        }
        
        console.log('📬 Opening business chat:', { 
            businessId, 
            businessName,
            hasAvatar: !!avatarUrl 
        });
        
        // Set state
        this.state.set('currentChatType', 'business');
        this.state.set('currentChatBusinessId', businessId);
        this.state.set('currentBusinessConversationId', conversationId);
        this.state.set('chatOpenedFromBusinessProfile', true);
        
        console.log('✅ Updated conversation state to:', this.state.get('currentBusinessConversationId'));
        
        // Update header name
        const chatName = document.querySelector('#businessChat .chat-header-name');
        if (chatName) chatName.textContent = businessName;
        
        // Update empty state title
        const emptyTitle = document.getElementById('emptyStateTitle');
        if (emptyTitle) {
            emptyTitle.textContent = `Message ${businessName}`;
        }
        
        // Set avatar image
        const chatAvatar = document.querySelector('#businessChat .chat-header-avatar');
        if (chatAvatar && avatarUrl) {
            chatAvatar.src = avatarUrl;
            chatAvatar.alt = businessName;
            console.log('✅ Set business avatar');
        }
            
            // Show overlay
            const overlay = document.getElementById('businessChat');
            if (overlay) {
                overlay.classList.add('show');
                window.CLASSIFIED?.managers?.navigation?.showOverlay('businessChat');
            }
            
            // Load messages
            this.loadBusinessMessages(conversationId);
            this.setupBusinessMessageListener(conversationId);
        }
    
    /**
     * Load business conversation messages
     */
    async loadBusinessMessages(conversationId) {
        try {
            const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
            const snapshot = await getDocs(messagesQuery);
            
          const chatMessages = document.getElementById('businessChatMessages');
            if (!chatMessages) return;
            
            // Check if there are any messages
            const hasMessages = !snapshot.empty;
            
            if (hasMessages) {
                // Hide empty state only if messages exist
                const emptyState = document.getElementById('businessChatEmptyState');
                if (emptyState) emptyState.style.display = 'none';
                
                // Clear existing messages
                chatMessages.innerHTML = '';
                
                // Add business chat notice
                const notice = document.createElement('div');
                notice.className = 'chat-notice';
                notice.style.cssText = 'text-align: center; padding: 10px; opacity: 0.7; font-size: 12px;';
                notice.textContent = '💼 Business Inquiry - Response time usually within 2 hours';
                chatMessages.appendChild(notice);
                
                // Display messages
                snapshot.forEach(doc => {
                    const message = doc.data();
                    this.displayBusinessMessage(message);
                });
           } else {
                // No messages - keep empty state visible
                console.log('📭 No messages yet, showing empty state');
            }
            
            // 🔧 FIX: ALWAYS show quick replies for business users (persistent)
            const quickRepliesBar = document.getElementById('businessChatQuickReplies');
            if (quickRepliesBar) {
                quickRepliesBar.style.display = 'block';
                console.log('✨ [BUSINESS-CHAT] Quick replies always visible for business');
            }
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
        } catch (error) {
            console.error('❌ Error loading business messages:', error);
        }
    }
    
    /**
     * Display a business message
     * SECURITY: Sanitize all user content
     */
        displayBusinessMessage(message) {
        const chatMessages = document.getElementById('businessChatMessages');
        if (!chatMessages) return;
        
        // Hide empty state when first message appears
        const emptyState = document.getElementById('businessChatEmptyState');
        if (emptyState) emptyState.style.display = 'none';
        
        const user = this.state.get('currentUser');
        const isOwn = message.senderId === user?.uid;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'sent' : 'received'}`;
        
        // For business messages, add business badge
        if (!isOwn && message.senderType === 'business') {
            const badge = document.createElement('div');
            badge.className = 'business-badge';
            badge.style.cssText = 'font-size: 10px; opacity: 0.7; margin-bottom: 2px;';
            badge.textContent = '🏪 Business';
            messageDiv.appendChild(badge);
        }
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        // SECURITY: Use textContent for message content
        textDiv.textContent = message.text || '';
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = formatMessageTime(message.timestamp);
        
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(timeDiv);
        
        chatMessages.appendChild(messageDiv);
    }
    
    /**
     * Set up real-time listener for business messages
     */
       setupBusinessMessageListener(conversationId) {
        console.log('👂 Setting up listener for:', conversationId);
        
        // Clean up existing business listener
        if (this.businessChatListener) {
            console.log('🧹 Cleaning up old listener');
            this.businessChatListener();
            this.businessChatListener = null;
        }
        
        // CRITICAL: Clear the messages container before setting up new listener
        const chatMessages = document.getElementById('businessChatMessages');
        if (chatMessages) {
            // Keep empty state, remove all message divs
            const messages = chatMessages.querySelectorAll('.message, .chat-notice');
            messages.forEach(msg => msg.remove());
            console.log('🧹 Cleared old messages from DOM');
        }
        
        const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
        
        this.businessChatListener = onSnapshot(messagesQuery, (snapshot) => {
            console.log('📨 [BUSINESS-CHAT] Snapshot received:', snapshot.docChanges().length, 'changes');
            
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msgData = change.doc.data();
                    console.log('➕ [BUSINESS-CHAT] New message:', msgData.text?.substring(0, 30), 'from:', msgData.senderType);
                    
                    // 🔧 FIX: Always display new messages (removed existingMessages check)
                    this.displayBusinessMessage(msgData);
                    
                    // Auto-scroll to bottom
                    const chatMessages = document.getElementById('businessChatMessages');
                    if (chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            });
        });
        // Store listener for cleanup if parent messaging manager is available
        if (this.parentMessaging && this.parentMessaging.registerListener) {
            this.parentMessaging.registerListener(`business_chat_${conversationId}`, this.businessChatListener, 'business_chat');
        }
    }
    
    /**
     * Send a business message
     * SECURITY: Validate and sanitize input
     */
    async sendBusinessMessage() {
    const messageInput = document.getElementById('businessChatInput');
    if (!messageInput || !messageInput.value.trim()) return;
        
        const user = this.state.get('currentUser');
        const conversationId = this.state.get('currentBusinessConversationId');
        const businessId = this.state.get('currentChatBusinessId');
        
        if (!user || !conversationId || !businessId) {
            console.error('❌ Missing required data for business message');
            return;
        }
        
        // SECURITY: Sanitize message text
        const messageText = messageInput.value.trim();
        if (messageText.length > 500) {
            alert('Message too long (max 500 characters)');
            return;
        }
        
try {
            console.log('📤 [BUSINESS-MSG] Preparing to send message at:', Date.now());
            console.log('📤 [BUSINESS-MSG] Message text:', messageText.substring(0, 50));
            
            // 🔧 FIX: Detect who is sending this message
            const isBusinessUser = this.state.get('isBusinessUser');
            const pendingMessageSender = this.state.get('pendingMessageSender');
            const actualSender = pendingMessageSender || (isBusinessUser ? 'business' : 'user');
            
            console.log('👤 [BUSINESS-MSG] Sender detection:', {
                isBusinessUser,
                pendingMessageSender,
                actualSender
            });
            
            // Get message type from state (set by quick question buttons or quick replies)
            const messageType = this.state.get('pendingMessageType') || null;
            console.log('🏷️ [BUSINESS-MSG] Message type from state:', messageType);
            
            // 🔧 FIX: Check if conversation exists first
            const conversationRef = doc(this.db, 'businessConversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);
            
            if (!conversationDoc.exists()) {
                console.log('📝 [BUSINESS-MSG] First message - creating conversation document');
                
                // Get business name from state (stored when chat was opened)
                const businessName = this.state.get('pendingBusinessName') || 'Business';
                
                // Create the conversation document with first message data
                const conversationData = {
                    businessId: businessId,
                    businessName: businessName,
                    userId: user.uid,
                    userName: user.displayName || 'User',
                    createdAt: serverTimestamp(),
                    lastMessage: messageText,
                    lastMessageTime: serverTimestamp(),
                    lastMessageSender: user.uid,
                    userUnread: 0,
                    businessUnread: 1,
                    type: 'business_inquiry'
                };
                
                // Add lastMessageType if exists
                if (messageType) {
                    conversationData.lastMessageType = messageType;
                    console.log('🏷️ [BUSINESS-MSG] Including messageType in new conversation:', messageType);
                }
                
                await setDoc(conversationRef, conversationData);
                console.log('✅ [BUSINESS-MSG] Conversation document created');
                
                // Clean up pending business name
                this.state.set('pendingBusinessName', null);
            } else {
                console.log('🔄 [BUSINESS-MSG] Conversation exists - will update after adding message');
            }
            
            // Add message to conversation
            const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
            const messageData = {
                text: messageText,
                senderId: user.uid,
                senderName: user.displayName || 'User',
                senderType: actualSender,  // 🔧 FIX: Use detected sender type
                timestamp: serverTimestamp(),
                read: false
            };
            
            // Add messageType if it exists (from quick question)
            if (messageType) {
                messageData.messageType = messageType;
                console.log('✅ [BUSINESS-MSG] Tagged message as:', messageType);
            }
            
            console.log('📨 [BUSINESS-MSG] Message data prepared:', {
                senderType: messageData.senderType,
                messageType: messageData.messageType,
                textPreview: messageText.substring(0, 30)
            });
            
            await addDoc(messagesRef, messageData);
            console.log('✅ [BUSINESS-MSG] Message document created');
            
            // Update conversation if it already existed (not first message)
            if (conversationDoc.exists()) {
                const updateData = {
                    lastMessage: messageText,
                    lastMessageTime: serverTimestamp(),
                    lastMessageSender: user.uid  // 🔧 FIX: Track who sent last message
                };
                
                // 🔧 FIX: Increment correct unread counter based on sender
                if (actualSender === 'business') {
                    // Business sent message → User should be notified
                    updateData.userUnread = increment(1);
                    console.log('📊 [BUSINESS-MSG] Incremented userUnread (business → user)');
                } else {
                    // User sent message → Business should be notified
                    updateData.businessUnread = increment(1);
                    console.log('📊 [BUSINESS-MSG] Incremented businessUnread (user → business)');
                }
                
                // Add lastMessageType if it exists
                if (messageType) {
                    updateData.lastMessageType = messageType;
                    console.log('🏷️ [BUSINESS-MSG] Updated conversation with type:', messageType);
                }
                
                await updateDoc(conversationRef, updateData);
                console.log('✅ [BUSINESS-MSG] Conversation updated with correct unread counter');
            }
            
            // Clear the sender context and message type after sending
            this.state.set('pendingMessageType', null);
            this.state.set('pendingMessageSender', null);
            console.log('🧹 [BUSINESS-MSG] Cleared pending state');
            
            // Track for analytics
            await this.trackBusinessMessage(businessId);
            
            // Clear input
            messageInput.value = '';
            
            console.log('✅ [BUSINESS-MSG] Business message sent successfully');
            
        } catch (error) {
            console.error('❌ Error sending business message:', error);
            alert('Failed to send message. Please try again.');
        }
    }
    
     /**
     * Track business message for analytics
     */
    async trackBusinessMessage(businessId) {
        try {
            const analyticsRef = collection(this.db, 'businessAnalytics');
            await addDoc(analyticsRef, {
                businessId: businessId,
                type: 'message',
                timestamp: serverTimestamp(),
                userId: this.state.get('currentUser')?.uid
            });
        } catch (error) {
            console.error('Error tracking message:', error);
        }
    }
     
    /**
     * Open business conversation from dashboard
     */
    async openBusinessConversationFromDashboard(conversationId) {
    try {
        const user = this.state.get('currentUser');
        
        console.log('📬 Opening conversation from dashboard:', conversationId);
        
        const conversationRef = doc(this.db, 'businessConversations', conversationId);
        const conversationDoc = await getDoc(conversationRef);
        
        if (!conversationDoc.exists()) {
            console.error('❌ Conversation not found:', conversationId);
            return;
        }
        
        const data = conversationDoc.data();
        
        console.log('✅ Found conversation data:', {
            id: conversationId,
            userName: data.userName,
            messageCount: data.businessUnread || 0
        });
        
        // Set the current business state for the chat context
        this.state.set('currentChatType', 'business-dashboard');
        this.state.set('currentBusinessConversationId', conversationId);
        this.state.set('currentChatBusinessId', data.businessId);
        
        // Update businessChat header (NOT individualChat)
        const chatHeader = document.querySelector('#businessChat .chat-header-name');
        if (chatHeader) {
            chatHeader.textContent = data.userName || 'Customer';
        }
        
        // Update customer avatar in chat header
        const chatAvatar = document.querySelector('#businessChat .chat-header-avatar');
        if (chatAvatar && data.userId) {
            // Fetch customer photo from users collection
            try {
                const userRef = doc(this.db, 'users', data.userId);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const customerPhoto = userData.photos?.[0] || userData.photo || '';
                    
                    if (customerPhoto) {
                        chatAvatar.src = customerPhoto;
                        chatAvatar.alt = data.userName || 'Customer';
                        console.log('✅ Set customer avatar in chat header');
                    }
                }
            } catch (error) {
                console.error('Error fetching customer avatar:', error);
            }
        }
        
       // Show businessChat overlay
        const chatOverlay = document.getElementById('businessChat');
        if (chatOverlay) {
            chatOverlay.classList.add('show');
            console.log('✅ Opened businessChat overlay for dashboard response');
            
            // 🔧 FIX: Always show quick replies for business users
            const quickRepliesBar = document.getElementById('businessChatQuickReplies');
            if (quickRepliesBar) {
                quickRepliesBar.style.display = 'block';
                console.log('✨ [BUSINESS-CHAT] Quick replies visible from start');
            }
            
            // Track in navigation stack
            if (window.CLASSIFIED?.managers?.navigation) {
                window.CLASSIFIED.managers.navigation.showOverlay('businessChat');
            }
        }
        
        // Load conversation messages
        this.loadBusinessMessages(conversationId);
        
        // Set up message listener
        this.setupBusinessMessageListener(conversationId);
        
        // Mark messages as read from business perspective
        await updateDoc(conversationRef, {
            businessUnread: 0
        });
        
        console.log('✅ Opened conversation with customer:', data.userName);
        
        // Force reload messages after marking as read
        setTimeout(() => {
            this.loadBusinessMessages(conversationId);
        }, 100);
        
    } catch (error) {
        console.error('❌ Error opening conversation from dashboard:', error);
    }
}
    
}
