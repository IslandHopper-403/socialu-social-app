// javascript/features/matching.js

import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Matching Manager - Simple Like/Pass System
 * Handles user likes, passes, and match detection
 * All notifications delegated to NotificationManager
 */
export class MatchingManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // Track passed users (moved to bottom of feed)
        this.passedUsers = new Set();
        
        // Track liked users to filter from feed
        this.likedUsers = new Set();
    }
    
    /**
     * Initialize matching system
     */
    async init() {
        console.log('💕 [MATCHING] Initializing matching manager...');
        
        this.loadPassedUsers();
        this.loadLikedUsers();
        
        console.log('✅ [MATCHING] Initialized with', this.likedUsers.size, 'likes and', this.passedUsers.size, 'passes');
    }
    
    /**
     * Load passed users from localStorage
     */
    loadPassedUsers() {
        try {
            const stored = localStorage.getItem('passedUsers');
            if (stored) {
                this.passedUsers = new Set(JSON.parse(stored));
            }
        } catch (error) {
            console.error('❌ [MATCHING] Error loading passed users:', error);
        }
    }
    
    /**
     * Save passed users to localStorage
     */
    savePassedUsers() {
        try {
            localStorage.setItem('passedUsers', JSON.stringify([...this.passedUsers]));
        } catch (error) {
            console.error('❌ [MATCHING] Error saving passed users:', error);
        }
    }
    
    /**
     * Load liked users from localStorage
     */
    loadLikedUsers() {
        try {
            const stored = localStorage.getItem('likedUsers');
            if (stored) {
                this.likedUsers = new Set(JSON.parse(stored));
            }
        } catch (error) {
            console.error('❌ [MATCHING] Error loading liked users:', error);
        }
    }
    
    /**
     * Save liked users to localStorage
     */
    saveLikedUsers() {
        try {
            localStorage.setItem('likedUsers', JSON.stringify([...this.likedUsers]));
        } catch (error) {
            console.error('❌ [MATCHING] Error saving liked users:', error);
        }
    }
    
    /**
     * Handle Like action
     */
    async handleLike(targetUserId) {
        try {
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                console.error('❌ [MATCHING] No authenticated user');
                window.CLASSIFIED.showLogin();
                return;
            }
            
            const currentUserId = currentUser.uid;
            console.log(`👍 [MATCHING] LIKE: ${currentUserId} → ${targetUserId}`);
            
            // Create like document
            const likeId = `${currentUserId}_${targetUserId}`;
            const likeData = {
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: serverTimestamp()
            };
            
            // Save like to Firebase
            console.log('📝 [MATCHING] Writing like to Firebase...');
            await setDoc(doc(this.db, 'likes', likeId), likeData);
            console.log('✅ [MATCHING] Like saved successfully');
            
            // Track liked user locally
            this.likedUsers.add(targetUserId);
            this.saveLikedUsers();
            
            // Check for mutual like (match)
            console.log('🔍 [MATCHING] Checking for mutual like...');
            const reverseLikeId = `${targetUserId}_${currentUserId}`;
            const reverseLikeDoc = await getDoc(doc(this.db, 'likes', reverseLikeId));
            
            if (reverseLikeDoc.exists()) {
                // IT'S A MATCH! 🎉
                console.log('🎉 [MATCHING] MATCH DETECTED!');
                
                // Create match and chat
                const matchId = await this.createMatch(currentUserId, targetUserId);
                
                // Get target user data for notification
                const targetUserDoc = await getDoc(doc(this.db, 'users', targetUserId));
                const targetUserData = targetUserDoc.data();
                
                // Delegate all notifications to NotificationManager
                const notificationManager = window.classifiedApp?.managers?.notifications;
                if (notificationManager) {
                    console.log('📬 [MATCHING] Sending match notifications...');
                    
                    // Send match notifications to both users via Firebase
                    await notificationManager.sendMatchNotification(currentUserId, targetUserId);
                    await notificationManager.sendMatchNotification(targetUserId, currentUserId);
                    
                    // Show match popup for current user
                    notificationManager.showNotification('match', {
                        matchId,
                        partnerId: targetUserId,
                        partnerName: targetUserData?.name || 'User',
                        partnerPhoto: targetUserData?.photos?.[0] || 'https://via.placeholder.com/100'
                    });
                    
                    console.log('✅ [MATCHING] Match notifications sent');
                } else {
                    console.warn('⚠️ [MATCHING] NotificationManager not available');
                }
            } else {
                // Not a match yet, just a like
                console.log('💕 [MATCHING] Like sent, waiting for match...');
                
                // Send like notification via NotificationManager
                const notificationManager = window.classifiedApp?.managers?.notifications;
                if (notificationManager) {
                    const currentUserData = {
                        uid: currentUser.uid,
                        displayName: currentUser.displayName || 'Someone'
                    };
                    await notificationManager.sendLikeNotification(targetUserId, currentUserData);
                    console.log('📬 [MATCHING] Like notification sent');
                }
                
                // Show success feedback
                if (window.CLASSIFIED?.showLikeConfirmation) {
                    window.CLASSIFIED.showLikeConfirmation();
                }
            }
            
            // Remove user from feed after like
            this.removeUserFromFeed(targetUserId);
            
        } catch (error) {
            console.error('❌ [MATCHING] Error handling like:', error);
            console.error('🔍 [MATCHING] Error details:', {
                code: error.code,
                message: error.message,
                userId: targetUserId
            });
            alert('Failed to send like. Please try again.');
        }
    }
    
    /**
     * Handle Pass action
     */
    async handlePass(targetUserId) {
        try {
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                console.error('❌ [MATCHING] No authenticated user');
                window.CLASSIFIED.showLogin();
                return;
            }
            
            const currentUserId = currentUser.uid;
            console.log(`👎 [MATCHING] PASS: ${currentUserId} → ${targetUserId}`);
            
            // Create pass document
            const passId = `${currentUserId}_${targetUserId}`;
            const passData = {
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: serverTimestamp()
            };
            
            // Save pass to Firebase
            console.log('📝 [MATCHING] Writing pass to Firebase...');
            await setDoc(doc(this.db, 'passes', passId), passData);
            console.log('✅ [MATCHING] Pass saved successfully');
            
            // Track passed user locally
            this.passedUsers.add(targetUserId);
            this.savePassedUsers();
            
            // Move user to bottom of feed instead of removing
            this.moveUserToBottomOfFeed(targetUserId);
            
        } catch (error) {
            console.error('❌ [MATCHING] Error handling pass:', error);
            console.error('🔍 [MATCHING] Error details:', {
                code: error.code,
                message: error.message,
                userId: targetUserId
            });
            alert('Failed to pass. Please try again.');
        }
    }
    
    /**
     * Create match between two users (including chat setup)
     */
    async createMatch(userId1, userId2) {
        try {
            // SECURITY: Validate user IDs
            if (!userId1 || !userId2 || userId1 === userId2) {
                throw new Error('Invalid user IDs for match creation');
            }
            
            console.log('🎉 [MATCHING] Creating match between', userId1, 'and', userId2);
            
            // Sort IDs alphabetically for consistent match ID
            const matchId = [userId1, userId2].sort().join('_');
            
            // Create match document with all required fields
            const matchData = {
                users: [userId1, userId2].sort(),
                timestamp: serverTimestamp(),
                createdTimestamp: Date.now(), // For immediate validation
                status: 'active',
                createdBy: 'system',
                chatCreated: false
            };
            
            console.log('📝 [MATCHING] Creating match document:', matchId);
            await setDoc(doc(this.db, 'matches', matchId), matchData);
            
            // Create corresponding chat document for the match
            const chatId = matchId; // Use same ID for consistency
            const chatData = {
                participants: [userId1, userId2].sort(),
                createdAt: serverTimestamp(),
                lastMessage: '',
                lastMessageTime: serverTimestamp(),
                lastMessageSender: null,
                matchId: matchId,
                type: 'match_chat'
            };
            
            console.log('💬 [MATCHING] Creating chat document:', chatId);
            await setDoc(doc(this.db, 'chats', chatId), chatData);
            
            // Update match to indicate chat was created
            await updateDoc(doc(this.db, 'matches', matchId), {
                chatCreated: true,
                chatId: chatId
            });
            
            console.log('✅ [MATCHING] Match and chat created successfully:', matchId);
            return matchId;
            
        } catch (error) {
            console.error('❌ [MATCHING] Error creating match:', error);
            throw error;
        }
    }
    
    /**
     * Check if users have already matched
     */
    async checkExistingMatch(userId1, userId2) {
        try {
            const matchId = [userId1, userId2].sort().join('_');
            const matchDoc = await getDoc(doc(this.db, 'matches', matchId));
            return matchDoc.exists();
        } catch (error) {
            console.error('❌ [MATCHING] Error checking existing match:', error);
            return false;
        }
    }
    
    /**
     * Remove user from feed (immediate removal with animation)
     */
    removeUserFromFeed(userId) {
        const feedItem = document.querySelector(`.user-feed-item[data-user-id="${userId}"]`);
        if (feedItem) {
            feedItem.style.transition = 'opacity 0.3s, transform 0.3s';
            feedItem.style.opacity = '0';
            feedItem.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                feedItem.remove();
                console.log(`🗑️ [MATCHING] Removed user ${userId} from feed`);
            }, 300);
        }
    }
    
    /**
     * Move user to bottom of feed (for passes)
     */
    moveUserToBottomOfFeed(userId) {
        const container = document.getElementById('userFeedContainer');
        const feedItem = document.querySelector(`.user-feed-item[data-user-id="${userId}"]`);
        
        if (container && feedItem) {
            // Animate out
            feedItem.style.transition = 'opacity 0.3s, transform 0.3s';
            feedItem.style.opacity = '0';
            feedItem.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                // Move to bottom
                container.appendChild(feedItem);
                
                // Animate back in
                setTimeout(() => {
                    feedItem.style.opacity = '1';
                    feedItem.style.transform = 'translateX(0)';
                    console.log(`📍 [MATCHING] Moved user ${userId} to bottom of feed`);
                }, 50);
            }, 300);
        }
    }
    
    /**
     * Get user's likes (for profile or analytics)
     */
    async getUserLikes(userId) {
        try {
            const likes = [];
            // This would query Firebase for all likes from this user
            // Implementation depends on your Firebase structure
            return likes;
        } catch (error) {
            console.error('❌ [MATCHING] Error getting user likes:', error);
            return [];
        }
    }
    
    /**
     * Get user's matches (for messaging list)
     */
    async getUserMatches(userId) {
        try {
            const matches = [];
            // This would query Firebase for all matches involving this user
            // Implementation depends on your Firebase structure
            return matches;
        } catch (error) {
            console.error('❌ [MATCHING] Error getting user matches:', error);
            return [];
        }
    }
    
    /**
     * Check if user has been liked or passed
     */
    hasUserBeenActioned(userId) {
        return this.likedUsers.has(userId) || this.passedUsers.has(userId);
    }
    
    /**
     * Reset all local data (for testing or user logout)
     */
    resetLocalData() {
        this.likedUsers.clear();
        this.passedUsers.clear();
        this.saveLikedUsers();
        this.savePassedUsers();
        console.log('🔄 [MATCHING] Reset all matching data');
    }
    
    /**
     * Cleanup on destroy
     */
    cleanup() {
        console.log('🧹 [MATCHING] Cleaning up MatchingManager...');
        
        // Save current state
        this.savePassedUsers();
        this.saveLikedUsers();
        
        console.log('✅ [MATCHING] Cleanup complete');
    }
}
