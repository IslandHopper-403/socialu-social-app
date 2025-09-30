// User-to-Business Messaing Module

import { sanitizeMessage, sanitizeText, escapeHtml, sanitizeHtml } from '../utils/security.js';
import { handleSecurityError } from '../utils/security.js';

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
        const user = this.state.get('currentUser');
        const businessData = this.state.get('currentBusiness');
        
        console.log('📬 Starting conversation with:', {
            businessId,
            businessData,
            user: user?.displayName
        });
        
        if (!user) {
            alert('Please sign in to message businesses');
            return;
        }
        
        if (!businessData || businessData.uid !== businessId) {
            console.error('❌ Business data mismatch!', {
                expected: businessId,
                actual: businessData?.uid
            });
        }
        
        try {
            // Create unique conversation ID for business chats
            // Format: business_[businessId]_user_[userId]
            const conversationId = `business_${businessId}_user_${user.uid}`;
            
            // Check if conversation exists
            const conversationRef = doc(this.db, 'businessConversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);
            
            if (!conversationDoc.exists()) {
                // Create new business conversation
                await setDoc(conversationRef, {
                    businessId: businessId,
                    userId: user.uid,
                    userName: user.displayName || 'User',
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    lastMessageTime: serverTimestamp(),
                    userUnread: 0,
                    businessUnread: 0,
                    type: 'business_inquiry' // SECURITY: Mark as business message
                });
                
                console.log('📬 Business conversation created:', conversationId);
            }
            
            // Open business chat interface
            this.openBusinessChat(businessId, conversationId);
            
        } catch (error) {
            console.error('❌ Error starting business conversation:', error);
            alert('Unable to start conversation. Please try again.');
        }
    }
    
    /**
     * Open business chat interface
     * SECURITY: Uses different UI than social chat
     */
    openBusinessChat(businessId, conversationId) {
        // Get business data for header
        const businessData = this.state.get('currentBusiness');
        
        // Debug logging
        console.log('📬 Opening business chat with data:', {
            businessId: businessId,
            businessData: businessData,
            businessName: businessData?.name,
            businessTitle: businessData?.businessName,
            allKeys: businessData ? Object.keys(businessData) : []
        });
        
        // Update chat header for business - correct element ID is 'chatName'
        const chatHeader = document.getElementById('chatName');
        if (chatHeader && businessData) {
            // SECURITY: Use textContent for business name
            // Try multiple possible property names for the business name
            const displayName = businessData.businessName || businessData.name || businessData.title || 'Business';
            chatHeader.textContent = displayName;
            console.log('✅ Chat header updated to:', displayName);
        } else {
            console.error('❌ Chat header element not found or businessData missing');
        }
        
        // Mark this as a business chat
        this.state.set('currentChatType', 'business');
        this.state.set('currentChatBusinessId', businessId);
        this.state.set('currentBusinessConversationId', conversationId);
        
        // Show chat overlay
        const chatOverlay = document.getElementById('individualChat');
        if (chatOverlay) {
            chatOverlay.classList.add('show');
            chatOverlay.dataset.chatType = 'business'; // Mark as business chat
        }
        
        // Load business conversation messages
        this.loadBusinessMessages(conversationId);
        
        // Set up business message listener
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
            
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) return;
            
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
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
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
        timeDiv.textContent = this.formatMessageTime(message.timestamp);
        
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(timeDiv);
        
        chatMessages.appendChild(messageDiv);
    }
    
    /**
     * Set up real-time listener for business messages
     */
    setupBusinessMessageListener(conversationId) {
        // Clean up existing business listener
        if (this.businessChatListener) {
            this.businessChatListener();
            this.businessChatListener = null;
        }
        
        const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
        
        this.businessChatListener = onSnapshot(messagesQuery, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    // Only display new messages
                    const existingMessages = document.querySelectorAll('.message').length;
                    if (existingMessages > 0) {
                        this.displayBusinessMessage(change.doc.data());
                        
                        // Auto-scroll to bottom
                        const chatMessages = document.getElementById('chatMessages');
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
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
        const messageInput = document.getElementById('messageInput');
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
            // Add message to conversation
            const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
            await addDoc(messagesRef, {
                text: messageText,
                senderId: user.uid,
                senderName: user.displayName || 'User',
                senderType: 'user',
                timestamp: serverTimestamp(),
                read: false
            });
            
            // Update conversation last message
            const conversationRef = doc(this.db, 'businessConversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: messageText,
                lastMessageTime: serverTimestamp(),
                businessUnread: increment(1)
            });
            
            // Track for analytics
            await this.trackBusinessMessage(businessId);
            
            // Clear input
            messageInput.value = '';
            
            console.log('✅ Business message sent');
            
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
         * Format timestamp for message display
         */
        formatMessageTime(timestamp) {
            if (!timestamp) return 'Now';
            
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
            
            return date.toLocaleDateString();
        }
}
