// javascript/features/admin.js

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Admin Manager
 * Handles admin functionality for business approvals
 */
export class AdminManager {
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
     * Initialize admin manager
     */
    async init() {
        console.log('🛡️ Initializing admin manager...');
    }
    
    /**
     * Check if current user is admin
     */
    isAdmin() {
        const user = this.state.get('currentUser');
        if (!user) return false;
        
        // Add your admin emails here
        const adminEmails = [
            'admin@classified.com',
            'your-admin-email@gmail.com' // Replace with your actual email
        ];
        
        return adminEmails.includes(user.email);
    }
    
    /**
     * Get pending businesses
     */
    async getPendingBusinesses() {
        if (!this.isAdmin()) {
            throw new Error('Not authorized');
        }
        
        try {
            const q = query(
                collection(this.db, 'businesses'),
                where('status', '==', 'pending_approval')
            );
            
            const snapshot = await getDocs(q);
            const businesses = [];
            
            snapshot.forEach(doc => {
                businesses.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return businesses;
        } catch (error) {
            console.error('Error fetching pending businesses:', error);
            return [];
        }
    }
    
    /**
     * Approve a business
     */
    async approveBusiness(businessId) {
        if (!this.isAdmin()) {
            throw new Error('Not authorized');
        }
        
        try {
            await updateDoc(doc(this.db, 'businesses', businessId), {
                status: 'active',
                approvedAt: serverTimestamp(),
                approvedBy: this.state.get('currentUser').uid
            });
            
            console.log('✅ Business approved:', businessId);
            return true;
        } catch (error) {
            console.error('Error approving business:', error);
            throw error;
        }
    }
    
    /**
     * Reject a business
     */
    async rejectBusiness(businessId, reason = '') {
        if (!this.isAdmin()) {
            throw new Error('Not authorized');
        }
        
        try {
            await updateDoc(doc(this.db, 'businesses', businessId), {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectedBy: this.state.get('currentUser').uid,
                rejectionReason: reason
            });
            
            console.log('❌ Business rejected:', businessId);
            return true;
        } catch (error) {
            console.error('Error rejecting business:', error);
            throw error;
        }
    }
}
