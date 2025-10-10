// javascript/features/matching.js

import {
    collection,
    doc,
    setDoc,
    getDoc,
    addDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Matching Manager - Simple Like/Pass System
 * Handles user likes, passes, and match detection
 */
export class MatchingManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // Track passed users (moved to bottom of feed)
        this.passedUsers = new Set();
    }
    
    /**
     * Initialize matching system
     */
    async init() {
        console.log('💕 Initializing matching manager...');
        this.loadPassedUsers();
    }
    
    /**
     * Load passed users from localStorage
     */
    loadPassedUsers() {
        try {
            const stored = localStorage.getItem('passedUsers');
            if (stored) {
                this.passedUsers = new Set(JSON.parse(stored));
                console.log('📦 Loaded', this.passedUsers.size, 'passed users');
            }
        } catch (error) {
            console.error('Error loading passed users:', error);
        }
    }
    
    /**
     * Save passed users to localStorage
     */
    savePassedUsers() {
        try {
            localStorage.setItem('passedUsers', JSON.stringify([...this.passedUsers]));
        } catch (error) {
            console.error('Error saving passed users:', error);
        }
    }
    
    /**
     * Handle Like action
     */
  async handleLike(targetUserId) {
    try {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            console.error('❌ No authenticated user');
            window.CLASSIFIED.showLogin();
            return;
        }
        
        const currentUserId = currentUser.uid;
        console.log(`👍 LIKE: ${currentUserId} → ${targetUserId}`);
        
        // Create like document
        const likeId = `${currentUserId}_${targetUserId}`;
        const likeData = {
            fromUserId: currentUserId,
            toUserId: targetUserId,
            timestamp: serverTimestamp()
        };
        
        // DEBUG: Comprehensive logging
        console.log('🔍 Like Document Debug:', {
            likeId,
            expectedPattern: `${currentUserId}_${targetUserId}`,
            patternMatches: likeId === `${currentUserId}_${targetUserId}`,
            data: {
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: 'serverTimestamp()'
            },
            authCheck: {
                authenticated: !!currentUser,
                uid: currentUser.uid,
                matchesFromUserId: currentUser.uid === currentUserId
            }
        });
        
        // Attempt to create like document
        console.log('📝 Writing to Firebase likes collection...');
        await setDoc(doc(this.db, 'likes', likeId), likeData);
        console.log('✅ Like saved to Firebase successfully');
        
        // Check for mutual like (match)
        console.log('🔍 Checking for mutual like...');
        const reverseLikeId = `${targetUserId}_${currentUserId}`;
        const reverseLikeDoc = await getDoc(doc(this.db, 'likes', reverseLikeId));
        console.log('📊 Mutual like check:', {
            reverseLikeId,
            exists: reverseLikeDoc.exists()
        });
            
            if (reverseLikeDoc.exists()) {
                // IT'S A MATCH! 🎉
                console.log('🎉 MATCH DETECTED!');
                await this.createMatch(currentUserId, targetUserId);
                
                // Get target user data
                const targetUserDoc = await getDoc(doc(this.db, 'users', targetUserId));
                const targetUserData = targetUserDoc.data();
                
                // Show match popup
                if (window.CLASSIFIED.showMatchPopup) {
                    window.CLASSIFIED.showMatchPopup({
                        uid: targetUserId,
                        name: targetUserData?.name || 'User',
                        image: targetUserData?.photos?.[0] || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop'
                    });
                }
            } else {
                // Send like notification
                await this.sendLikeNotification(targetUserId, currentUser);
                
                // Show success feedback
                if (window.CLASSIFIED.showLikeConfirmation) {
                    window.CLASSIFIED.showLikeConfirmation();
                } else {
                    alert('Like sent! 💕');
                }
            }
            
            // Remove from feed
            this.removeUserFromFeed(targetUserId);
            
            } catch (error) {
            console.error('❌ Error handling like:', error);
            console.error('🔍 Full error details:', {
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
            console.error('❌ No authenticated user');
            window.CLASSIFIED.showLogin();
            return;
        }
        
        const currentUserId = currentUser.uid;
        console.log(`👎 PASS: ${currentUserId} → ${targetUserId}`);
        
        // Create pass document
        const passId = `${currentUserId}_${targetUserId}`;
        const passData = {
            fromUserId: currentUserId,
            toUserId: targetUserId,
            timestamp: serverTimestamp()
        };
        
        // DEBUG: Comprehensive logging
        console.log('🔍 Pass Document Debug:', {
            passId,
            expectedPattern: `${currentUserId}_${targetUserId}`,
            patternMatches: passId === `${currentUserId}_${targetUserId}`,
            data: {
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: 'serverTimestamp()'
            },
            authCheck: {
                authenticated: !!currentUser,
                uid: currentUser.uid,
                matchesFromUserId: currentUser.uid === currentUserId
            }
        });
        
        // Attempt to create pass document
        console.log('📝 Writing to Firebase passes collection...');
        await setDoc(doc(this.db, 'passes', passId), passData);
        console.log('✅ Pass saved to Firebase successfully');
            
            // Track passed user
            this.passedUsers.add(targetUserId);
            this.savePassedUsers();
            
            // Move to bottom of feed
            this.moveUserToBottomOfFeed(targetUserId);
            
        } catch (error) {
            console.error('❌ Error handling pass:', error);
        }
    }
    
    /**
     * Create match between two users
     */
    async createMatch(userId1, userId2) {
        try {
            // Sort IDs alphabetically for consistent match ID
            const matchId = [userId1, userId2].sort().join('_');
            
            await setDoc(doc(this.db, 'matches', matchId), {
                users: [userId1, userId2],
                timestamp: serverTimestamp(),
                status: 'active'
            });
            
            console.log('✅ Match created:', matchId);
            
            // Send match notifications
            await this.sendMatchNotification(userId1, userId2);
            await this.sendMatchNotification(userId2, userId1);
            
        } catch (error) {
            console.error('❌ Error creating match:', error);
        }
    }
    
    /**
     * Send like notification
     */
    async sendLikeNotification(toUserId, fromUser) {
        try {
            await addDoc(collection(this.db, 'notifications'), {
                userId: toUserId,
                title: 'New Like! 💕',
                message: `${fromUser.displayName || 'Someone'} liked you`,
                type: 'like',
                fromUserId: fromUser.uid,
                timestamp: serverTimestamp(),
                read: false
            });
            
            console.log('📬 Like notification sent');
        } catch (error) {
            console.error('❌ Error sending notification:', error);
        }
    }
    
    /**
     * Send match notification
     */
    async sendMatchNotification(toUserId, matchedWithUserId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', matchedWithUserId));
            const userData = userDoc.data();
            
            await addDoc(collection(this.db, 'notifications'), {
                userId: toUserId,
                title: "It's a Match! 🎉",
                message: `You matched with ${userData?.name || 'someone'}`,
                type: 'match',
                fromUserId: matchedWithUserId,
                timestamp: serverTimestamp(),
                read: false
            });
            
            console.log('🎉 Match notification sent');
        } catch (error) {
            console.error('❌ Error sending match notification:', error);
        }
    }
    
    /**
     * Remove user from feed (immediate)
     */
    removeUserFromFeed(userId) {
        const feedItem = document.querySelector(`.user-feed-item[data-user-id="${userId}"]`);
        if (feedItem) {
            feedItem.style.transition = 'opacity 0.3s, transform 0.3s';
            feedItem.style.opacity = '0';
            feedItem.style.transform = 'scale(0.8)';
            
            setTimeout(() => feedItem.remove(), 300);
        }
    }
    
    /**
     * Move user to bottom of feed
     */
    moveUserToBottomOfFeed(userId) {
        const container = document.getElementById('userFeedContainer');
        const feedItem = document.querySelector(`.user-feed-item[data-user-id="${userId}"]`);
        
        if (container && feedItem) {
            feedItem.style.transition = 'opacity 0.3s, transform 0.3s';
            feedItem.style.opacity = '0';
            feedItem.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                container.appendChild(feedItem);
                setTimeout(() => {
                    feedItem.style.opacity = '1';
                    feedItem.style.transform = 'translateX(0)';
                }, 50);
            }, 300);
        }
    }
    
    /**
     * Cleanup
     */
    cleanup() {
        this.savePassedUsers();
    }
}
