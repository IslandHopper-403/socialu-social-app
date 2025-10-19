// javascript/features/messaging/messageListeners.js - COMPLETE VERSION 1.0
// Real-time listener management for messaging system

import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    getDoc,
    doc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * MessageListenersManager
 * Handles ALL real-time Firebase listeners for messaging
 * Extracted from messaging.js to separate concerns
 */
export class MessageListenersManager {
    constructor(firebaseServices, appState, messagingManager) {
        console.log('🎧 Initializing MessageListenersManager...');
        
        // Core dependencies
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        this.messaging = messagingManager; // Reference back to parent
        
        // Get reference to MatchingManager for seenMatches
        this.matchingManager = null; // Will be set via setMatchingManager()
        
        // Listener tracking
        this.activeListeners = new Map(); // id -> {unsubscribe, type, createdAt}
        
        // Cleanup interval
        this.listenerCleanupInterval = null;
        
        // Start automatic stale listener cleanup
        this.startCleanupInterval();
        
        console.log('✅ MessageListenersManager initialized');
    }
    
    /**
     * Start automatic cleanup of stale listeners
     */
    startCleanupInterval() {
        // Clean up stale listeners every 5 minutes
        this.listenerCleanupInterval = setInterval(() => {
            console.log('🧹 [LISTENERS] Running automatic stale listener cleanup');
            this.cleanupStaleListeners();
        }, 300000); // 5 minutes
        
        console.log('⏰ [LISTENERS] Cleanup interval started (5 min)');
    }
    
    /**
     * Set reference to MatchingManager (called after initialization)
     */
    setMatchingManager(matchingManager) {
        this.matchingManager = matchingManager;
        console.log('🔗 [LISTENERS] MatchingManager reference set');
    }
    
    /**
     * Register a listener with tracking
     */
    registerListener(id, unsubscribe, type = 'generic') {
        console.log(`📌 [LISTENERS] Registering listener: ${id} (type: ${type})`);
        
        if (this.activeListeners.has(id)) {
            console.warn(`⚠️ [LISTENERS] Replacing existing listener: ${id}`);
            const existing = this.activeListeners.get(id);
            try {
                existing.unsubscribe();
            } catch (error) {
                console.error(`Error unsubscribing old listener ${id}:`, error);
            }
        }
        
        this.activeListeners.set(id, {
            unsubscribe,
            type,
            createdAt: Date.now()
        });
        
        console.log(`✅ [LISTENERS] Registered: ${id} | Total active: ${this.activeListeners.size}`);
    }
    
    /**
     * Unregister a specific listener
     */
    unregisterListener(id) {
        console.log(`🗑️ [LISTENERS] Unregistering listener: ${id}`);
        
        const listener = this.activeListeners.get(id);
        if (listener) {
            try {
                listener.unsubscribe();
                this.activeListeners.delete(id);
                console.log(`✅ [LISTENERS] Unregistered: ${id} | Remaining: ${this.activeListeners.size}`);
            } catch (error) {
                console.error(`❌ [LISTENERS] Error unregistering ${id}:`, error);
            }
        }
        // Note: Silently ignore if listener doesn't exist (normal on first setup)
    }
    
    /**
     * Clean up stale listeners (older than 10 minutes, excluding active chats)
     */
    cleanupStaleListeners() {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const staleListeners = [];
        
        console.log(`🔍 [LISTENERS] Scanning for stale listeners (older than 10min)...`);
        
        this.activeListeners.forEach((listener, id) => {
            const age = Date.now() - listener.createdAt;
            const ageMinutes = Math.floor(age / 60000);
            
            // Don't auto-cleanup active chat listeners
            if (listener.createdAt < tenMinutesAgo && !id.startsWith('chat_')) {
                console.log(`🗑️ [LISTENERS] Found stale listener: ${id} (${ageMinutes} min old)`);
                staleListeners.push(id);
            }
        });
        
        if (staleListeners.length > 0) {
            console.log(`🧹 [LISTENERS] Cleaning up ${staleListeners.length} stale listeners`);
            staleListeners.forEach(id => {
                this.unregisterListener(id);
            });
        } else {
            console.log(`✅ [LISTENERS] No stale listeners found`);
        }
    }
    
