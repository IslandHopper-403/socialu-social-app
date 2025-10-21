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
    
    // Observer will be created per container
    console.log('✅ [LAZY-LOAD] Manager initialized (observers created on-demand)');
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
    
    console.log('🖼️ [LAZY-LOAD] Image loaded:', src.substring(0, 50) + '...');
}
    
    /**
     * Observe images for lazy loading
     */
    observe(images, scrollContainer = null) {
    if (!('IntersectionObserver' in window)) {
        // Fallback: load immediately if no observer support
        images.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
            }
        });
        return;
    }
    
    // Create observer specific to this container
    const options = {
        root: scrollContainer, // Watch scroll container, not viewport!
        rootMargin: '100px', // Load 100px before visible
        threshold: 0.01
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.loadImage(entry.target);
                observer.unobserve(entry.target); // Stop watching after load
            }
        });
    }, options);
    
    // Observe each image
    images.forEach(img => {
        observer.observe(img);
    });
    
    console.log(`👀 [LAZY-LOAD] Observing ${images.length} images in`, scrollContainer ? 'scroll container' : 'viewport');
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