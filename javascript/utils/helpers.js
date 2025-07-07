// Helper Functions Module for CLASSIFIED
// Utility functions used throughout the app

(function(window) {
    'use strict';
    
    const AppHelpers = {
        // Date/Time helpers
        getRelativeTime(date) {
            if (!date) return '';
            
            const now = new Date();
            const targetDate = date instanceof Date ? date : new Date(date);
            const diff = now - targetDate;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'now';
            if (minutes < 60) return `${minutes}m`;
            if (hours < 24) return `${hours}h`;
            if (days < 7) return `${days}d`;
            return targetDate.toLocaleDateString();
        },
        
        // Generate unique IDs
        generateId(prefix = 'id') {
            return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },
        
        // Generate referral code
        generateReferralCode() {
            return Math.random().toString(36).substring(2, 8).toUpperCase();
        },
        
        // Generate temporary password
        generateTempPassword() {
            return Math.random().toString(36).slice(-8);
        },
        
        // Calculate age from birthday
        calculateAge(birthday) {
            if (!birthday) return null;
            
            const today = new Date();
            const birthDate = new Date(birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            return age;
        },
        
        // Format distance
        formatDistance(meters) {
            if (!meters || meters < 0) return 'Unknown';
            
            if (meters < 1000) {
                return `${Math.round(meters)}m`;
            } else {
                return `${(meters / 1000).toFixed(1)} km`;
            }
        },
        
        // Validate email
        isValidEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        // Validate phone number
        isValidPhone(phone) {
            const re = /^[\d\s\-\+\(\)]+$/;
            return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
        },
        
        // Image validation
        isValidImageFile(file) {
            if (!file) return false;
            
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            return validTypes.includes(file.type) && file.size <= maxSize;
        },
        
        // Create debounced function
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        // Create throttled function
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        // Deep clone object
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        },
        
        // Shuffle array
        shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        },
        
        // Get random items from array
        getRandomItems(array, count) {
            if (!array || array.length === 0) return [];
            if (count >= array.length) return [...array];
            
            const shuffled = this.shuffleArray(array);
            return shuffled.slice(0, count);
        },
        
        // Calculate match percentage
        calculateMatchPercentage(user1Interests, user2Interests) {
            if (!user1Interests || !user2Interests) return 50;
            
            const common = user1Interests.filter(interest => 
                user2Interests.includes(interest)
            ).length;
            
            const total = Math.max(user1Interests.length, user2Interests.length);
            const percentage = Math.round((common / total) * 100);
            
            // Add some randomness for realism
            const variance = Math.floor(Math.random() * 20) - 10;
            return Math.max(20, Math.min(95, percentage + variance));
        },
        
        // Format price range
        formatPriceRange(range) {
            const priceMap = {
                'budget': '$ - Budget Friendly',
                'moderate': '$$ - Moderate',
                'expensive': '$$$ - Expensive',
                'luxury': '$$$$ - Luxury'
            };
            return priceMap[range] || '$$ - Moderate';
        },
        
        // Show toast notification
        showToast(message, type = 'info', duration = 3000) {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#4CAF50' : 
                              type === 'error' ? '#FF6B6B' : 
                              type === 'warning' ? '#FFD700' : '#00D4FF'};
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                z-index: 1000;
                animation: slideInRight 0.3s ease;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },
        
        // Storage helpers (using in-memory storage for Claude.ai)
        storage: {
            data: {},
            
            setItem(key, value) {
                this.data[key] = JSON.stringify(value);
                return true;
            },
            
            getItem(key) {
                const value = this.data[key];
                if (!value) return null;
                
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            },
            
            removeItem(key) {
                delete this.data[key];
                return true;
            },
            
            clear() {
                this.data = {};
                return true;
            }
        },
        
        // URL parameter helpers
        getUrlParam(param) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(param);
        },
        
        setUrlParam(param, value) {
            const url = new URL(window.location);
            url.searchParams.set(param, value);
            window.history.pushState({}, '', url);
        },
        
        // Device detection
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },
        
        // Network status
        isOnline() {
            return navigator.onLine;
        },
        
        // Copy to clipboard
        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                this.showToast('Copied to clipboard!', 'success');
                return true;
            } catch (err) {
                console.error('Failed to copy:', err);
                this.showToast('Failed to copy', 'error');
                return false;
            }
        }
    };
    
    // Export to window
    window.AppHelpers = AppHelpers;
    
    console.log('✅ AppHelpers module loaded');
    
})(window);
