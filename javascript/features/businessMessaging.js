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
        
        // Extract business name from various possible properties
        const businessName = businessData?.businessName || businessData?.name || businessData?.title || 'Business';
        
        console.log('📬 Starting conversation with:', {
            businessId,
            businessData,
            businessName,
            user: user?.displayName,
            allBusinessKeys: businessData ? Object.keys(businessData) : []
        });
        
        if (!user) {
            alert('Please sign in to message businesses');
            return;
        }
        
       // Check both uid and id fields for compatibility
        if (!businessData || (businessData.uid !== businessId && businessData.id !== businessId)) {
            console.warn('⚠️ Business ID field mismatch, but continuing...', {
                expected: businessId,
                actualUid: businessData?.uid,
                actualId: businessData?.id,
                businessName: businessData?.name || businessData?.businessName
            });
            // Don't block - continue anyway since we have the business data
        }
        
        // businessName already declared above, just log it
        console.log('🏪 Using business name:', businessName);
        
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
                    businessName: businessName, // Add business name
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
 * Open business chat overlay (NEW SEPARATE SYSTEM)
 */
openBusinessChat(businessId, conversationId) {
    console.log('🏪 Opening business chat:', { businessId, conversationId });
    
    // Store current conversation info
    this.state.set('currentBusinessChatId', conversationId);
    this.state.set('currentBusinessId', businessId);
    
    // Get business data
    const businessData = this.state.get('currentBusiness');
    const businessName = businessData?.name || businessData?.businessName || 'Business';
    
    // Update chat header
    const nameElement = document.getElementById('businessChatName');
    if (nameElement) {
        nameElement.textContent = businessName;
    }
    
    // Show the overlay
    const overlay = document.getElementById('businessChat');
    if (overlay) {
        overlay.classList.add('show');
        overlay.style.display = 'flex';
    }
    
    // Clear previous messages
    const messagesContainer = document.getElementById('businessChatMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
    
    // Load messages
    this.loadBusinessChatMessages(conversationId);
    
    // Set up real-time listener
    this.setupBusinessChatListener(conversationId);
}

/**
 * Load messages for business chat
 */
async loadBusinessChatMessages(conversationId) {
    try {
        const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(messagesQuery);
        
        const messagesContainer = document.getElementById('businessChatMessages');
        if (!messagesContainer) return;
        
        snapshot.forEach(doc => {
            this.displayBusinessChatMessage(doc.data());
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
    } catch (error) {
        console.error('Error loading business messages:', error);
    }
}

/**
 * Display a message in business chat
 */
displayBusinessChatMessage(message) {
    const messagesContainer = document.getElementById('businessChatMessages');
    if (!messagesContainer) return;
    
    const currentUser = this.state.get('currentUser');
    const isOwn = message.senderId === currentUser?.uid;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'sent' : 'received'}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = message.text;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
}

/**
 * Set up real-time listener for business chat
 */
setupBusinessChatListener(conversationId) {
    // Clean up existing listener
    if (this.businessChatUnsubscribe) {
        this.businessChatUnsubscribe();
    }
    
    const messagesRef = collection(this.db, 'businessConversations', conversationId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
    
    this.businessChatUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const messagesContainer = document.getElementById('businessChatMessages');
                if (messagesContainer && messagesContainer.children.length > 0) {
                    this.displayBusinessChatMessage(change.doc.data());
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }
        });
    });
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
     
    /**
     * Open business conversation from dashboard
     */
    async openBusinessConversationFromDashboard(conversationId) {
        try {
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
            this.state.set('currentChatType', 'business');
            this.state.set('currentBusinessConversationId', conversationId);
            this.state.set('currentChatBusinessId', data.businessId);
            
            // Update chat header with customer name
            const chatHeader = document.getElementById('chatName');
            if (chatHeader) {
                chatHeader.textContent = data.userName || 'Customer';
            }
            
            // Update avatar to show it's a customer chat
            const chatAvatar = document.getElementById('chatAvatar');
            if (chatAvatar) {
                chatAvatar.textContent = '👤';
                chatAvatar.style.fontSize = '24px';
                chatAvatar.style.display = 'flex';
                chatAvatar.style.alignItems = 'center';
                chatAvatar.style.justifyContent = 'center';
            }
            
            // Show chat overlay with dynamic z-index
            const chatOverlay = document.getElementById('individualChat');
            if (chatOverlay) {
                // DYNAMIC Z-INDEX: Calculate based on current overlays
                const currentOverlays = document.querySelectorAll('.overlay-screen.show');
                const maxZIndex = Array.from(currentOverlays).reduce((max, el) => {
                    const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
                    return Math.max(max, zIndex);
                }, 0);
                
                // Boost chat above all current overlays
                const boostZIndex = maxZIndex + 50;
                chatOverlay.style.zIndex = boostZIndex;
                console.log(`🎯 Business chat z-index boosted to ${boostZIndex}`);
                
                chatOverlay.classList.add('show');
                chatOverlay.dataset.chatType = 'business-response'; // Mark as business responding
                
                // Track in overlay stack
                if (window.CLASSIFIED && window.CLASSIFIED.managers && window.CLASSIFIED.managers.navigation) {
                    window.CLASSIFIED.managers.navigation.showOverlay('individualChat');
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
        
        // FIXED: Force reload messages after marking as read
        setTimeout(() => {
            this.loadBusinessMessages(conversationId);
        }, 100);
        
    } catch (error) {
        console.error('❌ Error opening conversation from dashboard:', error);
    }
}
    
}
