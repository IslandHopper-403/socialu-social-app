// javascript/features/notifications.js

import { 
    collection, 
    addDoc, 
    doc, 
    getDoc,
    serverTimestamp,
    query,
    where,
    onSnapshot,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import { sanitizeText } from '../utils/security.js';

/**
 * COMPLETE Notification Manager - Single Source of Truth
 * Handles all notifications: messages, matches, likes, and UI updates
 */
export class NotificationManager {
    constructor(firebaseServices, appState) {
        console.log('🔔 Initializing NotificationManager...');
        
        this.db = firebaseServices.db;
        this.state = appState;
        
        // Core notification state
        this.processedMessages = new Set();
        this.processedMatches = new Set();
        this.unreadMessages = new Map();
        this.lastSeenTimestamps = new Map();
        this.lastNotificationTimes = new Map();
        this.notificationQueue = [];
        
        // Track initialization to prevent data loss
        this.isInitialized = false;
        
        // Notification sound
        this.notificationSound = null;
        
        // Cleanup interval
        this.cleanupInterval = null;
        
        // Active listeners
        this.notificationListener = null;
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize notification system
     */
    init() {
        console.log('🔔 [STEP-1] NotificationManager init at:', Date.now());
        
        // Load persisted state
        this.loadProcessedMessages();
        this.loadUnreadStateFromStorage();
        this.loadLastSeenTimestamps();
        
        // Setup sound
        this.setupSound();
        
        // Setup cleanup
        this.setupNotificationCleanup();
        
        // Mark as initialized
        this.isInitialized = true;
        
        // Restore notification dot on page load
        this.restoreNotificationDot();
        
        console.log('✅ NotificationManager initialized');
    }
    
    // ==================== PERSISTENCE METHODS ====================
    
    /**
     * Load processed messages from storage (user-specific)
     */
    loadProcessedMessages() {
        try {
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            const storageKey = `processedNotifications_${currentUser.uid}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only load messages from current session (last 24 hours)
                const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                parsed.forEach(id => {
                    if (id.includes('_')) {
                        const parts = id.split('_');
                        const timestamp = parseInt(parts[parts.length - 1]);
                        if (timestamp > oneDayAgo) {
                            this.processedMessages.add(id);
                        }
                    }
                });
                console.log(`📦 Loaded ${this.processedMessages.size} processed messages`);
            }
        } catch (error) {
            console.error('Error loading processed messages:', error);
        }
    }
    
    /**
     * Save processed messages to storage (user-specific)
     */
    saveProcessedMessages() {
        try {
            if (!this.isInitialized) return;
            
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            const storageKey = `processedNotifications_${currentUser.uid}`;
            const toSave = Array.from(this.processedMessages).slice(-100);
            localStorage.setItem(storageKey, JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving processed messages:', error);
        }
    }
    
    /**
     * Load unread counts from storage (user-specific)
     */
    loadUnreadStateFromStorage() {
        try {
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            const storageKey = `unreadMessages_${currentUser.uid}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([chatId, count]) => {
                    // SECURITY: Validate chatId format
                    if (chatId.match(/^[a-zA-Z0-9]+_[a-zA-Z0-9]+$/)) {
                        this.unreadMessages.set(chatId, parseInt(count) || 0);
                    }
                });
                console.log(`📦 Loaded unread counts for ${this.unreadMessages.size} chats`);
            }
        } catch (error) {
            console.error('Error loading unread state:', error);
        }
    }
    
    /**
     * Save unread counts to storage (user-specific)
     */
    saveUnreadStateToStorage() {
        try {
            if (!this.isInitialized) return;
            
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            const storageKey = `unreadMessages_${currentUser.uid}`;
            const unreadObject = {};
            this.unreadMessages.forEach((count, chatId) => {
                if (count > 0) {
                    unreadObject[chatId] = count;
                }
            });
            
            localStorage.setItem(storageKey, JSON.stringify(unreadObject));
        } catch (error) {
            console.error('Error saving unread state:', error);
        }
    }
    
    /**
     * Load last seen timestamps (user-specific)
     */
    loadLastSeenTimestamps() {
        try {
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            const storageKey = `lastSeenTimestamps_${currentUser.uid}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.entries(parsed).forEach(([chatId, timestamp]) => {
                    this.lastSeenTimestamps.set(chatId, timestamp);
                });
                console.log(`📦 Loaded ${this.lastSeenTimestamps.size} last seen timestamps`);
            }
        } catch (error) {
            console.error('Error loading last seen timestamps:', error);
        }
    }
    
    /**
     * Save last seen timestamps (user-specific)
     */
    saveLastSeenTimestamps() {
        try {
            if (!this.isInitialized) return;
            
            const currentUser = this.state.get('currentUser');
            if (!currentUser) return;
            
            const storageKey = `lastSeenTimestamps_${currentUser.uid}`;
            const timestamps = {};
            this.lastSeenTimestamps.forEach((time, chatId) => {
                timestamps[chatId] = time;
            });
            
            localStorage.setItem(storageKey, JSON.stringify(timestamps));
        } catch (error) {
            console.error('Error saving last seen timestamps:', error);
        }
    }
    
    // ==================== CORE NOTIFICATION METHODS ====================
    
    /**
     * Main notification dispatch method
     */
    async showNotification(type, data) {
        console.log(`🔔 Showing ${type} notification:`, data);
        
        switch(type) {
            case 'message':
                await this.showMessageNotification(data);
                break;
            case 'match':
                await this.showMatchNotification(data);
                break;
            case 'like':
                await this.showLikeNotification(data);
                break;
            default:
                console.warn(`Unknown notification type: ${type}`);
        }
    }
    
    /**
     * Show message notification
     */
    async showMessageNotification(data) {
        const { message, chatId, partnerInfo } = data;
        
        // Check if we should show notification
        if (!this.shouldShowNotification(message, chatId)) {
            return;
        }
        
        // Mark as processed
        const messageId = `${chatId}_${message.timestamp}_${message.senderId}`;
        this.processedMessages.add(messageId);
        this.saveProcessedMessages();
        
        // Play sound
        this.playSound();
        
        // Sanitize content for security
        const safeName = sanitizeText(partnerInfo?.name || 'Someone');
        const safeText = sanitizeText(message.text || '');
        
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
            try {
                new Notification(`New message from ${safeName}`, {
                    body: safeText.substring(0, 100),
                    icon: partnerInfo?.avatar || '/favicon.ico',
                    tag: chatId,
                    requireInteraction: false
                });
            } catch (error) {
                console.log('Browser notification failed:', error);
            }
        }
        
        // Show in-app toast
        this.showToast(`💬 ${safeName}: ${safeText}`);
        
        // Update unread count
        this.updateUnreadCount(chatId, 1);
    }
    
    /**
     * Show match notification and popup
     */
    async showMatchNotification(data) {
        console.log('🎉 Showing match notification:', data);
        
        const { matchId, partnerId, partnerName, partnerPhoto } = data;
        
        // Check if already shown
        if (this.processedMatches.has(matchId)) {
            console.log('Match already processed:', matchId);
            return;
        }
        
        // Mark as processed
        this.processedMatches.add(matchId);
        
        // Play sound
        this.playSound();
        
        // Show browser notification
        if (Notification.permission === 'granted') {
            try {
                new Notification("It's a Match! 🎉", {
                    body: `You and ${partnerName} liked each other!`,
                    icon: partnerPhoto || '/favicon.ico',
                    tag: `match_${matchId}`,
                    requireInteraction: false
                });
            } catch (error) {
                console.log('Browser notification failed:', error);
            }
        }
        
        // Show match popup
        this.showMatchPopup({
            uid: partnerId,
            name: partnerName,
            image: partnerPhoto
        });
        
        // Show in-app toast
        this.showToast(`🎉 It's a match with ${partnerName}!`);
    }
    
    /**
     * Show like notification
     */
    async showLikeNotification(data) {
        const { fromUser, likeId } = data;
        
        // Check if already processed
        if (this.processedMessages.has(likeId)) {
            return;
        }
        
        this.processedMessages.add(likeId);
        this.saveProcessedMessages();
        
        // Play sound
        this.playSound();
        
        // Show toast
        const safeName = sanitizeText(fromUser?.name || 'Someone');
        this.showToast(`💕 ${safeName} liked you!`);
    }
    
    // ==================== UI UPDATE METHODS ====================
    
    /**
     * Show notification dot with optional count
     */
    showNotificationDot(count = null) {
        const notificationDot = document.getElementById('messageNotificationDot');
        const countBadge = document.getElementById('unreadCountBadge');
        
        const numCount = parseInt(count) || 0;
        
        console.log(`🔴 Showing notification dot with count: ${numCount}`);
        
        if (numCount > 0) {
            // Show the red dot
            if (notificationDot) {
                notificationDot.classList.add('show');
            }
            
            // Show count badge if it exists
            if (countBadge) {
                countBadge.textContent = numCount > 99 ? '99+' : numCount.toString();
                countBadge.classList.add('show');
            }
            
            // Update document title
            document.title = `(${numCount}) CLASSIFIED - Hoi An Social Discovery`;
        }
    }
    
    /**
     * Hide notification dot
     */
    hideNotificationDot() {
        console.log('⚪ Hiding notification dot');
        
        const notificationDot = document.getElementById('messageNotificationDot');
        const countBadge = document.getElementById('unreadCountBadge');
        
        if (notificationDot) {
            notificationDot.classList.remove('show');
        }
        
        if (countBadge) {
            countBadge.classList.remove('show');
            countBadge.textContent = '';
        }
        
        // Reset document title
        document.title = 'CLASSIFIED - Hoi An Social Discovery';
    }
    
    /**
     * Update unread count for a chat
     */
    updateUnreadCount(chatId, delta) {
        const current = this.unreadMessages.get(chatId) || 0;
        const newCount = Math.max(0, current + delta);
        
        console.log(`📊 Updating unread for ${chatId}: ${current} → ${newCount}`);
        
        this.unreadMessages.set(chatId, newCount);
        this.saveUnreadStateToStorage();
        
        // Update total
        const totalUnread = this.getTotalUnread();
        
        if (totalUnread > 0) {
            this.showNotificationDot(totalUnread);
        } else {
            this.hideNotificationDot();
        }
        
        return newCount;
    }
    
    /**
     * Mark chat as read
     */
    markChatAsRead(chatId) {
        console.log(`✅ Marking chat ${chatId} as read`);
        
        this.unreadMessages.set(chatId, 0);
        this.lastSeenTimestamps.set(chatId, Date.now());
        
        this.saveUnreadStateToStorage();
        this.saveLastSeenTimestamps();
        
        // Update UI
        const totalUnread = this.getTotalUnread();
        if (totalUnread === 0) {
            this.hideNotificationDot();
        } else {
            this.showNotificationDot(totalUnread);
        }
    }
    
    /**
     * Get total unread count
     */
    getTotalUnread() {
        let total = 0;
        this.unreadMessages.forEach(count => {
            total += count;
        });
        return total;
    }
    
    /**
     * Restore notification dot on page load
     */
    restoreNotificationDot() {
        setTimeout(() => {
            const totalUnread = this.getTotalUnread();
            
            if (totalUnread > 0) {
                console.log(`🔔 Restoring ${totalUnread} unread on page load`);
                this.showNotificationDot(totalUnread);
            }
        }, 500);
    }
    
    // ==================== MATCH POPUP METHODS ====================
    
    /**
     * Show match popup (extracted from matching.js)
     */
    showMatchPopup(userData) {
        console.log('🎉 [MATCH-POPUP-DEBUG] Showing match popup for:', userData);
        console.log('🎉 [MATCH-POPUP-DEBUG] Device info:', {
            userAgent: navigator.userAgent,
            isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
            viewport: { width: window.innerWidth, height: window.innerHeight }
        });
        
        const matchPopup = document.getElementById('matchPopup');
        if (!matchPopup) {
            console.error('❌ [MATCH-POPUP-DEBUG] Match popup element not found');
            return;
        }
        
        console.log('🎉 [MATCH-POPUP-DEBUG] Popup element found:', {
            display: matchPopup.style.display,
            visibility: matchPopup.style.visibility,
            zIndex: matchPopup.style.zIndex,
            hasShowClass: matchPopup.classList.contains('show')
        });
        
        // Prevent duplicate popups
        if (matchPopup.classList.contains('show')) {
            console.log('⚠️ [MATCH-POPUP-DEBUG] Match popup already showing');
            return;
        }
        
        // Update popup content
        const popupImage = matchPopup.querySelector('.match-popup-image');
        const popupText = matchPopup.querySelector('p');
        const startChatBtn = matchPopup.querySelector('#startChatBtn');
        const keepSwipingBtn = matchPopup.querySelector('#keepSwipingBtn');
        
        if (popupImage) {
            popupImage.src = userData.image || 'https://via.placeholder.com/100';
            popupImage.alt = userData.name;
        }
        
        if (popupText) {
            const safeName = sanitizeText(userData.name);
            popupText.textContent = `You and ${safeName} both liked each other!`;
        }
        
        // Store match data for chat button
        this.state.set('lastMatchedUser', userData);
        
        // Setup button handlers
       if (startChatBtn) {
            startChatBtn.onclick = () => {
                matchPopup.classList.remove('show');
                matchPopup.style.display = 'none'; // iOS fix
                console.log('💬 [MATCH-POPUP-DEBUG] Starting chat from match');
                this.startChatFromMatch();
            };
        }
        
        if (keepSwipingBtn) {
            keepSwipingBtn.onclick = () => {
                matchPopup.classList.remove('show');
                matchPopup.style.display = 'none'; // iOS fix
                console.log('✅ [MATCH-POPUP-DEBUG] Match saved to inbox');
            };
        }
        
        // CRITICAL FIX: Force inline styles for iOS Safari compatibility
        // iOS Safari has issues with position: fixed in certain contexts
        matchPopup.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            -webkit-transform: translate(-50%, -50%) !important;
            z-index: 999999 !important;
            display: flex !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
        `;
        
        // Show popup (add class after inline styles)
        matchPopup.classList.add('show');
        
        console.log('✅ [MATCH-POPUP-DEBUG] Popup should now be visible');
        console.log('✅ [MATCH-POPUP-DEBUG] Final styles:', {
            display: matchPopup.style.display,
            zIndex: matchPopup.style.zIndex,
            position: matchPopup.style.position,
            transform: matchPopup.style.transform
        });
        
        // Auto-close after 15 seconds
       setTimeout(() => {
            if (matchPopup.classList.contains('show')) {
                matchPopup.classList.remove('show');
                matchPopup.style.display = 'none'; // iOS Safari fix
                console.log('✅ [MATCH-POPUP-DEBUG] Match popup auto-closed');
            }
        }, 15000);
    }
    
    /**
     * Start chat from match (delegates to messaging manager)
     */
    startChatFromMatch() {
        const matchedUser = this.state.get('lastMatchedUser');
        if (!matchedUser) {
            console.error('No matched user found');
            return;
        }
        
        console.log('🚀 Starting chat with:', matchedUser.name);
        
        // Switch to messaging tab
        const feedManager = window.classifiedApp?.managers?.feed;
        if (feedManager) {
            feedManager.switchSocialTab('messaging');
        }
        
        // Open chat after UI updates
        setTimeout(() => {
            const messagingManager = window.classifiedApp?.managers?.messaging;
            if (messagingManager) {
                messagingManager.openChat(
                    matchedUser.name,
                    matchedUser.image,
                    matchedUser.uid
                );
            }
        }, 300);
    }
    
    // ==================== TOAST & SOUND METHODS ====================
    
    /**
     * Show in-app toast notification
     */
    showToast(text, duration = 4000) {
        // Remove existing toast
        const existing = document.querySelector('.notification-toast');
        if (existing) {
            existing.remove();
        }
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        
        // SECURITY: Use textContent not innerHTML
        toast.textContent = text;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 212, 255, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            max-width: 300px;
            z-index: 9999;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => toast.remove(), duration);
    }
    
    /**
     * Setup notification sound
     */
    setupSound() {
        try {
            // Create notification sound (base64 encoded beep)
            this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYrTp66hVFApGn+DyvmEaAzqM0+/ReigGHXM=');
            this.notificationSound.volume = 0.3;
            console.log('🔊 Notification sound ready');
        } catch (error) {
            console.error('Failed to setup notification sound:', error);
        }
    }
    
    /**
     * Play notification sound
     */
    playSound() {
        if (this.notificationSound) {
            this.notificationSound.currentTime = 0;
            this.notificationSound.play().catch(error => {
                console.log('Sound play failed:', error);
            });
        }
    }
    
    // ==================== FIREBASE NOTIFICATION METHODS ====================
    
    /**
     * Send match notification to Firebase
     */
    async sendMatchNotification(toUserId, matchedWithUserId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', matchedWithUserId));
            const userData = userDoc.data();
            
            await addDoc(collection(this.db, 'notifications'), {
                userId: toUserId,
                type: 'match',
                title: "It's a Match! 🎉",
                message: `You and ${userData?.name || 'someone'} liked each other!`,
                matchId: [toUserId, matchedWithUserId].sort().join('_'),
                partnerId: matchedWithUserId,
                partnerName: userData?.name,
                partnerPhoto: userData?.photos?.[0] || userData?.photo,
                timestamp: serverTimestamp(),
                read: false
            });
            
            console.log('📬 Match notification sent to Firebase');
        } catch (error) {
            console.error('Error sending match notification:', error);
        }
    }
    
    /**
     * Send like notification to Firebase
     */
    async sendLikeNotification(toUserId, fromUser) {
        try {
            await addDoc(collection(this.db, 'notifications'), {
                userId: toUserId,
                type: 'like',
                title: 'New Like! 💕',
                message: `${fromUser.displayName || 'Someone'} liked you`,
                fromUserId: fromUser.uid,
                timestamp: serverTimestamp(),
                read: false
            });
            
            console.log('📬 Like notification sent to Firebase');
        } catch (error) {
            console.error('Error sending like notification:', error);
        }
    }
    
    /**
     * Listen for notifications from Firebase
     */
    listenForNotifications(userId) {
        console.log('👂 Setting up notification listener for:', userId);
        
        // Clean up existing listener
        if (this.notificationListener) {
            this.notificationListener();
            this.notificationListener = null;
        }
        
        try {
            const notificationsRef = collection(this.db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId),
                where('read', '==', false),
                orderBy('timestamp', 'desc'),
                limit(10)
            );
            
            this.notificationListener = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        console.log('📬 New notification received:', data);
                        
                        // Process based on type
                        if (data.type === 'match') {
                            this.showMatchNotification(data);
                        } else if (data.type === 'like') {
                            this.showLikeNotification(data);
                        }
                    }
                });
            }, (error) => {
                console.error('Error in notification listener:', error);
            });
            
        } catch (error) {
            console.error('Error setting up notification listener:', error);
        }
    }
    
    // ==================== UTILITY METHODS ====================
    
    /**
     * Check if we should show a notification
     */
    shouldShowNotification(message, chatId) {
        // Don't show for old messages
        const messageTime = message.timestamp || 0;
        const tenSecondsAgo = Date.now() - 10000;
        
        if (messageTime < tenSecondsAgo) {
            return false;
        }
        
        // Check if already processed
        const messageId = `${chatId}_${message.timestamp}_${message.senderId}`;
        if (this.processedMessages.has(messageId)) {
            return false;
        }
        
        // Check if chat is currently open
        const messagingManager = window.classifiedApp?.managers?.messaging;
        if (messagingManager && messagingManager.currentChatId === chatId) {
            return false;
        }
        
        // Check rate limiting
        const lastNotificationTime = this.lastNotificationTimes.get(chatId) || 0;
        const timeSinceLastNotification = Date.now() - lastNotificationTime;
        
        if (timeSinceLastNotification < 2000) {
            return false;
        }
        
        this.lastNotificationTimes.set(chatId, Date.now());
        return true;
    }
    
    /**
     * Setup periodic cleanup
     */
    setupNotificationCleanup() {
        this.cleanupInterval = setInterval(() => {
            // Clean up old processed messages
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const newProcessed = new Set();
            
            this.processedMessages.forEach(id => {
                if (id.includes('_')) {
                    const parts = id.split('_');
                    const timestamp = parseInt(parts[parts.length - 1]);
                    if (timestamp > oneDayAgo) {
                        newProcessed.add(id);
                    }
                }
            });
            
            this.processedMessages = newProcessed;
            
            // Clean up old toasts
            document.querySelectorAll('.notification-toast').forEach(toast => {
                toast.remove();
            });
            
            console.log('🧹 Cleaned up old notifications');
        }, 60000); // Every minute
    }
    
    /**
     * Cleanup on destroy
     */
    cleanup() {
        console.log('🧹 Cleaning up NotificationManager...');
        
        // Clear interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Remove listener
        if (this.notificationListener) {
            this.notificationListener();
            this.notificationListener = null;
        }
        
        // Save state
        this.saveProcessedMessages();
        this.saveUnreadStateToStorage();
        this.saveLastSeenTimestamps();
        
        // Remove any lingering toasts
        document.querySelectorAll('.notification-toast').forEach(el => el.remove());
        
        console.log('✅ NotificationManager cleanup complete');
    }
}
