// javascript/features/business/businessPromotions.js

/**
 * Business Promotions Manager
 * Handles promotions CRUD operations, real-time updates, and display
 * 
 * RESPONSIBILITIES:
 * - Promotions overlay open/close
 * - Create, edit, delete, toggle promotions
 * - Real-time listener for promotions updates
 * - Client-side expiration filtering
 * - Soft limit enforcement (20 active promotions)
 * - UI rendering and updates
 * 
 * SECURITY:
 * - All user content displayed via textContent (never innerHTML)
 * - Business authentication required for all write operations
 * - Firestore rules enforce ownership
 * - Client-side validation before database writes
 */

import { sanitizeText } from '../../utils/security.js';

import {
    collection,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

export class BusinessPromotionsManager {
   constructor(firebaseServices, appState) {
        console.log('📢 [PROMOTIONS] Constructing BusinessPromotionsManager at:', Date.now());
        
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set via setManagers)
        this.navigationManager = null;
        this.businessManager = null; // Parent reference
        
        // Soft limit for active promotions per business
        this.MAX_ACTIVE_PROMOTIONS = 20;
        
        // Real-time listener for promotions
        this.promotionsListener = null;
        
        // Current promotion being edited (null if creating new)
        this.editingPromoId = null;
        
        // Set up event listeners using delegation pattern
        this.setupEventListeners();
        
        console.log('✅ [PROMOTIONS] BusinessPromotionsManager constructed at:', Date.now());
    }
    
    /**
     * Set up event listeners using delegation pattern
     * SECURITY: Single listener for all dynamic buttons
     */
    setupEventListeners() {
        console.log('🔗 [PROMOTIONS] Setting up event delegation at:', Date.now());
        
        // Delegate promotion type selector buttons
        document.addEventListener('click', (e) => {
            // Handle promo type selection
            if (e.target.matches('.promo-type-selector .type-btn')) {
                console.log('🎯 [PROMOTIONS] Type button clicked:', e.target.dataset.type);
                this.handleTypeSelection(e.target);
            }
        });
        
        console.log('✅ [PROMOTIONS] Event delegation active at:', Date.now());
    }
    
    /**
     * Handle promotion type selection
     * @param {HTMLElement} selectedButton - The clicked type button
     */
    handleTypeSelection(selectedButton) {
        console.log('🎯 [PROMOTIONS] Selecting type:', selectedButton.dataset.type, 'at:', Date.now());
        
        // Remove active from all type buttons
        const typeButtons = document.querySelectorAll('.promo-type-selector .type-btn');
        typeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        selectedButton.classList.add('active');
        
        console.log('✅ [PROMOTIONS] Type selected:', selectedButton.dataset.type);
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        console.log('🔗 [PROMOTIONS] Setting manager references');
        
        this.navigationManager = managers.navigation;
        this.businessManager = managers.business;
        
        console.log('✅ [PROMOTIONS] Manager references set');
    }
    
    // ========== OVERLAY MANAGEMENT ==========
    
    /**
     * Open Promotions Manager overlay
     */
  openPromotionsManager() {
        console.log('📢 [PROMOTIONS] Opening promotions manager');
        
        const overlay = document.getElementById('promotionsManager');
        if (overlay) {
            overlay.classList.add('show');
            
            // Track in navigation stack
            if (this.navigationManager) {
                this.navigationManager.showOverlay('promotionsManager');
            }
            
            // Show empty state by default (will be hidden if promotions exist)
            const emptyState = document.getElementById('promotionsEmptyState');
            const list = document.getElementById('promotionsList');
            if (emptyState) {
                emptyState.style.display = 'block';
                console.log('📭 [PROMOTIONS] Empty state shown by default');
            }
            if (list) {
                list.style.display = 'none';
            }
            
            // Load active promotions by default
            this.loadPromotions('active');
            
            // Set up real-time listener
            const user = this.state.get('currentUser');
            if (user) {
                this.setupPromotionsListener(user.uid);
            }
        }
        
        console.log('✅ [PROMOTIONS] Overlay opened');
    }
    
    /**
     * Close Promotions Manager overlay
     */
    closePromotionsManager() {
        console.log('🔙 [PROMOTIONS] Closing promotions manager');
        
        const overlay = document.getElementById('promotionsManager');
        if (overlay) {
            overlay.classList.remove('show');
        }
        
        // Cleanup listener
        this.cleanupPromotionsListener();
        
        // Reset editing state
        this.editingPromoId = null;
        
        console.log('✅ [PROMOTIONS] Overlay closed');
    }
    
    // ========== CRUD OPERATIONS ==========
    
    /**
     * Load promotions by status
     * CLIENT-SIDE FILTER: Hide expired promotions even if status = "active"
     */
    async loadPromotions(status) {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ [PROMOTIONS] Unauthorized');
            return;
        }
        
        console.log(`📥 [PROMOTIONS] Loading ${status} promotions`);
        
        try {
            // Query Firestore for promotions by status
            const promosQuery = query(
                collection(this.db, 'promotions'),
                where('businessId', '==', user.uid),
                where('status', '==', status),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(promosQuery);
            
            const list = document.getElementById('promotionsList');
            const emptyState = document.getElementById('promotionsEmptyState');
            
            if (!list) {
                console.error('❌ [PROMOTIONS] promotionsList element not found');
                return;
            }
            
            // Clear existing list
            list.innerHTML = '';
            
            if (snapshot.empty) {
                // Show empty state
                if (emptyState) emptyState.style.display = 'block';
                list.style.display = 'none';
                console.log('📭 [PROMOTIONS] No promotions found');
                return;
            }
            
            // Hide empty state
            if (emptyState) emptyState.style.display = 'none';
            list.style.display = 'block';
            
            // CLIENT-SIDE FILTER: Remove expired promotions
            const now = new Date();
            const validPromos = snapshot.docs.filter(doc => {
                const data = doc.data();
                const endDate = data.endDate?.toDate();
                
                // For "active" status, hide if endDate passed
                if (status === 'active' && endDate && endDate < now) {
                    console.log(`⏰ [PROMOTIONS] Filtering expired promo: ${data.title}`);
                    return false;
                }
                
                return true;
            });
            
            // Render each promotion
            validPromos.forEach(doc => {
                const promo = { id: doc.id, ...doc.data() };
                this.renderPromotionItem(promo, list);
            });
            
            console.log(`✅ [PROMOTIONS] Loaded ${validPromos.length} promotions`);
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error loading promotions:', error);
            
            // Show empty state when query fails (e.g., index still building)
            const list = document.getElementById('promotionsList');
            const emptyState = document.getElementById('promotionsEmptyState');
            
            if (list) list.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'block';
                console.log('📭 [PROMOTIONS] Showing empty state due to query error');
            }
            
            // Only show alert if it's not an index error
            if (!error.message?.includes('index')) {
                alert('Failed to load promotions. Please try again.');
            } else {
                console.log('ℹ️ [PROMOTIONS] Index is building - showing empty state');
            }
        }
    }
    
    /**
     * Create new promotion (show form)
     */
    async createPromotion() {
        console.log('➕ [PROMOTIONS] Creating new promotion');
        
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ [PROMOTIONS] Unauthorized');
            return;
        }
        
        // Check soft limit (20 active promotions)
        const activeCount = await this.countActivePromotions(user.uid);
        if (activeCount >= this.MAX_ACTIVE_PROMOTIONS) {
            alert(`Maximum ${this.MAX_ACTIVE_PROMOTIONS} active promotions reached.\n\nPause or archive existing promotions to create new ones.`);
            console.warn(`⚠️ [PROMOTIONS] Max active limit reached: ${activeCount}`);
            return;
        }
        
        // Show form, hide list
        const form = document.getElementById('promotionForm');
        const list = document.getElementById('promotionsList');
        const emptyState = document.getElementById('promotionsEmptyState');
        
        if (form) {
            form.style.display = 'block';
            
            // Clear form for new promotion
            this.editingPromoId = null;
            document.getElementById('promoTitle').value = '';
            document.getElementById('promoDescription').value = '';
            document.getElementById('promoStartDate').value = '';
            document.getElementById('promoEndDate').value = '';
            
           // Reset type selector to default
            const typeButtons = document.querySelectorAll('.promo-type-selector .type-btn');
            typeButtons.forEach(btn => btn.classList.remove('active'));
            typeButtons[0]?.classList.add('active'); // Default to first type
            
            // NOTE: Click handlers managed by event delegation in setupEventListeners()
            console.log('✅ [PROMOTIONS] Form initialized, type buttons ready for delegation');
        }
        
        if (list) list.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        
        console.log('✅ [PROMOTIONS] Form displayed for new promotion');
    }
    
    /**
     * Edit existing promotion (load data into form)
     */
    async editPromotion(promoId) {
        console.log('✏️ [PROMOTIONS] Editing promotion:', promoId);
        
        try {
            // Fetch promotion data
            const promoRef = doc(this.db, 'promotions', promoId);
            const promoSnap = await getDoc(promoRef);
            
            if (!promoSnap.exists()) {
                console.error('❌ [PROMOTIONS] Promotion not found:', promoId);
                alert('Promotion not found');
                return;
            }
            
            const promo = promoSnap.data();
            
            // Store editing ID
            this.editingPromoId = promoId;
            
            // Populate form
            document.getElementById('promoTitle').value = promo.title || '';
            document.getElementById('promoDescription').value = promo.description || '';
            
            // Format dates for input fields
            if (promo.startDate) {
                const startDate = promo.startDate.toDate();
                document.getElementById('promoStartDate').value = startDate.toISOString().split('T')[0];
            }
            
            if (promo.endDate) {
                const endDate = promo.endDate.toDate();
                document.getElementById('promoEndDate').value = endDate.toISOString().split('T')[0];
            }
            
            // Set type selector
            const typeButtons = document.querySelectorAll('.promo-type-selector .type-btn');
            typeButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.type === promo.type) {
                    btn.classList.add('active');
                }
            });
            
            // Show form, hide list
            const form = document.getElementById('promotionForm');
            const list = document.getElementById('promotionsList');
            
            if (form) form.style.display = 'block';
            if (list) list.style.display = 'none';
            
            console.log('✅ [PROMOTIONS] Form populated for editing');
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error loading promotion for edit:', error);
            alert('Failed to load promotion. Please try again.');
        }
    }
    
    /**
     * Save promotion (create or update)
     * SECURITY: Inputs already sanitized by main.js before calling this
     */
    async savePromotion(safeTitle, safeDescription) {
        const user = this.state.get('currentUser');
        if (!user || !this.state.get('isBusinessUser')) {
            console.error('❌ [PROMOTIONS] Unauthorized');
            return;
        }
        
        console.log('💾 [PROMOTIONS] Saving promotion');
        
        // Additional validation
        if (!safeTitle || safeTitle.length < 1 || safeTitle.length > 50) {
            alert('Title is required (1-50 characters)');
            return;
        }
        
        if (!safeDescription || safeDescription.length < 1 || safeDescription.length > 200) {
            alert('Description is required (1-200 characters)');
            return;
        }
        
        // Get form values
        const startDate = document.getElementById('promoStartDate')?.value;
        const endDate = document.getElementById('promoEndDate')?.value;
        
        if (!startDate || !endDate) {
            alert('Start and end dates are required');
            return;
        }
        
        const startTimestamp = Timestamp.fromDate(new Date(startDate));
        const endTimestamp = Timestamp.fromDate(new Date(endDate));
        
        if (endTimestamp.toMillis() <= startTimestamp.toMillis()) {
            alert('End date must be after start date');
            return;
        }
        
        // Get selected type
        const activeTypeBtn = document.querySelector('.promo-type-selector .type-btn.active');
        const type = activeTypeBtn?.dataset.type || 'special';
        
        try {
            const businessData = this.state.get('businessProfile') || this.state.get('currentUser');
            const businessName = businessData?.name || businessData?.businessName || 'Business';
            
            const promoData = {
                businessId: user.uid,
                businessName: businessName,
                title: safeTitle,
                description: safeDescription,
                type: type,
                status: 'active',
                startDate: startTimestamp,
                endDate: endTimestamp,
                updatedAt: serverTimestamp()
            };
            
            if (this.editingPromoId) {
                // UPDATE existing promotion
                const promoRef = doc(this.db, 'promotions', this.editingPromoId);
                await updateDoc(promoRef, promoData);
                console.log('✅ [PROMOTIONS] Promotion updated:', this.editingPromoId);
            } else {
                // CREATE new promotion
                promoData.createdAt = serverTimestamp();
                await addDoc(collection(this.db, 'promotions'), promoData);
                console.log('✅ [PROMOTIONS] Promotion created');
            }
            
            // Close form and reload list
            this.cancelPromotion();
            this.loadPromotions('active');
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error saving promotion:', error);
            alert('Failed to save promotion. Please try again.');
        }
    }
    
    /**
     * Delete promotion
     */
    async deletePromotion(promoId) {
        console.log('🗑️ [PROMOTIONS] Deleting promotion:', promoId);
        
        // Confirmation dialog
        if (!confirm('Are you sure you want to delete this promotion? This cannot be undone.')) {
            console.log('❌ [PROMOTIONS] Deletion cancelled by user');
            return;
        }
        
        try {
            await deleteDoc(doc(this.db, 'promotions', promoId));
            console.log('✅ [PROMOTIONS] Promotion deleted:', promoId);
            
            // Reload promotions list
            this.loadPromotions('active');
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error deleting promotion:', error);
            alert('Failed to delete promotion. Please try again.');
        }
    }
    
    /**
     * Toggle promotion status (active/paused)
     */
    async togglePromotionStatus(promoId, newStatus) {
        console.log(`🔄 [PROMOTIONS] Toggling status for ${promoId} to ${newStatus}`);
        
        // Validate status
        const validStatuses = ['active', 'paused', 'expired'];
        if (!validStatuses.includes(newStatus)) {
            console.error('❌ [PROMOTIONS] Invalid status:', newStatus);
            return;
        }
        
        try {
            await updateDoc(doc(this.db, 'promotions', promoId), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            
            console.log('✅ [PROMOTIONS] Status updated');
            
            // Reload current tab
            const activeTab = document.querySelector('.promo-tab.active');
            const currentStatus = activeTab?.dataset.tab || 'active';
            this.loadPromotions(currentStatus);
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error toggling status:', error);
            alert('Failed to update promotion status. Please try again.');
        }
    }
    
    /**
     * Cancel promotion creation/editing
     */
    cancelPromotion() {
        console.log('❌ [PROMOTIONS] Cancelling promotion form');
        
        const form = document.getElementById('promotionForm');
        const list = document.getElementById('promotionsList');
        
        if (form) {
            form.style.display = 'none';
            
            // Clear form inputs
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => input.value = '');
        }
        
        if (list) list.style.display = 'block';
        
        // Reset editing state
        this.editingPromoId = null;
    }
    
    /**
     * Switch promotion tab (active/paused/expired)
     */
    switchPromoTab(tab, button) {
        console.log(`🔄 [PROMOTIONS] Switching to ${tab} tab`);
        
        // Update active tab button
        const tabs = document.querySelectorAll('.promo-tab');
        tabs.forEach(t => t.classList.remove('active'));
        if (button) button.classList.add('active');
        
        // Load promotions for selected tab
        this.loadPromotions(tab);
    }
    
    // ========== HELPER METHODS ==========
    
    /**
     * Count active promotions (for soft limit enforcement)
     */
    async countActivePromotions(businessId) {
        try {
            const activeQuery = query(
                collection(this.db, 'promotions'),
                where('businessId', '==', businessId),
                where('status', '==', 'active')
            );
            
            const snapshot = await getDocs(activeQuery);
            
            // CLIENT-SIDE FILTER: Count only non-expired
            const now = new Date();
            const validCount = snapshot.docs.filter(doc => {
                const endDate = doc.data().endDate?.toDate();
                return !endDate || endDate > now;
            }).length;
            
            console.log(`📊 [PROMOTIONS] Active promotions count: ${validCount}`);
            return validCount;
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error counting promotions:', error);
            return 0;
        }
    }
    
    /**
     * Render a single promotion item
     * SECURITY: Always use textContent for user data
     */
    renderPromotionItem(promo, container) {
        const item = document.createElement('div');
        item.className = 'promotion-card';
        item.dataset.promoId = promo.id;
        
        // Content container
        const content = document.createElement('div');
        content.className = 'promo-content';
        
        // Title
        const title = document.createElement('div');
        title.className = 'promo-title';
        title.textContent = promo.title || 'Untitled'; // SECURITY: textContent
        
        // Description
        const details = document.createElement('div');
        details.className = 'promo-details';
        details.textContent = promo.description || ''; // SECURITY: textContent
        
        // Status badge
        const statusBadge = document.createElement('span');
        statusBadge.className = `promo-status-badge status-${promo.status}`;
        statusBadge.textContent = promo.status.toUpperCase();
        
        // Dates
        const dates = document.createElement('div');
        dates.className = 'promo-dates';
        const startDate = promo.startDate?.toDate().toLocaleDateString();
        const endDate = promo.endDate?.toDate().toLocaleDateString();
        dates.textContent = `${startDate} - ${endDate}`;
        
        content.appendChild(title);
        content.appendChild(statusBadge);
        content.appendChild(details);
        content.appendChild(dates);
        
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'promo-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'promo-edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => this.editPromotion(promo.id);
        
        // Pause/Play button
        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'promo-pause-btn';
        pauseBtn.dataset.promoId = promo.id;
        pauseBtn.dataset.currentStatus = promo.status;
        
        if (promo.status === 'active') {
            pauseBtn.innerHTML = '⏸️ Pause';
            pauseBtn.title = 'Pause this promotion';
            pauseBtn.onclick = () => {
                console.log('⏸️ [PROMOTIONS] Pausing promotion:', promo.id);
                this.togglePromotionStatus(promo.id, 'paused');
            };
        } else if (promo.status === 'paused') {
            pauseBtn.innerHTML = '▶️ Resume';
            pauseBtn.title = 'Resume this promotion';
            pauseBtn.onclick = () => {
                console.log('▶️ [PROMOTIONS] Resuming promotion:', promo.id);
                this.togglePromotionStatus(promo.id, 'active');
            };
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'promo-delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => this.deletePromotion(promo.id);
        
        actions.appendChild(editBtn);
        
        // Only show pause button for active or paused promotions
        if (promo.status === 'active' || promo.status === 'paused') {
            actions.appendChild(pauseBtn);
        }
        
        actions.appendChild(deleteBtn);
        
        item.appendChild(content);
        item.appendChild(actions);
        
        container.appendChild(item);
    }
    
    /**
     * Update promotions badge on dashboard
     */
    updatePromotionsBadge(count) {
        const badge = document.getElementById('promotionsBadge');
        if (!badge) return;
        
        if (count > 0) {
            badge.textContent = count.toString();
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    
    // ========== REAL-TIME LISTENER ==========
    
    /**
     * Set up real-time listener for promotions
     */
    setupPromotionsListener(businessId) {
        console.log('👂 [PROMOTIONS] Setting up real-time listener');
        
        // Cleanup existing listener
        this.cleanupPromotionsListener();
        
        try {
            const promosQuery = query(
                collection(this.db, 'promotions'),
                where('businessId', '==', businessId),
                orderBy('createdAt', 'desc')
            );
            
            this.promotionsListener = onSnapshot(promosQuery, (snapshot) => {
                console.log('📡 [PROMOTIONS] Real-time update received');
                
                // Count active promotions for badge
                const activeCount = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.status === 'active';
                }).length;
                
                this.updatePromotionsBadge(activeCount);
                
            }, (error) => {
                console.error('❌ [PROMOTIONS] Listener error:', error);
            });
            
            console.log('✅ [PROMOTIONS] Real-time listener active');
            
        } catch (error) {
            console.error('❌ [PROMOTIONS] Error setting up listener:', error);
        }
    }
    
    /**
     * Cleanup promotions listener
     */
    cleanupPromotionsListener() {
        if (this.promotionsListener) {
            console.log('🧹 [PROMOTIONS] Cleaning up listener');
            this.promotionsListener();
            this.promotionsListener = null;
        }
    }
    
    // ========== CLEANUP ==========
    
    /**
     * Cleanup all promotions resources
     */
    cleanup() {
        console.log('🧹 [PROMOTIONS] Cleaning up promotions manager');
        
        this.cleanupPromotionsListener();
        this.editingPromoId = null;
        
        console.log('✅ [PROMOTIONS] Cleanup complete');
    }
}
