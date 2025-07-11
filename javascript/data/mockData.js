// javascript/data/mockData.js

/**
 * Static mock data for the CLASSIFIED app
 */
export class MockData {
    constructor() {
        // Initialize mock data collections
        this._users = this._initializeUsers();
        this._restaurants = this._initializeRestaurants();
        this._activities = this._initializeActivities();
        this._chats = this._initializeChats();
    }
    
    /**
     * Get all users
     * @returns {Array} Array of user objects
     */
    getUsers() {
        return [...this._users];
    }
    
    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Object|null} User object or null
     */
    getUserById(userId) {
        return this._users.find(user => user.id === userId || user.uid === userId) || null;
    }
    
    /**
     * Get users by category
     * @param {string} category - Category filter
     * @returns {Array} Filtered users
     */
    getUsersByCategory(category) {
        if (category === 'all') return this.getUsers();
        return this._users.filter(user => user.category === category);
    }
    
    /**
     * Get online users
     * @returns {Array} Online users
     */
    getOnlineUsers() {
        return this._users.filter(user => user.isOnline);
    }
    
    /**
     * Get nearby users
     * @param {number} maxDistance - Maximum distance in km
     * @returns {Array} Nearby users
     */
    getNearbyUsers(maxDistance = 2) {
        return this._users.filter(user => {
            const distance = parseFloat(user.distance);
            return distance <= maxDistance;
        });
    }
    
    /**
     * Get all restaurants
     * @returns {Array} Array of restaurant objects
     */
    getRestaurants() {
        return [...this._restaurants];
    }
    
    /**
     * Get restaurant by ID
     * @param {string} restaurantId - Restaurant ID
     * @returns {Object|null} Restaurant object or null
     */
    getRestaurantById(restaurantId) {
        return this._restaurants.find(r => r.id === restaurantId) || null;
    }
    
    /**
     * Get all activities
     * @returns {Array} Array of activity objects
     */
    getActivities() {
        return [...this._activities];
    }
    
    /**
     * Get activity by ID
     * @param {string} activityId - Activity ID
     * @returns {Object|null} Activity object or null
     */
    getActivityById(activityId) {
        return this._activities.find(a => a.id === activityId) || null;
    }
    
    /**
     * Get all chats
     * @returns {Array} Array of chat objects
     */
    getChats() {
        return [...this._chats];
    }
    
    /**
     * Get social proof messages
     * @returns {Array} Array of social proof messages
     */
    getSocialProofMessages() {
        return [
            '🎉 Sarah just found her adventure buddy!',
            '🍻 Mike discovered 3 new bars this week',
            '📸 Emma shared amazing photos from her food tour',
            '🎵 Dave found the perfect live music venue',
            '🌟 Jessica made 5 new connections today',
            '🏄 Tom joined a surfing group this morning',
            '🍜 Lisa found the best pho spot in town',
            '🎨 Mark connected with local artists',
            '🚴 Anna organized a bike tour group',
            '🌅 Chris shared sunrise yoga locations'
        ];
    }
    
    /**
     * Initialize users data
     * @private
     */
    _initializeUsers() {
        return [
            {
                id: 'user_jessica',
                uid: 'user_jessica',
                name: "Jessica",
                age: 28,
                image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop",
                interests: ["Reading", "Gym", "Music", "Laughter", "Cafe Connoisseur"],
                bio: "Backpacker exploring Vietnam 🇻🇳 Looking for adventure buddies and great coffee spots!",
                isOnline: true,
                distance: "2 km",
                matchPercentage: 83,
                category: "nomads",
                career: "Digital Nomad",
                lookingFor: "Adventure Buddies"
            },
            {
                id: 'user_dave',
                uid: 'user_dave',
                name: "Dave",
                age: 32,
                image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
                interests: ["Surfing", "Photography", "Coffee", "Adventure Sports", "Live Music"],
                bio: "Digital nomad loving Hoi An vibes ✨ Always down for beach days and exploring local culture.",
                isOnline: false,
                distance: "1.5 km",
                matchPercentage: 76,
                category: "nomads",
                career: "Digital Nomad",
                lookingFor: "Friends"
            },
            {
                id: 'user_rebecca',
                uid: 'user_rebecca',
                name: "Rebecca",
                age: 26,
                image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=600&fit=crop",
                interests: ["Yoga", "Cooking", "Beach", "Art", "Nightlife"],
                bio: "Artist seeking creative adventures 🎨 Love painting landscapes and meeting fellow creatives!",
                isOnline: true,
                distance: "800m",
                matchPercentage: 91,
                category: "all",
                career: "Artist",
                lookingFor: "Networking"
            },
            {
                id: 'user_alex',
                uid: 'user_alex',
                name: "Alex",
                age: 29,
                image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop",
                interests: ["Hiking", "Beer", "Football", "Travel", "Food"],
                bio: "Exploring Southeast Asia one city at a time 🌏 Football fanatic and craft beer enthusiast.",
                isOnline: true,
                distance: "3.2 km",
                matchPercentage: 68,
                category: "all",
                career: "Teacher",
                lookingFor: "Friends"
            },
            {
                id: 'user_maria',
                uid: 'user_maria',
                name: "Maria",
                age: 24,
                image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
                interests: ["Dancing", "Food", "Travel", "Photography", "Beach"],
                bio: "Spanish girl making memories in Vietnam 💃 Love salsa dancing and trying street food!",
                isOnline: false,
                distance: "4.1 km",
                matchPercentage: 79,
                category: "all",
                career: "Student",
                lookingFor: "Dating"
            },
            {
                id: 'user_james',
                uid: 'user_james',
                name: "James",
                age: 30,
                image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=600&fit=crop",
                interests: ["Music", "Art", "Coffee", "Culture", "Adventure"],
                bio: "British musician discovering Southeast Asia 🎸 Looking for jam sessions and cultural experiences.",
                isOnline: true,
                distance: "1.8 km",
                matchPercentage: 85,
                category: "nomads",
                career: "Artist",
                lookingFor: "Networking"
            }
        ];
    }
    
    /**
     * Initialize restaurants data
     * @private
     */
    _initializeRestaurants() {
        return [
            {
                id: 'banh-mi-queen',
                name: "Banh Mi Queen",
                type: "Vietnamese Street Food",
                image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=150&h=200&fit=crop",
                promo: "2-for-1 Banh Mi Special",
                details: "Daily 7am-10pm • Perfect for breakfast",
                description: "Authentic Vietnamese banh mi served fresh daily. A favorite among backpackers for quick, delicious, and affordable meals in the heart of Hoi An Ancient Town.",
                location: "123 Tran Phu Street, Hoi An",
                hours: "7:00 AM - 10:00 PM",
                price: "$ - Budget Friendly",
                contact: "+84 235 123 456"
            },
            {
                id: 'thuan-tinh-island-bar',
                name: "Thuan Tinh Island Bar",
                type: "Riverside Bar & Grill",
                image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=150&h=200&fit=crop",
                promo: "Happy Hour - 50% Off All Drinks",
                details: "Daily 4pm-2am • River views & live music",
                description: "Stunning riverside location with panoramic views of Thu Bon River. Popular with expats and travelers for sunset drinks, live music, and BBQ nights.",
                location: "Thuan Tinh Island, Hoi An",
                hours: "4:00 PM - 2:00 AM",
                price: "$$ - Moderate",
                contact: "+84 235 234 567"
            },
            {
                id: 'streets-restaurant',
                name: "Streets Restaurant & Cafe",
                type: "International Cuisine",
                image: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=150&h=200&fit=crop",
                promo: "Western Breakfast Special",
                details: "Daily 7am-11pm • WiFi & AC",
                description: "Western and Vietnamese fusion cuisine in a comfortable, air-conditioned setting. Great for digital nomads with reliable WiFi and international menu options.",
                location: "45 Le Loi Street, Hoi An",
                hours: "7:00 AM - 11:00 PM",
                price: "$$ - Moderate",
                contact: "+84 235 345 678"
            }
        ];
    }
    
    /**
     * Initialize activities data
     * @private
     */
    _initializeActivities() {
        return [
            {
                id: 'basket-boat-tours',
                name: "Basket Boat Adventure",
                type: "Water Sports",
                image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
                logo: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=100&h=100&fit=crop",
                story: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=150&h=200&fit=crop",
                promo: "Group Discount - 4+ People Save 30%",
                details: "Daily tours 8am & 2pm • 3 hours duration",
                description: "Traditional Vietnamese basket boat tours through coconut forests. Perfect group activity for backpackers wanting to experience local culture and nature.",
                location: "Coconut Forest, Cam Thanh",
                hours: "8:00 AM - 5:00 PM",
                price: "$ - Budget Friendly",
                contact: "+84 235 678 901"
            }
        ];
    }
    
    /**
     * Initialize chats data
     * @private
     */
    _initializeChats() {
        return [
            {
                id: 'chat_jessica',
                name: "Jessica",
                message: "Perfect! Want to check it out together? 😊",
                time: "2m",
                avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
                userId: 'user_jessica'
            },
            {
                id: 'chat_dave',
                name: "Dave", 
                message: "Great surfing spots near Da Nang!",
                time: "1h",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
                userId: 'user_dave'
            },
            {
                id: 'chat_rebecca',
                name: "Rebecca",
                message: "The art scene here is amazing!",
                time: "3h", 
                avatar: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop",
                userId: 'user_rebecca'
            }
        ];
    }
}
