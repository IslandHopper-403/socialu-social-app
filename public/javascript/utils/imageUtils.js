// public/javascript/utils/imageUtils.js

/**
 * Image Optimization Utilities
 * Handles both old (string) and new (object) photo formats
 * Works with Firebase Resize Images Extension
 */

/**
 * Get optimized image URL from photo data
 * Supports backward compatibility with old string format
 * 
 * @param {string|object} photo - Photo data (string URL or object with sizes)
 * @param {string} size - Desired size: 'thumb' | 'medium' | 'large' | 'original'
 * @returns {string} - Optimized image URL
 */
export function getOptimizedImageURL(photo, size = 'medium') {
    console.log('🖼️ [IMAGE-UTILS] getOptimizedImageURL called:', {
        photoType: typeof photo,
        requestedSize: size,
        hasPhoto: !!photo
    });
    
    // Handle null/undefined
    if (!photo) {
        console.warn('⚠️ [IMAGE-UTILS] No photo provided');
        return '';
    }
    
    // NEW FORMAT: Object with size variants
    if (typeof photo === 'object' && photo !== null) {
        console.log('✅ [IMAGE-UTILS] Using new object format');
        
        // Return requested size, fallback chain
        const url = photo[size] || photo.medium || photo.original || '';
        
        console.log('✅ [IMAGE-UTILS] Resolved URL:', {
            requestedSize: size,
            foundSize: photo[size] ? size : (photo.medium ? 'medium' : 'original'),
            url: url.substring(0, 50) + '...'
        });
        
        return url;
    }
    
    // OLD FORMAT: String URL (backward compatibility)
    if (typeof photo === 'string') {
        console.log('🔄 [IMAGE-UTILS] Using old string format, constructing optimized URL');
        
        // Original URL format: https://storage.googleapis.com/bucket/businesses/uid/photo.jpg
        // Optimized format: https://storage.googleapis.com/bucket/businesses/uid/photo_800x800.webp
        
        // If requesting original, return as-is
        if (size === 'original') {
            console.log('✅ [IMAGE-UTILS] Returning original URL');
            return photo;
        }
        
        // Construct optimized URL based on size
        const sizeMap = {
            thumb: '200x200',
            medium: '800x800',
            large: '1200x1200'
        };
        
        const dimension = sizeMap[size] || '800x800';
        
        // Replace extension with _WIDTHxHEIGHT.webp
        // photo.jpg -> photo_800x800.webp
        // photo.png -> photo_800x800.webp
        const optimizedURL = photo.replace(/\.(jpg|jpeg|png|gif|webp)$/i, `_${dimension}.webp`);
        
        console.log('✅ [IMAGE-UTILS] Constructed optimized URL:', {
            original: photo.substring(0, 50) + '...',
            optimized: optimizedURL.substring(0, 50) + '...',
            size: size,
            dimension: dimension
        });
        
        return optimizedURL;
    }
    
    // Invalid format
    console.error('❌ [IMAGE-UTILS] Invalid photo format:', typeof photo);
    return '';
}

/**
 * Generate photo object from original URL
 * Creates all size variants for saving to Firestore
 * 
 * @param {string} originalURL - Original uploaded photo URL
 * @returns {object} - Photo object with all sizes
 */
export function generatePhotoObject(originalURL) {
    console.log('📦 [IMAGE-UTILS] generatePhotoObject called:', {
        originalURL: originalURL.substring(0, 50) + '...'
    });
    
    if (!originalURL || typeof originalURL !== 'string') {
        console.error('❌ [IMAGE-UTILS] Invalid originalURL provided');
        return null;
    }
    
    // Extract base URL without extension
    // https://storage.googleapis.com/bucket/businesses/uid/photo.jpg
    // -> https://storage.googleapis.com/bucket/businesses/uid/photo
    const baseURL = originalURL.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    
    const photoObject = {
        original: originalURL,
        thumb: `${baseURL}_200x200.webp`,
        medium: `${baseURL}_800x800.webp`,
        large: `${baseURL}_1200x1200.webp`
    };
    
    console.log('✅ [IMAGE-UTILS] Photo object generated:', {
        original: photoObject.original.substring(0, 50) + '...',
        thumb: photoObject.thumb.substring(0, 50) + '...',
        medium: photoObject.medium.substring(0, 50) + '...',
        large: photoObject.large.substring(0, 50) + '...'
    });
    
    return photoObject;
}

/**
 * Check if photo is in old string format
 * @param {any} photo - Photo data to check
 * @returns {boolean}
 */
export function isOldFormat(photo) {
    return typeof photo === 'string';
}

/**
 * Check if photo is in new object format
 * @param {any} photo - Photo data to check
 * @returns {boolean}
 */
export function isNewFormat(photo) {
    return typeof photo === 'object' && photo !== null && 'original' in photo;
}