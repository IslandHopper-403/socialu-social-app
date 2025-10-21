// javascript/features/businessStory.js

import { sanitizeText } from '../../utils/security.js';
import { getOptimizedImageURL } from '../../utils/imageUtils.js';

/**
 * Business Story Manager
 * Handles single business story viewer (Instagram-style photo carousel)
 * Separated from business.js for better code organization
 */
export class BusinessStoryManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set later)
        this.businessManager = null;
        
        // Story state
        this.currentStoryBusiness = null;
        this.currentPhotoIndex = 0;
        this.storyPaused = false;
        this.singleStoryTimeout = null;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.businessManager = managers.business;
    }
    
    /**
     * Initialize story manager
     */
    init() {
        console.log('📖 Initializing business story manager...');
    }
    
    // ==========================================
    // SINGLE BUSINESS STORY VIEWER
    // ==========================================
    
    /**
     * Show single business story (photos carousel + About Us)
     * SECURITY: Sanitizes all user content
     */
    showBusinessStory(business) {
        console.log('📖 [showBusinessStory] Opening story for:', business.name);
        
        // Store current business
        this.currentStoryBusiness = business;
        this.currentPhotoIndex = 0;
        this.storyPaused = false;
        
        // Show overlay
        const overlay = document.getElementById('singleBusinessStory');
        if (!overlay) {
            console.error('❌ Single business story overlay not found');
            return;
        }
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';  // Re-enable when opening
        overlay.style.touchAction = 'auto';  // Re-enable touch!
    
        // Re-enable on child elements
        const storyContent = overlay.querySelector('.story-content');
        const navAreas = overlay.querySelector('.story-nav-areas');
        if (storyContent) {
            storyContent.style.pointerEvents = 'auto';
            storyContent.style.touchAction = 'auto';
        }
        if (navAreas) {
            navAreas.style.pointerEvents = 'auto';
            navAreas.style.touchAction = 'auto';
        }
        
        // Create progress bars (one per photo)
        const photos = business.photos || [];
        if (photos.length === 0) {
            console.warn('⚠️ No photos available for this business');
            this.closeSingleBusinessStory();
            return;
        }
        
        this.createSingleStoryProgressBars(photos.length);
        
        // Update header (SECURITY: using sanitizeText and textContent)
        const logoElement = document.getElementById('singleStoryLogo');
        const nameElement = document.getElementById('singleStoryName');
        const typeElement = document.getElementById('singleStoryType');
        
        if (logoElement) {
    const logoSrc = business.logo || getOptimizedImageURL(photos[1], 'thumbnail') || getOptimizedImageURL(photos[0], 'thumbnail') || '';
    logoElement.src = logoSrc;
}
        if (nameElement) nameElement.textContent = sanitizeText(business.name);
        if (typeElement) typeElement.textContent = sanitizeText(business.type);
        
        // Show first photo
        this.showSingleStoryPhoto(0);
        
        console.log('✅ [showBusinessStory] Story opened successfully');
    }
    
    /**
     * Create progress bars for photos
     */
    createSingleStoryProgressBars(count) {
        const container = document.getElementById('singleStoryProgress');
        if (!container) return;
        
        container.innerHTML = Array(count).fill(0).map((_, i) => `
            <div class="story-progress-bar">
                <div class="story-progress-fill" id="singleProgress${i}"></div>
            </div>
        `).join('');
        
        console.log(`📊 Created ${count} progress bars`);
    }
    
    /**
     * Show specific photo in story
     * SECURITY: Sanitizes About Us text
     */
    showSingleStoryPhoto(index) {
        const business = this.currentStoryBusiness;
        if (!business) return;
        
        const photos = business.photos || [];
        
        // Validate index
        if (index < 0 || index >= photos.length) {
            console.log('📖 Reached end of photos, closing story');
            this.closeSingleBusinessStory();
            return;
        }
        
        this.currentPhotoIndex = index;
        
        // Update photo - use optimized image
const imageElement = document.getElementById('singleStoryImage');
if (imageElement) {
    const optimizedUrl = getOptimizedImageURL(photos[index], 'large');
    imageElement.src = optimizedUrl;
    console.log('🖼️ [STORY] Setting story image:', {
        photoIndex: index,
        photoFormat: typeof photos[index],
        optimizedUrl: optimizedUrl.substring(0, 50) + '...'
    });
}
        
        // Update text overlay - ALWAYS show About Us on ALL photos (per requirement)
        const textOverlay = document.getElementById('singleStoryText');
        if (textOverlay) {
            const aboutUs = business.aboutUs || business.description || 'Welcome!';
            const truncated = aboutUs.length > 350 ? aboutUs.substring(0, 350) + '...' : aboutUs;
            // SECURITY: Using textContent, not innerHTML
            textOverlay.textContent = sanitizeText(truncated);
        }
        
        // Update progress bars
        for (let i = 0; i < photos.length; i++) {
            const progress = document.getElementById(`singleProgress${i}`);
            if (progress) {
                if (i < index) {
                    // Already viewed
                    progress.style.width = '100%';
                    progress.style.transition = 'none';
                } else if (i === index) {
                    // Current photo - animate
                    progress.style.width = '0%';
                    progress.style.transition = 'none';
                    setTimeout(() => {
                        progress.style.width = '100%';
                        progress.style.transition = 'width 5s linear';
                    }, 50);
                } else {
                    // Not viewed yet
                    progress.style.width = '0%';
                    progress.style.transition = 'none';
                }
            }
        }
        
        // Auto-advance after 5 seconds (unless paused)
        if (this.singleStoryTimeout) clearTimeout(this.singleStoryTimeout);
        this.singleStoryTimeout = setTimeout(() => {
            if (!this.storyPaused) {
                this.nextSingleStory();
            }
        }, 5000);
        
        console.log(`📖 Showing photo ${index + 1}/${photos.length}`);
    }
    
    /**
     * Navigate to next photo
     */
    nextSingleStory() {
        const photos = this.currentStoryBusiness?.photos || [];
        if (this.currentPhotoIndex < photos.length - 1) {
            this.showSingleStoryPhoto(this.currentPhotoIndex + 1);
        } else {
            this.closeSingleBusinessStory();
        }
    }
    
    /**
     * Navigate to previous photo
     */
    previousSingleStory() {
        if (this.currentPhotoIndex > 0) {
            this.showSingleStoryPhoto(this.currentPhotoIndex - 1);
        }
    }
    
    /**
     * Toggle pause on tap
     */
    toggleSingleStoryPause() {
        this.storyPaused = !this.storyPaused;
        console.log(`📖 Story ${this.storyPaused ? 'PAUSED' : 'RESUMED'}`);
        
        const currentProgress = document.getElementById(`singleProgress${this.currentPhotoIndex}`);
        if (currentProgress) {
            currentProgress.style.animationPlayState = this.storyPaused ? 'paused' : 'running';
        }
        
        // If unpaused, restart auto-advance
        if (!this.storyPaused) {
            if (this.singleStoryTimeout) clearTimeout(this.singleStoryTimeout);
            this.singleStoryTimeout = setTimeout(() => {
                if (!this.storyPaused) {
                    this.nextSingleStory();
                }
            }, 5000);
        }
    }
    
    /**
     * Close single business story
     * SECURITY: Cleanup timeouts to prevent memory leaks
     */
   closeSingleBusinessStory() {
    const overlay = document.getElementById('singleBusinessStory');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        overlay.style.touchAction = 'none';  // Disable touch events!
        
        // Also disable on child elements
        const storyContent = overlay.querySelector('.story-content');
        const navAreas = overlay.querySelector('.story-nav-areas');
        if (storyContent) {
            storyContent.style.pointerEvents = 'none';
            storyContent.style.touchAction = 'none';
        }
        if (navAreas) {
            navAreas.style.pointerEvents = 'none';
            navAreas.style.touchAction = 'none';
        }
    }
        
        // SECURITY: Clean up timeout
        if (this.singleStoryTimeout) {
            clearTimeout(this.singleStoryTimeout);
            this.singleStoryTimeout = null;
        }
        
        this.currentStoryBusiness = null;
        this.currentPhotoIndex = 0;
        this.storyPaused = false;
        
        console.log('✅ Single business story closed');
    }
    
    /**
     * View full profile from story
     */
    viewProfileFromSingleStory() {
        if (this.currentStoryBusiness && this.businessManager) {
            const business = this.currentStoryBusiness;
            this.closeSingleBusinessStory();
            // Open business profile using existing function
            this.businessManager.openBusinessProfile(business.id, business.type);
        }
    }
    
    /**
     * Add story avatar button to profile hero
     * Called from business.js updateBusinessProfileUI
     */
    addStoryAvatarToHero(business, heroElement) {
        if (!heroElement) return;
        
        // Remove existing avatar if any
        const existing = heroElement.querySelector('.profile-hero-story-avatar');
        if (existing) existing.remove();
        
        // Create avatar
        const avatar = document.createElement('div');
        avatar.className = 'profile-hero-story-avatar';
        
        const img = document.createElement('img');
        const avatarSrc = business.logo || 
                  getOptimizedImageURL(business.photos?.[1], 'thumbnail') || 
                  getOptimizedImageURL(business.photos?.[0], 'thumbnail') || '';
        img.src = avatarSrc;
        img.alt = 'View Story';
        
        avatar.appendChild(img);
        
        // SECURITY: Click handler with stopPropagation
        avatar.onclick = (e) => {
            e.stopPropagation();
            this.showBusinessStory(business);
        };
        
        heroElement.appendChild(avatar);
        console.log('✅ Story avatar added to profile hero');
    }
    
    /**
     * Cleanup on logout or destroy
     * SECURITY: Prevent memory leaks
     */
    cleanup() {
        if (this.singleStoryTimeout) {
            clearTimeout(this.singleStoryTimeout);
            this.singleStoryTimeout = null;
        }
        
        this.closeSingleBusinessStory();
        console.log('✅ Business story manager cleaned up');
    }
}