    /**
     * Set up all real-time listeners for a user
     */
    setupRealtimeListeners(userId) {
        if (!userId) {
            console.error('❌ [LISTENERS] Cannot setup listeners without userId');
            return;
        }
        
        console.log(`👂 [LISTENERS] Setting up real-time listeners for user: ${userId}`);
        
        try {
            // Listen for new matches
            this.listenForMatches(userId);
            
            // Listen for chat list updates
            this.listenForChatUpdates(userId);
            
            // Listen for new messages globally (for notifications)
            this.listenForNewMessages(userId);
            
            console.log(`✅ [LISTENERS] All real-time listeners active for: ${userId}`);
        } catch (error) {
            console.error('❌ [LISTENERS] Error setting up real-time listeners:', error);
        }
    }
    
    /**
     * Listen to messages in a specific chat
     */
    listenToChatMessages(chatId) {
        if (!chatId) {
            console.error('❌ [LISTENERS] Cannot listen to chat without chatId');
            return;
        }
        
        console.log(`💬 [LISTENERS] Setting up listener for chat: ${chatId}`);
        
        // Remove existing listener for this chat first (silently ignore if none exists)
        const listenerKey = `chat_${chatId}`;
        if (this.activeListeners.has(listenerKey)) {
            console.log(`🔄 [LISTENERS] Replacing existing listener for chat: ${chatId}`);
            this.unregisterListener(listenerKey);
        }
        
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            console.error('❌ [LISTENERS] No current user for chat listener');
            return;
        }
        
        // Verify database connection
        if (!this.db) {
            console.error('❌ [LISTENERS] No database connection for chat listener');
            return;
        }
        
