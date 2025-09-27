// javascript/utils/security.js

/**
 * Security utilities for input sanitization and XSS prevention
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - Unsanitized HTML string
 * @param {Object} config - DOMPurify configuration
 * @returns {string} Sanitized HTML string
 */
export function sanitizeHtml(dirty, config = {}) {
    if (typeof dirty !== 'string') return '';
    
    // Default config: allow basic formatting but strip dangerous tags
    const defaultConfig = {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true,
        ...config
    };
    
    return DOMPurify.sanitize(dirty, defaultConfig);
}

/**
 * Sanitize text content (strips ALL HTML)
 * @param {string} text - Text to sanitize
 * @returns {string} Plain text with HTML entities escaped
 */
export function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    
    // Strip all HTML tags and return plain text
    return DOMPurify.sanitize(text, { 
        ALLOWED_TAGS: [],
        KEEP_CONTENT: true 
    });
}

/**
 * Escape HTML entities for safe display
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
    if (typeof url !== 'string') return null;
    
    try {
        const parsed = new URL(url);
        // Only allow http, https, and mailto protocols
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * Validate and sanitize profile data
 * @param {Object} profile - Profile data to sanitize
 * @returns {Object} Sanitized profile data
 */
export function sanitizeProfile(profile) {
    return {
        name: sanitizeText(profile.name || '').substring(0, 100),
        bio: sanitizeText(profile.bio || '').substring(0, 500),
        age: parseInt(profile.age) || null,
        height: sanitizeText(profile.height || '').substring(0, 20),
        career: sanitizeText(profile.career || '').substring(0, 50),
        zodiac: sanitizeText(profile.zodiac || '').substring(0, 20),
        interests: Array.isArray(profile.interests) 
            ? profile.interests.map(i => sanitizeText(i).substring(0, 30)).slice(0, 10)
            : [],
        // Pass through non-string fields as-is
        photos: profile.photos || [],
        birthday: profile.birthday || null,
        priority: sanitizeText(profile.priority || '').substring(0, 50),
        relationship: sanitizeText(profile.relationship || '').substring(0, 50),
        lookingFor: sanitizeText(profile.lookingFor || '').substring(0, 50),
        marriage: sanitizeText(profile.marriage || '').substring(0, 50)
    };
}

/**
 * Validate and sanitize message data
 * @param {Object} message - Message data to sanitize
 * @returns {Object} Sanitized message data
 */
export function sanitizeMessage(message) {
    return {
        text: sanitizeText(message.text || '').substring(0, 1000),
        senderId: message.senderId || '',
        senderName: sanitizeText(message.senderName || '').substring(0, 100),
        timestamp: message.timestamp || null,
        read: Boolean(message.read),
        type: message.type === 'promotion' ? 'promotion' : 'text',
        promotion: message.type === 'promotion' && message.promotion 
            ? sanitizePromotion(message.promotion)
            : null
    };
}

/**
 * Sanitize business promotion data
 * @param {Object} promo - Promotion data
 * @returns {Object} Sanitized promotion
 */
function sanitizePromotion(promo) {
    return {
        businessId: promo.businessId || '',
        businessName: sanitizeText(promo.businessName || '').substring(0, 100),
        businessImage: sanitizeUrl(promo.businessImage) || '',
        businessType: sanitizeText(promo.businessType || '').substring(0, 50),
        promotionTitle: sanitizeText(promo.promotionTitle || '').substring(0, 100),
        promotionDetails: sanitizeText(promo.promotionDetails || '').substring(0, 500),
        businessAddress: sanitizeText(promo.businessAddress || '').substring(0, 200)
    };
}

/**
 * Safe element creation with text content
 * @param {string} tag - HTML tag name
 * @param {string} textContent - Text content to set
 * @param {Object} attributes - Element attributes
 * @returns {HTMLElement} Created element
 */
export function createSafeElement(tag, textContent = '', attributes = {}) {
    const element = document.createElement(tag);
    element.textContent = textContent; // Safe - uses textContent
    
    // Set attributes safely
    Object.entries(attributes).forEach(([key, value]) => {
        if (key.startsWith('on')) {
            // Don't allow inline event handlers
            console.warn('Inline event handlers not allowed:', key);
            return;
        }
        element.setAttribute(key, sanitizeText(value));
    });
    
    return element;
}

/**
 * Check if content contains potential XSS
 * @param {string} content - Content to check
 * @returns {boolean} True if suspicious patterns found
 */
export function containsXSS(content) {
    if (typeof content !== 'string') return false;
    
    const xssPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onerror=, onclick=, etc.
        /<iframe/i,
        /eval\(/i,
        /expression\(/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(content));
}
