// javascript/features/notifications.js

import { sanitizeText } from '../utils/security.js';

/**
 * Dedicated Notification Manager with Security
 */
export class NotificationManager {
    constructor(firebaseServices, appState) {
        this.db = firebaseServices.db;
        this.state = appState;
        
        // Notification state
        this.processedMessages = new Set();
        this.sessionStartTime = Date.now();
        this.unreadMessages = new Map(); // MOVED from messaging.js
        this.lastNotificationTimes = new Map(); // MOVED from messaging.js
        
        // Load state
        this.loadProcessedMessages();
        this.loadUnreadStateFromStorage(); // MOVED from messaging.js
        
        // Sound & cleanup
        this.notificationSound = null;
        this.cleanupInterval = null;
        this.setupSound();
        this.setupNotificationCleanup(); // MOVED from messaging.js
    }
    
    // MOVED from messaging.js
    loadUnreadStateFromStorage() {
        try {
            const savedUnreadState = localStorage.getItem('unreadMessages');
            if (savedUnreadState) {
                const parsed = JSON.parse(savedUnreadState);
                Object.entries(parsed).forEach(([chatId, count]) => {
                    // SECURITY: Validate chatId format (should be userId1_userId2)
                    if (chatId.match(/^[a-zA-Z0-9]+_[a-zA-Z0-9]+$/)) {
                        this.unreadMessages.set(chatId, parseInt(count) || 0);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading unread state:', error);
        }
    }
    
    // MOVED from messaging.js
    saveUnreadStateToStorage() {
        try {
            const unreadObject = {};
            this.unreadMessages.forEach((count, chatId) => {
                if (count > 0) {
                    unreadObject[chatId] = count;
                }
            });
            localStorage.setItem('unreadMessages', JSON.stringify(unreadObject));
        } catch (error) {
            console.error('Error saving unread state:', error);
        }
    }
    
    loadProcessedMessages() {
        try {
            const saved = localStorage.getItem('processedMessages');
            if (saved) {
                const parsed = JSON.parse(saved);
                const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                parsed.forEach(item => {
                    if (item.timestamp > oneDayAgo) {
                        this.processedMessages.add(item.id);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading processed messages:', error);
        }
    }
    
    saveProcessedMessages() {
        try {
            const toSave = Array.from(this.processedMessages).map(id => ({
                id,
                timestamp: Date.now()
            }));
            localStorage.setItem('processedMessages', JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving processed messages:', error);
        }
    }
    
        shouldShowNotification(message, chatId) {
        const currentUser = this.state.get('currentUser');
        
        // Never notify for own messages
        if (message.senderId === currentUser?.uid) {
            return false;
        }
        
        // SECURITY: Ensure chat ID is properly sorted
        const participants = chatId.split('_');
        const sortedChatId = participants.sort().join('_');
        if (chatId !== sortedChatId) {
            console.error('Chat ID not sorted:', chatId);
            return false;
        }
        
        // FIX: Get message timestamp properly
        const messageTime = message.timestamp?.toMillis?.() || 
                           message.timestamp?.seconds ? (message.timestamp.seconds * 1000) : 
                           Date.now();
        
        // Create unique message ID
        const messageId = `${chatId}_${messageTime}_${message.senderId}`;
        
        // Check if already processed
        if (this.processedMessages.has(messageId)) {
            return false;
        }
        
        // FIX: Check against last app close time from localStorage
        const lastAppClose = parseInt(localStorage.getItem('lastAppClose') || '0', 10);
        const appStartTime = parseInt(localStorage.getItem('appStartTime') || Date.now().toString(), 10);
        
        // Only notify for messages that arrived while app was closed
        const shouldNotify = messageTime > lastAppClose && messageTime < appStartTime;
        
        if (shouldNotify) {
            // Check cooldown
            const lastNotificationTime = this.lastNotificationTimes.get(chatId) || 0;
            if (Date.now() - lastNotificationTime < 5000) { // 5 second cooldown
                return false;
            }
            
            // Mark as processed
            this.processedMessages.add(messageId);
            this.saveProcessedMessages();
            this.lastNotificationTimes.set(chatId, Date.now());
            
            return true;
        }
        
        // Always mark as processed to prevent future notifications
        this.processedMessages.add(messageId);
        this.saveProcessedMessages();
        
        return false;
    }
        
    showNotification(message, chatId, partnerInfo) {
        // SECURITY: Sanitize all text before display
        const safeText = sanitizeText(message.text);
        const safeName = sanitizeText(partnerInfo.name);
        
        // Play sound
        this.playSound();
        
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
            new Notification(`New message from ${safeName}`, {
                body: safeText.substring(0, 100), // Limit length
                icon: partnerInfo.avatar || '/favicon.ico',
                tag: chatId,
                requireInteraction: false
            });
        }
        
        // Show in-app toast
        this.showToast(`💬 ${safeName}: ${safeText}`);
    }
    
    playSound() {
        if (this.notificationSound) {
            this.notificationSound.currentTime = 0;
            this.notificationSound.play().catch(() => {});
        }
    }
    
    showToast(text) {
        const existing = document.querySelector('.notification-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        // SECURITY: Use textContent, not innerHTML
        toast.textContent = text;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: rgba(0,212,255,0.95); color: white;
            padding: 12px 20px; border-radius: 8px;
            max-width: 300px; z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 4000);
    }
    
    // MOVED from messaging.js - UI notification methods
    showNotificationDot(count = null) {
        const notificationDot = document.getElementById('messageNotificationDot');
        const countBadge = document.getElementById('unreadCountBadge');
        
        if (count && count > 0) {
            if (notificationDot) notificationDot.style.display = 'none';
            if (countBadge) {
                countBadge.style.display = 'flex';
                // SECURITY: Ensure count is a number
                countBadge.textContent = (parseInt(count) > 99 ? '99+' : count.toString());
            }
        } else {
            if (notificationDot) notificationDot.style.display = 'block';
            if (countBadge) countBadge.style.display = 'none';
        }
    }
    
    hideNotificationDot() {
        const notificationDot = document.getElementById('messageNotificationDot');
        const countBadge = document.getElementById('unreadCountBadge');
        if (notificationDot) notificationDot.style.display = 'none';
        if (countBadge) countBadge.style.display = 'none';
    }
    
    // MOVED from messaging.js
    updateUnreadCount(chatId, increment) {
        const current = this.unreadMessages.get(chatId) || 0;
        const newCount = Math.max(0, current + increment);
        
        this.unreadMessages.set(chatId, newCount);
        this.saveUnreadStateToStorage();
        
        // Calculate total
        const totalUnread = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
        
        if (totalUnread > 0) {
            this.showNotificationDot(totalUnread);
        } else {
            this.hideNotificationDot();
        }
    }
    
    // MOVED from messaging.js
    markChatAsRead(chatId) {
        this.unreadMessages.set(chatId, 0);
        this.saveUnreadStateToStorage();
        
        const totalUnread = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
        if (totalUnread === 0) {
            this.hideNotificationDot();
        } else {
            this.showNotificationDot(totalUnread);
        }
    }
    
    // MOVED from messaging.js
    setupNotificationCleanup() {
        this.cleanupInterval = setInterval(() => {
            // Clean up old processed messages
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const newProcessed = new Set();
            this.processedMessages.forEach(id => {
                // Extract timestamp from ID format: chatId_timestamp_senderId
                const parts = id.split('_');
                if (parts.length >= 3) {
                    const timestamp = parseInt(parts[parts.length - 2]);
                    if (timestamp > oneDayAgo) {
                        newProcessed.add(id);
                    }
                }
            });
            this.processedMessages = newProcessed;
            
            // Clean up old in-app notifications
            document.querySelectorAll('.notification-toast').forEach(toast => {
                toast.remove();
            });
        }, 60000); // Every minute
    }
    
    setupSound() {
        this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYrTp66hVFApGn+DyvmEaAzqM0+/ReigGHXM=');
        this.notificationSound.volume = 0.3;
    }
    
    cleanup() {
        // SECURITY: Clean up listeners and intervals
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Save state
        this.saveProcessedMessages();
        this.saveUnreadStateToStorage();
        
        // Remove any lingering notifications
        document.querySelectorAll('.notification-toast').forEach(el => el.remove());
    }
}
