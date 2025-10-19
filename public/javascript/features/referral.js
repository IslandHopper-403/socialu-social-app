// javascript/features/referral.js

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Referral Manager
 * Handles referral tracking and rewards
 */
export class ReferralManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set later)
        this.navigationManager = null;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
    }
    
    /**
     * Initialize referral manager
     */
    async init() {
        console.log('🎁 Initializing referral manager...');
    }
    
    /**
     * Show referral welcome message
     */
    showReferralWelcome(referralCode) {
        console.log(`🎁 Welcome! You were referred with code: ${referralCode}`);
        
        // You could show a special welcome message here
        const welcomeMessage = document.createElement('div');
        welcomeMessage.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: linear-gradient(135deg, #FFD700, #FF6B6B); 
                        padding: 20px; border-radius: 10px; z-index: 1000; 
                        text-align: center; color: white; animation: slideDown 0.5s ease;">
                <h3 style="margin: 0 0 10px 0;">🎉 Welcome to CLASSIFIED!</h3>
                <p style="margin: 0;">You were referred by a friend! Sign up to get 7 days of premium features!</p>
            </div>
        `;
        
        document.body.appendChild(welcomeMessage);
        
        // Remove after 5 seconds
        setTimeout(() => {
            welcomeMessage.remove();
        }, 5000);
    }
    
    /**
     * Track referral
     */
    async trackReferral(referralCode, newUserId) {
        try {
            // Find the referrer by their code
            const referrerQuery = await this.findUserByReferralCode(referralCode);
            if (!referrerQuery) {
                console.log('❌ Invalid referral code');
                return;
            }
            
            // Create referral record
            await setDoc(doc(this.db, 'referrals', newUserId), {
                referredBy: referrerQuery.uid,
                referralCode: referralCode,
                createdAt: serverTimestamp(),
                rewardsClaimed: false
            });
            
            // Update referrer's stats
            await updateDoc(doc(this.db, 'users', referrerQuery.uid), {
                referralCount: increment(1),
                lastReferralAt: serverTimestamp()
            });
            
            console.log('✅ Referral tracked successfully');
            
        } catch (error) {
            console.error('Error tracking referral:', error);
        }
    }
    
    /**
     * Find user by referral code
     */
    async findUserByReferralCode(referralCode) {
        // This is a simplified version - in production you'd query by referralCode
        // For now, return null as we don't have an index on referralCode
        return null;
    }
    
    /**
     * Show referral code to user
     */
    showReferralCode() {
        const userProfile = this.state.get('userProfile');
        if (!userProfile || !userProfile.referralCode) {
            alert('Please complete your profile first!');
            return;
        }
        
        const referralUrl = `${window.location.origin}?ref=${userProfile.referralCode}`;
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                        background: rgba(0,0,0,0.8); z-index: 1000; 
                        display: flex; align-items: center; justify-content: center;">
                <div style="background: #2a2a2a; padding: 30px; border-radius: 15px; 
                            max-width: 400px; text-align: center;">
                    <h2 style="color: #FFD700; margin: 0 0 20px 0;">🎁 Your Referral Code</h2>
                    <div style="background: rgba(255,215,0,0.1); padding: 20px; 
                                border-radius: 10px; margin-bottom: 20px;">
                        <div style="font-size: 32px; font-weight: bold; color: #FFD700;">
                            ${userProfile.referralCode}
                        </div>
                    </div>
                    <p style="color: white; margin-bottom: 20px;">
                        Share this code with friends! Both of you get 7 days of premium features!
                    </p>
                    <button onclick="navigator.clipboard.writeText('${referralUrl}').then(() => alert('Referral link copied!')); this.parentElement.parentElement.remove();" 
                            style="background: linear-gradient(135deg, #00D4FF, #0099CC); 
                                   border: none; padding: 12px 24px; border-radius: 25px; 
                                   color: white; font-weight: 600; cursor: pointer; margin-right: 10px;">
                        Copy Link
                    </button>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="background: rgba(255,255,255,0.1); 
                                   border: 1px solid rgba(255,255,255,0.2); 
                                   padding: 12px 24px; border-radius: 25px; 
                                   color: white; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    /**
     * Check and apply referral rewards
     */
    async checkReferralRewards(userId) {
        try {
            const referralDoc = await getDoc(doc(this.db, 'referrals', userId));
            if (referralDoc.exists() && !referralDoc.data().rewardsClaimed) {
                // Apply rewards
                await updateDoc(doc(this.db, 'users', userId), {
                    isPremium: true,
                    premiumUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    premiumSource: 'referral'
                });
                
                // Mark rewards as claimed
                await updateDoc(doc(this.db, 'referrals', userId), {
                    rewardsClaimed: true,
                    rewardsClaimedAt: serverTimestamp()
                });
                
                console.log('🎁 Referral rewards applied!');
            }
        } catch (error) {
            console.error('Error checking referral rewards:', error);
        }
    }
}