        const messagesRef = collection(this.db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        // Track if this is the first snapshot for THIS chat
        let isInitialLoad = true;
        
        try {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                console.log(`📨 [LISTENERS] Chat ${chatId} snapshot received (${snapshot.size} messages)`);
                
                const messages = [];
                snapshot.forEach(messageDoc => {
                    messages.push({ id: messageDoc.id, ...messageDoc.data() });
                });
                
                // Only process notifications AFTER initial load
                if (!isInitialLoad) {
                    console.log(`🔔 [LISTENERS] Processing ${snapshot.docChanges().length} changes for notifications`);
                    
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const message = change.doc.data();
                            
                            if (message.senderId !== currentUser.uid) {
                                console.log(`🆕 [LISTENERS] New message from other user in chat ${chatId}`);
                                
                                // Only show notification popup, don't increment count
                                // (Count is handled by listenForChatUpdates to avoid duplicates)
                                const notificationManager = window.classifiedApp?.managers?.notifications;
                                if (notificationManager && notificationManager.shouldShowNotification(message, chatId)) {
                                    console.log(`🔔 [LISTENERS] Showing notification popup (no count increment)`);
                                    // Show toast/sound only, not count
                                    notificationManager.playSound();
                                }
                            }
                        }
                    });
                } else {
                    console.log(`📋 [LISTENERS] Initial load complete for chat ${chatId}`);
                }
                
                // Display messages via messaging manager
                this.messaging.displayMessages(messages, currentUser.uid);
                
                // Update last seen timestamp if chat is active (delegated to NotificationManager)
                if (this.messaging.currentChatId === chatId && this.messaging.isAppVisible) {
                    console.log(`✅ [LISTENERS] Chat is active and visible`);
                    const notificationManager = window.classifiedApp?.managers?.notifications;
                    if (notificationManager) {
                        notificationManager.lastSeenTimestamps.set(chatId, Date.now());
                        notificationManager.saveLastSeenTimestamps();
                    }
                }
                
                isInitialLoad = false;
                
            }, (error) => {
                console.error(`❌ [LISTENERS] Error in chat listener for ${chatId}:`, error);
                this.unregisterListener(`chat_${chatId}`);
            });
            
            this.registerListener(`chat_${chatId}`, unsubscribe, 'chat');
            console.log(`✅ [LISTENERS] Chat listener registered: ${chatId}`);
            
        } catch (error) {
            console.error(`❌ [LISTENERS] Error setting up chat listener:`, error);
        }
    }
    
    /**
     * Listen for new matches - FIXED to prevent showing old matches
     */
    listenForMatches(userId) {
        if (!userId) {
            console.error('❌ [LISTENERS] Cannot listen for matches without userId');
            return;
        }
        
        console.log(`🎉 [LISTENERS] Setting up match listener for user: ${userId}`);
        
        // Remove existing listener
        this.unregisterListener('matches_global');
        
        try {
            const matchesRef = collection(this.db, 'matches');
            const q = query(
                matchesRef,
                where('users', 'array-contains', userId)
            );
            
            // Track initial load and session start time
            let isInitialLoad = true;
            const sessionStartTime = Date.now();
            const thirtySecondsAgo = Date.now() - 30000; // 30 second window
            
           // Ensure MatchingManager has loaded seenMatches
            if (!this.matchingManager) {
                console.warn('⚠️ [LISTENERS] MatchingManager not available for match tracking');
                return;
            }
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                console.log(`🎯 [LISTENERS] Match snapshot received (${snapshot.size} total matches)`);
                
                if (isInitialLoad) {
                    console.log(`📋 [LISTENERS] Initial match load - marking ${snapshot.size} existing matches as seen`);
                    
                    // Mark ALL existing matches as seen (no popups for old matches)
                    snapshot.forEach(doc => {
                        const matchId = doc.id;
                       const matchData = doc.data();
                        
                        this.matchingManager.seenMatches.add(matchId);
                        
                   // Store match timestamp for future validation
                    const matchTime = matchData.timestamp?.toDate?.()?.getTime() || 0;
                    localStorage.setItem(`match_time_${matchId}`, matchTime.toString());
                });
                
               // Save seenMatches via MatchingManager
                if (this.matchingManager) {
                    this.matchingManager.saveSeenMatches();
                }
                isInitialLoad = false;
                console.log(`✅ [LISTENERS] Initial match load complete, marked all as seen`);
                return;
            }
                
                // Process changes ONLY after initial load
                console.log(`🔍 [LISTENERS] Processing ${snapshot.docChanges().length} match changes`);
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const matchId = change.doc.id;
                        const matchData = change.doc.data();
                        
                        console.log(`🆕 [LISTENERS] New match detected: ${matchId}`);
                        
                       // Skip if already seen
                        if (this.matchingManager.seenMatches.has(matchId)) {
                            console.log(`⏭️ [LISTENERS] Skipping already seen match: ${matchId}`);
                            return;
                        }
                        
                        // Get match timestamp
                        const matchTime = matchData.timestamp?.toDate?.() || new Date();
                        const matchTimeMs = matchTime.getTime();
                        
                        // THREE validation checks for match popup
                        
                        // 1. Must be created AFTER this session started
                       if (matchTimeMs < sessionStartTime) {
                            console.log(`⏭️ [LISTENERS] Match ${matchId} is from before session (age: ${Math.round((Date.now() - matchTimeMs) / 1000)}s)`);
                            this.matchingManager.seenMatches.add(matchId);
                            localStorage.setItem(`match_time_${matchId}`, matchTimeMs.toString());
                            this.matchingManager.saveSeenMatches();
                            return;
                        }
                        
                        // 2. Must be less than 30 seconds old
                        const timeDiff = Date.now() - matchTimeMs;
                       if (timeDiff > 30000) {
                            console.log(`⏭️ [LISTENERS] Match ${matchId} is too old (${Math.round(timeDiff / 1000)}s)`);
                            this.matchingManager.seenMatches.add(matchId);
                            localStorage.setItem(`match_time_${matchId}`, matchTimeMs.toString());
                            this.matchingManager.saveSeenMatches();
                            return;
                        }
                        
                        // 3. Must be created after the 30-second window started
                      if (matchTimeMs < thirtySecondsAgo) {
                            console.log(`⏭️ [LISTENERS] Match ${matchId} outside 30s window`);
                            this.matchingManager.seenMatches.add(matchId);
                            localStorage.setItem(`match_time_${matchId}`, matchTimeMs.toString());
                            this.matchingManager.saveSeenMatches();
                            return;
                        }
                        
                       // This is a genuinely NEW, RECENT match!
                        console.log(`🎉 [LISTENERS] GENUINE NEW MATCH: ${matchId} (age: ${Math.round(timeDiff / 1000)}s)`);
                        this.matchingManager.seenMatches.add(matchId);
                        
                        // Save seenMatches via MatchingManager
                        if (this.matchingManager) {
                            this.matchingManager.saveSeenMatches();
                        }
                        
                        // Delegate to NotificationManager for match popup
                        const notificationManager = window.classifiedApp?.managers?.notifications;
                        if (notificationManager) {
                            const currentUser = this.state.get('currentUser');
                            const partnerId = matchData.users.find(id => id !== currentUser?.uid);
                            
                            if (partnerId) {
                                console.log(`📬 [LISTENERS] Delegating to NotificationManager for match popup`);
                                
                                // Get partner data and show match notification
                                getDoc(doc(this.db, 'users', partnerId)).then(partnerDoc => {
                                    if (partnerDoc.exists()) {
                                        const partnerData = partnerDoc.data();
                                        notificationManager.showNotification('match', {
                                            matchId: matchId,
                                            partnerId: partnerId,
                                            partnerName: partnerData.name || 'User',
                                            partnerPhoto: partnerData.photos?.[0] || 'https://via.placeholder.com/100'
                                        });
                                    }
                                }).catch(error => {
                                    console.error('Error fetching partner data for match:', error);
                                });
                            }
                        } else {
                            console.warn('⚠️ [LISTENERS] NotificationManager not available for match popup');
                        }
                    }
                });
                
            }, (error) => {
                console.error('❌ [LISTENERS] Error in match listener:', error);
                this.unregisterListener('matches_global');
            });
            
            this.registerListener('matches_global', unsubscribe, 'match');
            console.log(`✅ [LISTENERS] Match listener registered for user: ${userId}`);
            
        } catch (error) {
            console.error('❌ [LISTENERS] Error setting up match listener:', error);
        }
    }
    
    /**
     * Listen for chat list updates (unread counts, new chats)
     */
    listenForChatUpdates(userId) {
        if (!userId) {
            console.error('❌ [LISTENERS] Cannot listen for chat updates without userId');
            return;
        }
        
        console.log(`💬 [LISTENERS] Setting up chat updates listener for user: ${userId}`);
        
        // Remove existing listener
        this.unregisterListener('chat_updates_global');
        
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            let isInitialLoad = true;
            
            const unsubscribe = onSnapshot(q, async (snapshot) => {
                console.log(`📊 [LISTENERS] Chat updates snapshot (${snapshot.size} chats)`);
                
                if (isInitialLoad) {
                    console.log(`📋 [LISTENERS] Initial chat load - processing unread counts`);
                    
                    snapshot.forEach(doc => {
                        const chatData = doc.data();
                        const chatId = doc.id;
                        
                        if (chatData.lastMessageSender && 
                            chatData.lastMessageSender !== userId &&
                            chatData.lastMessageTime) {
                            
                            const messageTime = chatData.lastMessageTime.toMillis ? 
                                chatData.lastMessageTime.toMillis() : 0;
                            
                            // On initial load, only count as unread if newer than last session
                            if (messageTime > this.messaging.lastAppActive) {
                                console.log(`🔔 [LISTENERS] Found unread chat on init: ${chatId}`);
                                const notificationManager = window.classifiedApp?.managers?.notifications;
                                if (notificationManager) {
                                    const currentUnread = notificationManager.unreadMessages.get(chatId) || 0;
                                    if (!notificationManager.unreadMessages.has(chatId) || 
                                        notificationManager.unreadMessages.get(chatId) > 0) {
                                        notificationManager.updateUnreadCount(chatId, 1);
                                    }
                                }
                            }
                        }
                    });
                    
                    isInitialLoad = false;
                    
                    // Update total unread count
                    const notificationManager = window.classifiedApp?.managers?.notifications;
                    if (notificationManager) {
                        const total = notificationManager.getTotalUnread();
                        if (total > 0) {
                            console.log(`🔔 [LISTENERS] Total unread on init: ${total}`);
                            notificationManager.showNotificationDot(total);
                        }
                    }
                    
                    // Reload chat list
                    await this.messaging.loadChats();
                    console.log(`✅ [LISTENERS] Initial chat load complete`);
                    return;
                }
                
                // Process changes after initial load
                console.log(`🔍 [LISTENERS] Processing ${snapshot.docChanges().length} chat changes`);
                
                // Track processed messages to prevent duplicates
                const processedMessages = new Set();
                
                for (const change of snapshot.docChanges()) {
                    if (change.type === 'modified') {
                        const chatData = change.doc.data();
                        const chatId = change.doc.id;
                        
                        if (chatData.lastMessageSender && 
                            chatData.lastMessageSender !== userId &&
                            this.messaging.currentChatId !== chatId &&
                            chatData.lastMessageTime) {
                            
                            const messageTime = chatData.lastMessageTime.toMillis();
                            
                            // Create unique message identifier
                            const messageId = `${chatId}_${messageTime}_${chatData.lastMessageSender}`;
                            
                            // Only process if not already seen
                            if (!processedMessages.has(messageId) && messageTime > this.messaging.lastAppActive) {
                                processedMessages.add(messageId);
                                console.log(`🆕 [LISTENERS] New message in chat: ${chatId} (deduped)`);
                                
                                const notificationManager = window.classifiedApp?.managers?.notifications;
                                if (notificationManager) {
                                    notificationManager.updateUnreadCount(chatId, 1);
                                }
                            }
                        }
                    }
                }
                
                // Reload chat list to reflect changes
                await this.messaging.loadChats();
                
            }, (error) => {
                console.error('❌ [LISTENERS] Error in chat updates listener:', error);
                this.unregisterListener('chat_updates_global');
            });
            
            this.registerListener('chat_updates_global', unsubscribe, 'chat_update');
            console.log(`✅ [LISTENERS] Chat updates listener registered for user: ${userId}`);
            
        } catch (error) {
            console.error('❌ [LISTENERS] Error setting up chat updates listener:', error);
        }
    }
    
    /**
     * Listen for new messages globally (for notifications when not in chat)
     */
    listenForNewMessages(userId) {
        if (!userId) {
            console.error('❌ [LISTENERS] Cannot listen for new messages without userId');
            return;
        }
        
        console.log(`📬 [LISTENERS] Setting up global message listener for user: ${userId}`);
        
        // Remove existing listener
        this.unregisterListener('messages_global');
        
        try {
            const chatsRef = collection(this.db, 'chats');
            const q = query(
                chatsRef,
                where('participants', 'array-contains', userId)
            );
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                console.log(`📨 [LISTENERS] Global messages snapshot (${snapshot.docChanges().length} changes)`);
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified') {
                        const chatData = change.doc.data();
                        const chatId = change.doc.id;
                        
                        if (chatData.lastMessageSender && chatData.lastMessageSender !== userId) {
                            if (this.messaging.currentChatId !== chatId) {
                                console.log(`🔔 [LISTENERS] New message in chat: ${chatId}`);
                                
                                // Show notification popup only (count handled by listenForChatUpdates)
                                const notificationManager = window.classifiedApp?.managers?.notifications;
                                if (notificationManager) {
                                    notificationManager.showNotification('message', {
                                        message: { 
                                            text: chatData.lastMessage, 
                                            senderId: chatData.lastMessageSender 
                                        },
                                        chatId: chatId,
                                        partnerInfo: { name: 'User' }
                                    });
                                    // NOTE: Count update removed - handled by listenForChatUpdates
                                }
                            }
                        }
                    }
                });
                
            }, (error) => {
                console.error('❌ [LISTENERS] Error in global message listener:', error);
                this.unregisterListener('messages_global');
            });
            
            this.registerListener('messages_global', unsubscribe, 'message');
            console.log(`✅ [LISTENERS] Global message listener registered for user: ${userId}`);
            
        } catch (error) {
            console.error('❌ [LISTENERS] Error setting up global message listener:', error);
        }
    }
    
    /**
     * Diagnostic method to check active listeners
     * Usage: window.classifiedApp.managers.messaging.listeners.diagnosticListeners()
     */
    diagnosticListeners() {
        console.log('🔍 LISTENER DIAGNOSTIC REPORT');
        console.log('================================');
        console.log(`Total active listeners: ${this.activeListeners.size}`);
        
        const byType = {};
        const listenerDetails = [];
        
        this.activeListeners.forEach((listener, id) => {
            byType[listener.type] = (byType[listener.type] || 0) + 1;
            const age = ((Date.now() - listener.createdAt) / 1000).toFixed(1);
            listenerDetails.push({
                id,
                type: listener.type,
                age: `${age}s`,
                created: new Date(listener.createdAt).toISOString()
            });
        });
        
        console.log('\nActive Listeners:');
        console.table(listenerDetails);
        
        console.log('\nBreakdown by type:');
        Object.entries(byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
        // Check for potential leaks
        const potentialLeaks = [];
        this.activeListeners.forEach((listener, id) => {
            const age = (Date.now() - listener.createdAt) / 1000;
            if (age > 300) { // Older than 5 minutes
                potentialLeaks.push(id);
            }
        });
        
        if (potentialLeaks.length > 0) {
            console.warn('\n⚠️ Potential memory leaks (listeners >5 min old):');
            potentialLeaks.forEach(id => console.warn(`  - ${id}`));
        }
        
        console.log('================================');
        
        return {
            total: this.activeListeners.size,
            byType,
            potentialLeaks: potentialLeaks.length
        };
    }
    
    /**
     * Clean up ALL listeners and resources
     */
    cleanupAll() {
        console.log('🧹 [LISTENERS] Cleaning up ALL listeners and resources');
        console.log(`📊 [LISTENERS] Active listeners before cleanup: ${this.activeListeners.size}`);
        
        // Stop cleanup interval
        if (this.listenerCleanupInterval) {
            clearInterval(this.listenerCleanupInterval);
            this.listenerCleanupInterval = null;
            console.log('⏰ [LISTENERS] Cleanup interval stopped');
        }
        
        // Unsubscribe from all tracked listeners
        this.activeListeners.forEach((listener, id) => {
            try {
                listener.unsubscribe();
                console.log(`✓ [LISTENERS] Cleaned up: ${id} (${listener.type})`);
            } catch (error) {
                console.error(`❌ [LISTENERS] Error cleaning up ${id}:`, error);
            }
        });
        
        this.activeListeners.clear();
        
        console.log(`✅ [LISTENERS] Cleanup complete. Remaining listeners: ${this.activeListeners.size}`);
    }
}
