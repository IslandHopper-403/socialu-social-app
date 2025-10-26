// javascript/utils/pagination.js

/**
 * FeedPaginator - Reusable Pagination Helper
 * 
 * Handles pagination logic for all feeds (restaurants, activities, users)
 * Designed for infinite scroll with IntersectionObserver
 * 
 * Features:
 * - Configurable page size (default: 8 items)
 * - Tracks current page and total pages
 * - Handles edge cases (items < page size, empty arrays)
 * - Comprehensive debug logging for monitoring
 * - Performance optimized for large datasets
 * 
 * Usage Example:
 * ```javascript
 * import { FeedPaginator } from './utils/pagination.js';
 * 
 * // Initialize with items and page size
 * const paginator = new FeedPaginator(restaurants, 8, 'restaurant');
 * 
 * // Get first page
 * const firstPage = paginator.getNextPage();
 * 
 * // Check if more pages exist
 * if (paginator.hasMore()) {
 *     // Set up infinite scroll
 * }
 * 
 * // Load next page on scroll
 * const nextPage = paginator.getNextPage();
 * ```
 * 
 * @class FeedPaginator
 * @param {Array} items - Array of items to paginate
 * @param {number} pageSize - Number of items per page (default: 8)
 * @param {string} feedType - Feed type for logging (e.g., 'restaurant', 'activity', 'user')
 */
export class FeedPaginator {
    constructor(items, pageSize = 8, feedType = 'unknown') {
        console.log(`📄 [PAGINATION-${feedType.toUpperCase()}] Initializing paginator at:`, Date.now());
        
        // Validate inputs
        if (!Array.isArray(items)) {
            console.error(`❌ [PAGINATION-${feedType.toUpperCase()}] Invalid items: expected Array, got`, typeof items);
            this.allItems = [];
        } else {
            this.allItems = items;
        }
        
        // Validate page size
        if (typeof pageSize !== 'number' || pageSize < 1) {
            console.warn(`⚠️ [PAGINATION-${feedType.toUpperCase()}] Invalid pageSize: ${pageSize}, defaulting to 8`);
            this.pageSize = 8;
        } else {
            this.pageSize = pageSize;
        }
        
        this.feedType = feedType;
        this.currentPage = 0;
        this.isLoading = false; // Prevent duplicate loads
        
        // Calculate total pages
        this.totalPages = Math.ceil(this.allItems.length / this.pageSize);
        
        console.log(`📄 [PAGINATION-${feedType.toUpperCase()}] Paginator initialized:`, {
            totalItems: this.allItems.length,
            pageSize: this.pageSize,
            totalPages: this.totalPages,
            willPaginate: this.totalPages > 1,
            timestamp: Date.now()
        });
        
        // Edge case: If items less than page size, log it
        if (this.allItems.length > 0 && this.allItems.length < this.pageSize) {
            console.log(`📄 [PAGINATION-${feedType.toUpperCase()}] ⚠️ Items (${this.allItems.length}) < page size (${this.pageSize}) - will show all items on first page`);
        }
        
        // Edge case: Empty array
        if (this.allItems.length === 0) {
            console.log(`📄 [PAGINATION-${feedType.toUpperCase()}] ⚠️ Empty items array - no pagination needed`);
        }
    }
    
    /**
     * Get the next page of items
     * Returns up to pageSize items from the current position
     * Automatically increments the page counter
     * 
     * @returns {Array} Next page of items (up to pageSize)
     */
    getNextPage() {
        // Calculate range
        const start = this.currentPage * this.pageSize;
        const end = start + this.pageSize;
        const page = this.allItems.slice(start, end);
        
        console.log(`📄 [PAGINATION-${this.feedType.toUpperCase()}] getNextPage() called:`, {
            pageNumber: this.currentPage + 1,
            totalPages: this.totalPages,
            itemsInPage: page.length,
            range: `${start + 1}-${start + page.length} of ${this.allItems.length}`,
            timestamp: Date.now()
        });
        
        // Increment page counter for next call
        this.currentPage++;
        
        return page;
    }
    
    /**
     * Check if more pages are available
     * Used to determine if infinite scroll should continue
     * 
     * @returns {boolean} True if more pages exist
     */
    hasMore() {
        const hasMorePages = this.currentPage < this.totalPages;
        
        console.log(`📄 [PAGINATION-${this.feedType.toUpperCase()}] hasMore() check:`, {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            hasMore: hasMorePages,
            itemsRemaining: Math.max(0, this.allItems.length - (this.currentPage * this.pageSize))
        });
        
        return hasMorePages;
    }
    
    /**
     * Reset pagination to start
     * Useful for re-rendering or filter changes
     */
    reset() {
        console.log(`📄 [PAGINATION-${this.feedType.toUpperCase()}] reset() called - resetting to page 0 at:`, Date.now());
        this.currentPage = 0;
        this.isLoading = false;
    }
    
    /**
     * Get current page number (0-indexed internally, but returns 1-indexed for display)
     * @returns {number} Current page number (1-indexed)
     */
    getCurrentPage() {
        return this.currentPage;
    }
    
    /**
     * Get total number of pages
     * @returns {number} Total pages
     */
    getTotalPages() {
        return this.totalPages;
    }
    
    /**
     * Get total number of items
     * @returns {number} Total items in the dataset
     */
    getTotalItems() {
        return this.allItems.length;
    }
    
    /**
     * Check if pagination is needed (more than 1 page)
     * Useful for conditionally showing pagination UI
     * 
     * @returns {boolean} True if pagination is needed
     */
    needsPagination() {
        return this.totalPages > 1;
    }
    
    /**
     * Get items remaining after current page
     * Useful for showing "X more items" messages
     * 
     * @returns {number} Number of items not yet loaded
     */
    getItemsRemaining() {
        return Math.max(0, this.allItems.length - (this.currentPage * this.pageSize));
    }
    
    /**
     * Check if currently loading (prevents duplicate requests)
     * @returns {boolean} True if loading
     */
    isCurrentlyLoading() {
        return this.isLoading;
    }
    
    /**
     * Set loading state
     * @param {boolean} loading - Loading state
     */
    setLoading(loading) {
        this.isLoading = loading;
        console.log(`📄 [PAGINATION-${this.feedType.toUpperCase()}] Loading state changed:`, {
            isLoading: this.isLoading,
            timestamp: Date.now()
        });
    }
    
    /**
     * Get summary of pagination state
     * Useful for debugging
     * 
     * @returns {Object} Pagination state summary
     */
    getState() {
        return {
            feedType: this.feedType,
            totalItems: this.allItems.length,
            pageSize: this.pageSize,
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            hasMore: this.hasMore(),
            itemsRemaining: this.getItemsRemaining(),
            needsPagination: this.needsPagination(),
            isLoading: this.isLoading
        };
    }
    
    /**
     * Log current state (debugging helper)
     */
    logState() {
        console.log(`📄 [PAGINATION-${this.feedType.toUpperCase()}] Current state:`, this.getState());
    }
}

/**
 * Create a pagination summary message
 * Useful for displaying to users
 * 
 * @param {FeedPaginator} paginator - Paginator instance
 * @returns {string} Human-readable summary
 */
export function getPaginationSummary(paginator) {
    const state = paginator.getState();
    
    if (state.totalItems === 0) {
        return 'No items to display';
    }
    
    if (!state.needsPagination) {
        return `Showing all ${state.totalItems} items`;
    }
    
    const itemsShown = state.currentPage * state.pageSize;
    return `Showing ${itemsShown} of ${state.totalItems} items`;
}

/**
 * Export default for convenience
 */
export default FeedPaginator;
