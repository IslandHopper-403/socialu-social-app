// javascript/utils/lazyLoad.js

/**
 * Lazy Load Images using Intersection Observer
 * Works with horizontal and vertical scrolling
 */
export class LazyLoadManager {
    constructor() {
        this.observer = null;
        this.init();
    }
    
    init() {
        // Check if browser supports Intersection Observer
        if (!('IntersectionObserver' in window)) {
            console.warn('⚠️ [LAZY-LOAD] IntersectionObserver not supported');
            return;
        }
        
        // Create observer with options
        const options = {
            root: null, // viewport
            rootMargin: '50px', // Load 50px before entering viewport
            threshold: 0.01
        };
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                }
            });
        }, options);
        
        console.log('✅ [LAZY-LOAD] Manager initialized');
    }
    
    /**
     * Load image when it enters viewport
     */
    loadImage(img) {
        const src = img.dataset.src;
        
        if (!src) return;
        
        // Set actual src
        img.src = src;
        img.removeAttribute('data-src');
        img.classList.add('loaded');
        
        // Stop observing this image
        if (this.observer) {
            this.observer.unobserve(img);
        }
        
        console.log('🖼️ [LAZY-LOAD] Image loaded:', src.substring(0, 50) + '...');
    }
    
    /**
     * Observe images for lazy loading
     */
    observe(images) {
        if (!this.observer) {
            // Fallback: load immediately if no observer
            images.forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
            return;
        }
        
        images.forEach(img => {
            this.observer.observe(img);
        });
        
        console.log(`👀 [LAZY-LOAD] Observing ${images.length} images`);
    }
    
    /**
     * Cleanup
     */
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}