// javascript/features/matching.js

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Matching Manager - Simple Like/Pass System with Firebase Sync
 * Handles user likes, passes, and match detection
 * All notifications delegated to NotificationManager
 * 
 * FIXED ISSUES:
 * - Added Firebase sync to prevent localStorage staleness
 * - Added demo user filtering (user_xxx IDs never persist)
 * - Added self-like/pass prevention
 * - localStorage now syncs with Firebase on init
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
     * Initialize matching system with Firebase sync
     */
    async init() {
        console.log('💕 [MATCHING] Initializing matching manager...');
        console.log('💕 [MATCHING] [STEP-1] Init at:', Date.now());
        
        // Load from localStorage first (instant feedback)
        this.loadPassedUsers();
        this.loadLikedUsers();
        
        // Log initial state from localStorage
        console.log('📦 [MATCHING] Loaded from localStorage:', {
            likes: this.likedUsers.size,
            passes: this.passedUsers.size
        });
        
        // Sync with Firebase (source of truth)
        await this.syncWithFirebase();
        
        // Log final state after sync
        console.log('✅ [MATCHING] Initialized with', this.likedUsers.size, 'likes and', this.passedUsers.size, 'passes');
    }
    
    /**
     * Sync localStorage with Firebase (source of truth)
     * This prevents stale data when Firebase is manually cleared
     */
    async syncWithFirebase() {
        try {
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                console.log('⚠️ [MATCHING] No authenticated user, skipping Firebase sync');
                return;
            }
            
            console.log('🔄 [MATCHING] Syncing with Firebase...');
            const currentUserId = currentUser.uid;
            
            // Fetch likes from Firebase
            const likesQuery = query(
                collection(this.db, 'likes'),
                where('fromUserId', '==', currentUserId)
            );
            const likesSnapshot = await getDocs(likesQuery);
            const firebaseLikes = new Set();
            likesSnapshot.forEach(doc => {
                const data = doc.data();
                firebaseLikes.add(data.toUserId);
            });
            
            // Fetch passes from Firebase
            const passesQuery = query(
                collection(this.db, 'passes'),
                where('fromUserId', '==', currentUserId)
            );
            const passesSnapshot = await getDocs(passesQuery);
            const firebasePasses = new Set();
            passesSnapshot.forEach(doc => {
                const data = doc.data();
                firebasePasses.add(data.toUserId);
            });
            
            console.log('📊 [MATCHING] Firebase data:', {
                likes: firebaseLikes.size,
                passes: firebasePasses.size
            });
            
            // Clean localStorage: Remove any entries NOT in Firebase
            const localLikes = [...this.likedUsers];
            const localPasses = [...this.passedUsers];
            
            let likesRemoved = 0;
            let passesRemoved = 0;
            
            localLikes.forEach(userId => {
                if (!firebaseLikes.has(userId)) {
                    this.likedUsers.delete(userId);
                    likesRemoved++;
                    console.log('🧹 [MATCHING] Removed stale like:', userId);
                }
            });
            
            localPasses.forEach(userId => {
                if (!firebasePasses.has(userId)) {
                    this.passedUsers.delete(userId);
                    passesRemoved++;
                    console.log('🧹 [MATCHING] Removed stale pass:', userId);
                }
            });
            
            // Update localStorage to match Firebase
            this.saveLikedUsers();
            this.savePassedUsers();
            
            console.log('✅ [MATCHING] Sync complete:', {
                likesRemoved,
                passesRemoved,
                finalLikes: this.likedUsers.size,
                finalPasses: this.passedUsers.size
            });
            
        } catch (error) {
            console.error('❌ [MATCHING] Error syncing with Firebase:', error);
            // Don't throw - app can continue with localStorage data
        }
    }
    
    /**
     * Load passed users from localStorage
     */
    loadPassedUsers() {
        try {
            const stored = localStorage.getItem('passedUsers');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Filter out demo users that shouldn't be in localStorage
                const cleanedPasses = parsed.filter(id => !id.startsWith('user_'));
                this.passedUsers = new Set(cleanedPasses);
                
                if (cleanedPasses.length < parsed.length) {
                    console.log('🧹 [MATCHING] Cleaned', parsed.length - cleanedPasses.length, 'demo users from passes');
                    this.savePassedUsers(); // Update localStorage
                }
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
            // Filter out demo users before saving
            const realUsers = [...this.passedUsers].filter(id => !id.startsWith('user_'));
            localStorage.setItem('passedUsers', JSON.stringify(realUsers));
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
                const parsed = JSON.parse(stored);
                // Filter out demo users that shouldn't be in localStorage
                const cleanedLikes = parsed.filter(id => !id.startsWith('user_'));
                this.likedUsers = new Set(cleanedLikes);
                
                if (cleanedLikes.length < parsed.length) {
                    console.log('🧹 [MATCHING] Cleaned', parsed.length - cleanedLikes.length, 'demo users from likes');
                    this.saveLikedUsers(); // Update localStorage
                }
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
            // Filter out demo users before saving
            const realUsers = [...this.likedUsers].filter(id => !id.startsWith('user_'));
            localStorage.setItem('likedUsers', JSON.stringify(realUsers));
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
            
            // SECURITY: Prevent self-like
            if (targetUserId === currentUserId) {
                console.error('❌ [MATCHING] Cannot like yourself!');
                return;
            }
            
            // SECURITY: Prevent demo user persistence
            if (targetUserId.startsWith('user_')) {
                console.log('👻 [MATCHING] Demo user detected - showing UI feedback only');
                this.removeUserFromFeed(targetUserId);
                
                // Show feedback but don't persist
                if (window.CLASSIFIED?.showLikeConfirmation) {
                    window.CLASSIFIED.showLikeConfirmation();
                }
                return;
            }
            
            console.log(`👍 [MATCHING] LIKE: ${currentUserId} → ${targetUserId}`);
            console.log('💕 [MATCHING] [STEP-2] Like initiated at:', Date.now());
            
            // Create like document
            const likeId = `${currentUserId}_${targetUserId}`;
            const likeData = {
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: serverTimestamp()
            };
            
            // DEBUG: Comprehensive logging
            console.log('🔍 [MATCHING] Like Document Debug:', {
                likeId,
                expectedPattern: `${currentUserId}_${targetUserId}`,
                patternMatches: likeId === `${currentUserId}_${targetUserId}`,
                data: likeData,
                authCheck: {
                    authenticated: !!currentUser,
                    uid: currentUser.uid,
                    matchesFromUserId: currentUser.uid === currentUserId
                }
            });
            
            // Save like to Firebase
            console.log('📝 [MATCHING] Writing to Firebase likes collection...');
            await setDoc(doc(this.db, 'likes', likeId), likeData);
            console.log('✅ [MATCHING] Like saved to Firebase successfully');
            
            // Track liked user locally
            this.likedUsers.add(targetUserId);
            this.saveLikedUsers();
            console.log('💾 [MATCHING] Saved liked user to localStorage');
            
            // Check for mutual like (match)
            console.log('🔍 [MATCHING] Checking for mutual like...');
            const reverseLikeId = `${targetUserId}_${currentUserId}`;
            const reverseLikeDoc = await getDoc(doc(this.db, 'likes', reverseLikeId));
            
            console.log('📊 [MATCHING] Mutual like check:', {
                reverseLikeId,
                exists: reverseLikeDoc.exists()
            });
            
            if (reverseLikeDoc.exists()) {
                // IT'S A MATCH! 🎉
                console.log('🎉 [MATCHING] MATCH DETECTED!');
                console.log('💕 [MATCHING] [STEP-3] Match detected at:', Date.now());
                
                // Create match and chat
                const matchId = await this.createMatch(currentUserId, targetUserId);
                
                // Get target user data for notification
                const targetUserDoc = await getDoc(doc(this.db, 'users', targetUserId));
                const targetUserData = targetUserDoc.data();
                
                // Delegate all notifications to NotificationManager
                const notificationManager = window.classifiedApp?.managers?.notifications;
                if (notificationManager) {
                    console.log('💕 [MATCHING] [STEP-4] Sending match notifications at:', Date.now());
                    
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
                } else {
                    // Simple feedback if no UI method available
                    console.log('💕 [MATCHING] Like sent successfully!');
                }
            }
            
            // Remove user from feed after like
            this.removeUserFromFeed(targetUserId);
            
        } catch (error) {
            console.error('❌ [MATCHING] Error handling like:', error);
            console.error('🔍 [MATCHING] Full error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
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
            
            // SECURITY: Prevent self-pass
            if (targetUserId === currentUserId) {
                console.error('❌ [MATCHING] Cannot pass yourself!');
                return;
            }
            
            // SECURITY: Prevent demo user persistence
            if (targetUserId.startsWith('user_')) {
                console.log('👻 [MATCHING] Demo user detected - showing UI feedback only');
                this.moveUserToBottomOfFeed(targetUserId);
                return;
            }
            
            console.log(`👎 [MATCHING] PASS: ${currentUserId} → ${targetUserId}`);
            
            // Create pass document
            const passId = `${currentUserId}_${targetUserId}`;
            const passData = {
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: serverTimestamp()
            };
            
            // DEBUG: Comprehensive logging
            console.log('🔍 [MATCHING] Pass Document Debug:', {
                passId,
                expectedPattern: `${currentUserId}_${targetUserId}`,
                data: passData,
                authCheck: {
                    authenticated: !!currentUser,
                    uid: currentUser.uid
                }
            });
            
            // Save pass to Firebase
            console.log('📝 [MATCHING] Writing to Firebase passes collection...');
            await setDoc(doc(this.db, 'passes', passId), passData);
            console.log('✅ [MATCHING] Pass saved to Firebase successfully');
            
            // Track passed user locally
            this.passedUsers.add(targetUserId);
            this.savePassedUsers();
            
            // Move user to bottom of feed instead of removing
            this.moveUserToBottomOfFeed(targetUserId);
            
            console.log('👎 [MATCHING] Pass completed successfully');
            
        } catch (error) {
            console.error('❌ [MATCHING] Error handling pass:', error);
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
        
        console.log('✅ [MATCHING] MatchingManager cleanup complete');
    }
}
