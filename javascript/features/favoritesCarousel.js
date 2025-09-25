// javascript/features/favoritesCarousel.js

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Favorites Carousel Manager
 * Handles the floating favorites carousel for sending promotions in chats
 */
export class FavoritesCarouselManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers
        this.messagingManager = null;
        this.navigationManager = null;
        
        // Carousel state
        this.isExpanded = false;
        this.isMinimized = true;
        this.isDragging = false;
        this.currentPosition = { y: 200 }; // Default position from top
        this.favorites = [];
        this.carouselElement = null;
        
        // Touch/drag tracking
        this.dragStartY = 0;
        this.elementStartY = 0;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.messagingManager = managers.messaging;
        this.navigationManager = managers.navigation;
    }
    
    /**
     * Initialize the carousel system
     */
    async init() {
        console.log('🎠 Initializing favorites carousel...');
        
        // Create carousel DOM structure
        this.createCarouselElement();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load user's favorites
        if (this.state.get('isAuthenticated')) {
            await this.loadUserFavorites();
        }
        
        // Initially hide carousel until needed
        this.hideCarousel();
    }
    
    /**
     * Create the carousel DOM element
     */
    createCarouselElement() {
        // Check if already exists
        if (document.getElementById('favoritesCarousel')) {
            this.carouselElement = document.getElementById('favoritesCarousel');
            return;
        }
        
        const carouselHTML = `
            <div id="favoritesCarousel" class="favorites-carousel">
                <div class="carousel-handle" id="carouselHandle">
                    <div class="handle-grip"></div>
                </div>
                <div class="carousel-container">
                    <div class="carousel-header">
                        <span class="carousel-title">Send a Special</span>
                       <button class="carousel-toggle" id="carouselToggle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                    </div>
                    <div class="carousel-content" id="carouselContent">
                        <div class="carousel-scroll" id="carouselScroll">
                            <!-- Favorites will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.injectStyles();
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', carouselHTML);
        this.carouselElement = document.getElementById('favoritesCarousel');
    }
    
    /**
     * Inject required styles
     */
    injectStyles() {
        if (document.getElementById('favoritesCarouselStyles')) return;
        
        const styles = `
            <style id="favoritesCarouselStyles">
                .favorites-carousel {
                    position: fixed;
                    left: 0;
                    top: 200px;
                    z-index: 250;
                    display: flex;
                    align-items: center;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: translateX(-280px);
                }
                
                .favorites-carousel.expanded {
                    transform: translateX(0);
                }
                
                .favorites-carousel.minimized {
                    transform: translateX(-240px);
                }
                
                .carousel-handle {
                    width: 30px;
                    height: 60px;
                    background: linear-gradient(135deg, #00D4FF, #0099CC);
                    border-radius: 0 30px 30px 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
                    margin-left: -2px;
                }
                
                .carousel-handle:active {
                    cursor: grabbing;
                }
                
                .handle-grip {
                    width: 4px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.6);
                    border-radius: 2px;
                    position: relative;
                }
                
                .handle-grip::before,
                .handle-grip::after {
                    content: '';
                    position: absolute;
                    width: 4px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.6);
                    border-radius: 2px;
                }
                
                .handle-grip::before {
                    left: -8px;
                }
                
                .handle-grip::after {
                    left: 8px;
                }
                
                .carousel-container {
                    width: 280px;
                    background: rgba(26, 26, 26, 0.95);
                    backdrop-filter: blur(10px);
                    border-radius: 0 15px 15px 0;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-left: none;
                    overflow: hidden;
                }
                
                .carousel-header {
                    padding: 12px 15px;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .carousel-title {
                    color: #00D4FF;
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .carousel-toggle {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s ease;
            }
            
                .carousel-toggle:hover {
                    color: #00D4FF;
                }
                
                /* FIXED: Correct arrow direction logic */
                .favorites-carousel.minimized .carousel-toggle {
                    transform: rotate(0deg); /* > arrow pointing right when minimized */
                }
                
                .favorites-carousel.expanded .carousel-toggle {
                    transform: rotate(180deg); /* < arrow pointing left when expanded */
                }
                
                .carousel-content {
                    padding: 10px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .carousel-scroll {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                
                .favorite-card {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                }
                
                .favorite-card:hover {
                    background: rgba(0, 212, 255, 0.1);
                    border-color: rgba(0, 212, 255, 0.3);
                    transform: translateX(5px);
                }
                
                .favorite-card-header {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .favorite-card-image {
                    width: 50px;
                    height: 50px;
                    border-radius: 8px;
                    background-size: cover;
                    background-position: center;
                }
                
                .favorite-card-info {
                    flex: 1;
                }
                
                .favorite-card-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: white;
                    margin-bottom: 2px;
                }
                
                .favorite-card-type {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.6);
                }
                
                .favorite-card-promo {
                    background: linear-gradient(135deg, #FF6B6B, #FF8C42);
                    padding: 8px;
                    border-radius: 8px;
                    font-size: 12px;
                    color: white;
                }
                
                .favorite-card-promo-title {
                    font-weight: 600;
                    margin-bottom: 2px;
                }
                
                .favorite-card-promo-details {
                    font-size: 11px;
                    opacity: 0.9;
                }
                
                .remove-favorite {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 20px;
                    height: 20px;
                    background: rgba(255, 107, 107, 0.2);
                    border: 1px solid rgba(255, 107, 107, 0.3);
                    border-radius: 50%;
                    color: #FF6B6B;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 12px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .favorite-card:hover .remove-favorite {
                    opacity: 1;
                }
                
                .remove-favorite:hover {
                    background: rgba(255, 107, 107, 0.3);
                    transform: scale(1.1);
                }
                
                .empty-favorites {
                    text-align: center;
                    padding: 30px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 14px;
                }
                
                .empty-favorites-icon {
                    font-size: 48px;
                    margin-bottom: 10px;
                    opacity: 0.3;
                }
                
                /* Hide carousel in certain contexts */
                body:has(.auth-screen.show) .favorites-carousel,
                body:has(.overlay-screen.show:not(#individualChat)) .favorites-carousel {
                    display: none;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Toggle button
        const toggleBtn = document.getElementById('carouselToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleCarousel());
        }
        
        // Handle dragging
        const handle = document.getElementById('carouselHandle');
        if (handle) {
            // Mouse events
            handle.addEventListener('mousedown', (e) => this.startDrag(e));
            document.addEventListener('mousemove', (e) => this.drag(e));
            document.addEventListener('mouseup', () => this.endDrag());
            
            // Touch events
            handle.addEventListener('touchstart', (e) => this.startDrag(e));
            document.addEventListener('touchmove', (e) => this.drag(e));
            document.addEventListener('touchend', () => this.endDrag());
        }
        
        // Listen for chat open/close events
        document.addEventListener('chatOpened', () => this.onChatOpened());
        document.addEventListener('chatClosed', () => this.onChatClosed());
    }
    
    /**
     * Toggle carousel expanded/minimized state
     */
    toggleCarousel() {
        if (this.isExpanded) {
            this.minimizeCarousel();
        } else {
            this.expandCarousel();
        }
    }
    
    /**
     * Expand carousel
     */
    expandCarousel() {
        this.isExpanded = true;
        this.isMinimized = false;
        this.carouselElement.classList.add('expanded');
        this.carouselElement.classList.remove('minimized');
        console.log('📂 Carousel expanded');
    }
    
    /**
     * Minimize carousel
     */
    minimizeCarousel() {
        this.isExpanded = false;
        this.isMinimized = true;
        this.carouselElement.classList.remove('expanded');
        this.carouselElement.classList.add('minimized');
        console.log('📁 Carousel minimized');
    }
    
    /**
     * Show carousel
     */
    showCarousel() {
        this.carouselElement.style.display = 'flex';
        setTimeout(() => {
            this.minimizeCarousel();
        }, 100);
    }
    
    /**
     * Hide carousel
     */
    hideCarousel() {
        this.carouselElement.style.display = 'none';
    }
    
    /**
     * Handle drag start
     */
    startDrag(e) {
        this.isDragging = true;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        this.dragStartY = clientY;
        this.elementStartY = this.currentPosition.y;
        this.carouselElement.style.transition = 'none';
    }
    
    /**
     * Handle dragging
     */
    drag(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - this.dragStartY;
        const newY = this.elementStartY + deltaY;
        
        // Constrain to screen bounds
        const minY = 100;
        const maxY = window.innerHeight - 200;
        this.currentPosition.y = Math.max(minY, Math.min(maxY, newY));
        
        this.carouselElement.style.top = `${this.currentPosition.y}px`;
    }
    
    /**
     * Handle drag end
     */
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.carouselElement.style.transition = '';
        
        // Save position to localStorage
        localStorage.setItem('carouselPosition', JSON.stringify(this.currentPosition));
    }
    
    /**
     * Load user's favorite businesses
     */
    async loadUserFavorites() {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            // Get user's favorites from Firestore
            const userDoc = await getDoc(doc(this.db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const favoriteIds = userData.favorites || [];
                
                // Load favorite business details
                this.favorites = [];
                for (const businessId of favoriteIds) {
                    const business = await this.loadBusinessData(businessId);
                    if (business) {
                        this.favorites.push(business);
                    }
                }
                
                // Update UI
                this.renderFavorites();
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }
    
    /**
     * Load business data
     */
    async loadBusinessData(businessId) {
        try {
            // Try Firebase first
            const businessDoc = await getDoc(doc(this.db, 'businesses', businessId));
            if (businessDoc.exists()) {
                return { id: businessDoc.id, ...businessDoc.data() };
            }
            
            // Fallback to mock data
            if (window.classifiedApp?.mockData) {
                const mockData = window.classifiedApp.mockData;
                const restaurant = mockData.getRestaurantById(businessId);
                if (restaurant) return restaurant;
                const activity = mockData.getActivityById(businessId);
                if (activity) return activity;
            }
            
            return null;
        } catch (error) {
            console.error('Error loading business:', error);
            return null;
        }
    }
    
    /**
     * Render favorites in carousel
     */
    renderFavorites() {
        const scrollContainer = document.getElementById('carouselScroll');
        if (!scrollContainer) return;
        
        if (this.favorites.length === 0) {
            scrollContainer.innerHTML = `
                <div class="empty-favorites">
                    <div class="empty-favorites-icon">💝</div>
                    <div>No favorites yet!</div>
                    <div style="font-size: 12px; margin-top: 5px;">
                        Tap the heart on any business to save it here
                    </div>
                </div>
            `;
            return;
        }
        
        scrollContainer.innerHTML = this.favorites.map(business => `
            <div class="favorite-card" data-business-id="${business.id}">
                <div class="remove-favorite" onclick="event.stopPropagation(); window.CLASSIFIED.removeFavorite('${business.id}')">×</div>
                <div class="favorite-card-header">
                    <div class="favorite-card-image" style="background-image: url('${business.image || business.logo}')"></div>
                    <div class="favorite-card-info">
                        <div class="favorite-card-name">${business.name}</div>
                        <div class="favorite-card-type">${business.type}</div>
                    </div>
                </div>
                ${business.promo || business.promoTitle ? `
                    <div class="favorite-card-promo">
                        <div class="favorite-card-promo-title">${business.promo || business.promoTitle}</div>
                        <div class="favorite-card-promo-details">${business.details || business.promoDetails || ''}</div>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // Add click handlers
        scrollContainer.querySelectorAll('.favorite-card').forEach(card => {
            card.addEventListener('click', () => {
                const businessId = card.dataset.businessId;
                this.sendBusinessPromotion(businessId);
            });
        });
    }
    
    /**
     * Add business to favorites
     */
    async addToFavorites(businessId) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            alert('Please sign in to save favorites');
            return;
        }
        
        try {
            // Update user's favorites in Firestore
            await updateDoc(doc(this.db, 'users', currentUser.uid), {
                favorites: arrayUnion(businessId),
                updatedAt: serverTimestamp()
            });
            
            // Load the business data
            const business = await this.loadBusinessData(businessId);
            if (business && !this.favorites.find(f => f.id === businessId)) {
                this.favorites.push(business);
                this.renderFavorites();
            }
            
            // Show confirmation
            this.showNotification('Added to favorites! 💖');
            
            // Show carousel briefly if in chat
            if (this.state.get('isChatOpen')) {
                this.showCarousel();
                setTimeout(() => this.expandCarousel(), 500);
                setTimeout(() => this.minimizeCarousel(), 2000);
            }
            
        } catch (error) {
            console.error('Error adding to favorites:', error);
            alert('Failed to add to favorites');
        }
    }
    
    /**
     * Remove business from favorites
     */
    async removeFavorite(businessId) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            // Update user's favorites in Firestore
            await updateDoc(doc(this.db, 'users', currentUser.uid), {
                favorites: arrayRemove(businessId),
                updatedAt: serverTimestamp()
            });
            
            // Remove from local array
            this.favorites = this.favorites.filter(f => f.id !== businessId);
            this.renderFavorites();
            
            this.showNotification('Removed from favorites');
            
        } catch (error) {
            console.error('Error removing favorite:', error);
        }
    }
    
    /**
     * Send business promotion in current chat
     */
    async sendBusinessPromotion(businessId) {
        const currentChatId = this.messagingManager?.currentChatId;
        if (!currentChatId) {
            alert('Please open a chat first');
            return;
        }
        
        const business = this.favorites.find(f => f.id === businessId);
        if (!business) return;
        
        try {
            // Create promotion message
            const promoMessage = {
                type: 'promotion',
                businessId: business.id,
                businessName: business.name,
                businessImage: business.image || business.logo,
                businessType: business.type,
                promotionTitle: business.promo || business.promoTitle || 'Special Offer',
                promotionDetails: business.details || business.promoDetails || 'Ask about our current promotions!',
                businessAddress: business.address || business.location,
                timestamp: serverTimestamp()
            };
            
            // Send using messaging manager
            await this.messagingManager.sendPromotionMessage(promoMessage);
            
            // Minimize carousel after sending
            this.minimizeCarousel();
            
            this.showNotification('Promotion sent! 🎉');
            
        } catch (error) {
            console.error('Error sending promotion:', error);
            alert('Failed to send promotion');
        }
    }
    
    /**
     * Handle chat opened event
     */
    onChatOpened() {
        if (this.favorites.length > 0) {
            this.showCarousel();
        }
    }
    
    /**
     * Handle chat closed event
     */
    onChatClosed() {
        this.hideCarousel();
    }
    
    /**
     * Show notification
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'carousel-notification';
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 212, 255, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            z-index: 1000;
            animation: slideUp 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }
    
    /**
     * Check if business is favorited
     */
    isFavorited(businessId) {
        return this.favorites.some(f => f.id === businessId);
    }
    
    /**
     * Toggle favorite status
     */
    async toggleFavorite(businessId) {
        if (this.isFavorited(businessId)) {
            await this.removeFavorite(businessId);
        } else {
            await this.addToFavorites(businessId);
        }
    }
}
