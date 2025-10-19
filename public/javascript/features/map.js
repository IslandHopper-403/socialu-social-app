// javascript/features/map.js

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Map Manager
 * Handles interactive map functionality for discovering businesses
 */
export class MapManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.state = appState;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.businessManager = null;
        this.mockData = null;
        
        // Map configuration
        this.map = null;
        this.markers = [];
        this.markerCluster = null;
        this.userLocationMarker = null;
        this.businesses = [];
        this.userLocation = null;
        this.selectedCategory = 'all';
        this.isMapInitialized = false;
        this.geocodeCache = new Map();
        
        // Hoi An center coordinates
        this.defaultCenter = { lat: 15.8801, lng: 108.3380 };
        this.defaultZoom = 14;
        
        // Track loading state
        this.isLoading = false;
        this.loadAttempts = 0;
        this.maxLoadAttempts = 3;
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.businessManager = managers.business;
        
        // Get mock data reference
        if (window.classifiedApp && window.classifiedApp.mockData) {
            this.mockData = window.classifiedApp.mockData;
        }
    }
    
    /**
     * Initialize map system
     */
    async init() {
        console.log('🗺️ Initializing map manager...');
        
        // Inject map HTML if not exists
        this.injectMapHTML();
        
        // Set up event listeners for map triggers
        this.setupEventListeners();
        
        // Request user location (non-blocking)
        this.requestUserLocation();
        
        console.log('✅ Map manager initialized');
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        console.log('🗺️ Setting up map event listeners...');
        
        // Directly bind to map trigger buttons
        const mapTriggerButtons = document.querySelectorAll('.map-trigger-btn');
        console.log(`🗺️ Found ${mapTriggerButtons.length} map trigger buttons`);
        
        mapTriggerButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('🗺️ Map button clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                // Determine category based on current screen
                const currentScreen = this.state.get('currentScreen');
                const category = currentScreen === 'restaurant' ? 'restaurant' : 
                               currentScreen === 'activity' ? 'activity' : 'all';
                
                console.log(`🗺️ Opening map with category: ${category}`);
                this.showMap(category);
            });
        });
        
        // Also add document listener for dynamically added elements
        document.addEventListener('click', (e) => {
            // Check for map trigger button click
            if (e.target.closest('.map-trigger-btn')) {
                console.log('🗺️ Map button clicked (document listener)!');
                e.preventDefault();
                e.stopPropagation();
                
                // Determine category based on current screen
                const currentScreen = this.state.get('currentScreen');
                const category = currentScreen === 'restaurant' ? 'restaurant' : 
                               currentScreen === 'activity' ? 'activity' : 'all';
                
                this.showMap(category);
            }
            
            // Map controls
            if (e.target.closest('.map-close-btn')) {
                this.hideMap();
            }
            
            if (e.target.closest('.map-center-btn')) {
                this.centerOnUserLocation();
            }
            
            if (e.target.closest('.filter-btn')) {
                const btn = e.target.closest('.filter-btn');
                this.handleCategoryFilter(btn);
            }
            
            if (e.target.closest('.panel-close-btn')) {
                this.closeBusinessPanel();
            }
            
            if (e.target.closest('.panel-directions-btn')) {
                this.getDirections();
            }
            
            if (e.target.closest('.panel-view-btn')) {
                this.viewBusinessProfile();
            }
        });
        
        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const mapOverlay = document.getElementById('mapOverlay');
                if (mapOverlay && !mapOverlay.classList.contains('hidden')) {
                    this.hideMap();
                }
            }
        });
    }
    
    /**
     * Inject map HTML into page
     */
    injectMapHTML() {
        // Check if already exists
        if (document.getElementById('mapOverlay')) return;
        
        const mapHTML = `
            <div id="mapOverlay" class="map-overlay hidden">
                <div class="map-header">
                    <button class="map-close-btn" aria-label="Close map">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M6 6l12 12M6 18L18 6" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <h2 class="map-title">Discover Nearby</h2>
                    <button class="map-center-btn" aria-label="Center on location">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="3" stroke-width="2"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                
                <div class="map-filters">
                    <button class="filter-btn active" data-category="all">
                        All <span class="filter-count">0</span>
                    </button>
                    <button class="filter-btn" data-category="restaurant">
                        🍽️ Restaurants <span class="filter-count">0</span>
                    </button>
                    <button class="filter-btn" data-category="activity">
                        🎯 Activities <span class="filter-count">0</span>
                    </button>
                </div>
                
                <div class="map-container-wrapper">
                    <div id="mapContainer" class="map-container"></div>
                    <div class="map-loading-overlay active">
                        <div class="map-spinner"></div>
                        <p>Loading map...</p>
                    </div>
                </div>
                
                <div id="mapBusinessPanel" class="map-business-panel">
                    <button class="panel-close-btn">×</button>
                    <div class="panel-content">
                        <img class="panel-image" src="" alt="">
                        <div class="panel-info">
                            <h3 class="panel-name"></h3>
                            <p class="panel-category"></p>
                            <p class="panel-address"></p>
                            <p class="panel-distance"></p>
                        </div>
                        <div class="panel-actions">
                            <button class="panel-directions-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-width="2"/>
                                    <circle cx="12" cy="10" r="3" stroke-width="2"/>
                                </svg>
                                Get Directions
                            </button>
                            <button class="panel-view-btn">View Profile</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', mapHTML);
    }
    
    /**
     * Show map overlay
     */
    async showMap(initialCategory = 'all') {
        console.log(`🗺️ Opening map with category: ${initialCategory}`);
        
        const overlay = document.getElementById('mapOverlay');
        if (!overlay) {
            console.error('Map overlay not found');
            return;
        }
        
        // Show overlay
        overlay.classList.remove('hidden');
        
        // Set initial category
        this.selectedCategory = initialCategory;
        this.updateFilterButtons();
        
        // Show loading state
        this.showLoading();
        
        try {
            // Initialize map if needed
            if (!this.isMapInitialized) {
                await this.initializeMap();
            }
            
            // Load and display businesses
            await this.loadBusinesses();
            
            // Hide loading
            this.hideLoading();
            
            // Trigger resize to ensure proper rendering
            if (this.map) {
                setTimeout(() => {
                    this.map.invalidateSize();
                }, 100);
            }
        } catch (error) {
            console.error('❌ Error showing map:', error);
            this.handleMapError(error);
        }
    }
    
    /**
     * Hide map overlay
     */
    hideMap() {
        console.log('🗺️ Closing map');
        
        const overlay = document.getElementById('mapOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        this.closeBusinessPanel();
    }
    
    /**
     * Initialize Leaflet map
     */
    async initializeMap() {
        if (this.isMapInitialized) return;
        
        console.log('🗺️ Initializing Leaflet map...');
        
        try {
            // Load Leaflet if not already loaded
            if (!window.L) {
                await this.loadLeafletLibraries();
            }
            
            // Create map instance
            this.map = L.map('mapContainer', {
                center: [this.defaultCenter.lat, this.defaultCenter.lng],
                zoom: this.defaultZoom,
                zoomControl: true,
                attributionControl: false
            });
            
            // Add tile layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            // Initialize marker cluster group
            if (L.MarkerClusterGroup) {
                this.markerCluster = L.markerClusterGroup({
                    chunkedLoading: true,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    maxClusterRadius: 50,
                    iconCreateFunction: (cluster) => {
                        const count = cluster.getChildCount();
                        let size = 'small';
                        if (count > 10) size = 'medium';
                        if (count > 30) size = 'large';
                        
                        return L.divIcon({
                            html: `<div><span>${count}</span></div>`,
                            className: `marker-cluster marker-cluster-${size}`,
                            iconSize: L.point(40, 40)
                        });
                    }
                });
                
                this.map.addLayer(this.markerCluster);
            }
            
            // Add user location if available
            if (this.userLocation) {
                this.addUserLocationMarker();
            }
            
            this.isMapInitialized = true;
            console.log('✅ Map initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
            throw error;
        }
    }
    
    /**
     * Load Leaflet libraries dynamically
     */
    async loadLeafletLibraries() {
        console.log('📦 Loading Leaflet libraries...');
        
        // Load Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        leafletCSS.crossOrigin = '';
        document.head.appendChild(leafletCSS);
        
        // Load MarkerCluster CSS
        const clusterCSS = document.createElement('link');
        clusterCSS.rel = 'stylesheet';
        clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
        document.head.appendChild(clusterCSS);
        
        const clusterDefaultCSS = document.createElement('link');
        clusterDefaultCSS.rel = 'stylesheet';
        clusterDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
        document.head.appendChild(clusterDefaultCSS);
        
        // Load Leaflet JS
        await this.loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        
        // Load MarkerCluster plugin
        await this.loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
        
        console.log('✅ Leaflet libraries loaded');
    }
    
    /**
     * Load script dynamically
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Request user location
     */
    async requestUserLocation() {
        if (!navigator.geolocation) {
            console.log('📍 Geolocation not supported');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                console.log('📍 User location obtained:', this.userLocation);
                
                if (this.map) {
                    this.addUserLocationMarker();
                    
                    // Center on user location if reasonably close to Hoi An
                    const distance = this.calculateDistance(
                        this.userLocation,
                        this.defaultCenter
                    );
                    
                    if (distance < 50) { // Within 50km
                        this.map.setView([this.userLocation.lat, this.userLocation.lng], 15);
                    }
                }
            },
            (error) => {
                console.log('📍 Location permission denied or error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 300000 // Cache for 5 minutes
            }
        );
    }
    
    /**
     * Add user location marker
     */
    addUserLocationMarker() {
        if (!this.map || !this.userLocation) return;
        
        // Remove existing marker if any
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }
        
        // Create pulsing blue dot for user location
        const pulsingIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div class="pulse"></div><div class="dot"></div>',
            iconSize: [20, 20]
        });
        
        this.userLocationMarker = L.marker(
            [this.userLocation.lat, this.userLocation.lng],
            { icon: pulsingIcon, zIndexOffset: 1000 }
        ).addTo(this.map);
        
        this.userLocationMarker.bindPopup('Your Location');
    }
    
    /**
     * Load businesses for map display
     */
    async loadBusinesses() {
        console.log('📍 Loading businesses for map...');
        
        try {
            // Clear existing markers
            this.clearMarkers();
            
            // Fetch businesses based on category
            let businesses = [];
            
            if (this.selectedCategory === 'all' || this.selectedCategory === 'restaurant') {
                const restaurants = await this.fetchRestaurants();
                businesses = businesses.concat(restaurants.map(b => ({ 
                    ...b, 
                    businessType: 'restaurant' 
                })));
            }
            
            if (this.selectedCategory === 'all' || this.selectedCategory === 'activity') {
                const activities = await this.fetchActivities();
                businesses = businesses.concat(activities.map(b => ({ 
                    ...b, 
                    businessType: 'activity' 
                })));
            }
            
            this.businesses = businesses;
            
            console.log(`📍 Loaded ${businesses.length} businesses`);
            
            // Update filter counts
            this.updateFilterCounts();
            
            // Add markers for each business
            for (const business of businesses) {
                await this.addBusinessMarker(business);
            }
            
            // Fit map to show all markers
            if (this.markers.length > 0 && this.map) {
                const group = L.featureGroup(this.markers);
                this.map.fitBounds(group.getBounds().pad(0.1));
            }
            
        } catch (error) {
            console.error('❌ Error loading businesses:', error);
            this.showError('Failed to load businesses');
        }
    }
    
    /**
     * Fetch restaurants
     */
    async fetchRestaurants() {
        try {
            // Try Firebase first
            if (this.state.get('isAuthenticated')) {
                const restaurants = [];
                const q = query(
                    collection(this.db, 'businesses'),
                    where('type', '==', 'restaurant'),
                    where('status', '==', 'active')
                );
                
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    restaurants.push({ id: doc.id, ...doc.data() });
                });
                
                if (restaurants.length > 0) {
                    return restaurants;
                }
            }
            
            // Fallback to mock data
            if (this.mockData) {
                return this.mockData.getRestaurants();
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching restaurants:', error);
            // Fallback to mock data
            return this.mockData ? this.mockData.getRestaurants() : [];
        }
    }
    
    /**
     * Fetch activities
     */
    async fetchActivities() {
        try {
            // Try Firebase first
            if (this.state.get('isAuthenticated')) {
                const activities = [];
                const q = query(
                    collection(this.db, 'businesses'),
                    where('type', '==', 'activity'),
                    where('status', '==', 'active')
                );
                
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    activities.push({ id: doc.id, ...doc.data() });
                });
                
                if (activities.length > 0) {
                    return activities;
                }
            }
            
            // Fallback to mock data
            if (this.mockData) {
                return this.mockData.getActivities();
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching activities:', error);
            // Fallback to mock data
            return this.mockData ? this.mockData.getActivities() : [];
        }
    }
    
    /**
     * Add business marker to map
     */
    async addBusinessMarker(business) {
        if (!this.map || !window.L) return;
        
        // Get coordinates
        const coords = await this.getBusinessCoordinates(business);
        if (!coords) return;
        
        // Calculate distance if user location available
        if (this.userLocation) {
            business.distance = this.calculateDistance(this.userLocation, coords);
        }
        
        // Create custom icon
        const iconClass = business.businessType === 'restaurant' ? 
                         'restaurant-marker' : 'activity-marker';
        const iconEmoji = business.businessType === 'restaurant' ? '🍽️' : '🎯';
        
        const icon = L.divIcon({
            className: `business-marker ${iconClass}`,
            html: `<div class="marker-icon">${iconEmoji}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });
        
        // Create marker
        const marker = L.marker([coords.lat, coords.lng], { icon });
        
        // Store business data with marker
        marker.businessData = business;
        
        // Add click handler
        marker.on('click', () => {
            this.showBusinessPanel(business);
        });
        
        // Add popup preview
        const popupContent = `
            <div class="map-popup">
                ${business.image ? `<img src="${business.image}" alt="${business.name}">` : ''}
                <h4>${business.name}</h4>
                <p>${business.type || business.businessType}</p>
                ${business.distance ? `<p class="distance">📍 ${this.formatDistance(business.distance)}</p>` : ''}
            </div>
        `;
        marker.bindPopup(popupContent);
        
        // Add to cluster or map
        if (this.markerCluster) {
            this.markerCluster.addLayer(marker);
        } else {
            marker.addTo(this.map);
        }
        
        this.markers.push(marker);
    }
    
    /**
     * Get business coordinates
     */
    async getBusinessCoordinates(business) {
        // Check if coordinates already exist
        if (business.coordinates) {
            return business.coordinates;
        }
        
        if (business.latitude && business.longitude) {
            return { lat: business.latitude, lng: business.longitude };
        }
        
        // Check geocode cache
        const cacheKey = business.address || business.location || business.name;
        if (this.geocodeCache.has(cacheKey)) {
            return this.geocodeCache.get(cacheKey);
        }
        
        // Generate random coordinates within Hoi An area for demo
        // In production, you'd use a proper geocoding service
        const coords = this.generateRandomCoordinates();
        
        // Cache the result
        this.geocodeCache.set(cacheKey, coords);
        
        return coords;
    }
    
    /**
     * Generate random coordinates within Hoi An
     */
    generateRandomCoordinates() {
        const latVariation = (Math.random() - 0.5) * 0.04;
        const lngVariation = (Math.random() - 0.5) * 0.04;
        
        return {
            lat: this.defaultCenter.lat + latVariation,
            lng: this.defaultCenter.lng + lngVariation
        };
    }
    
    /**
     * Calculate distance between two points
     */
    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(point2.lat - point1.lat);
        const dLng = this.toRad(point2.lng - point1.lng);
        const lat1 = this.toRad(point1.lat);
        const lat2 = this.toRad(point2.lat);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    /**
     * Convert degrees to radians
     */
    toRad(deg) {
        return deg * (Math.PI / 180);
    }
    
    /**
     * Format distance for display
     */
    formatDistance(km) {
        if (km < 1) {
            return `${Math.round(km * 1000)}m away`;
        }
        return `${km.toFixed(1)}km away`;
    }
    
    /**
     * Handle category filter
     */
    handleCategoryFilter(button) {
        // Update active state
        document.querySelectorAll('.map-filters .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Update category and reload
        this.selectedCategory = button.dataset.category;
        this.loadBusinesses();
    }
    
    /**
     * Update filter buttons
     */
    updateFilterButtons() {
        document.querySelectorAll('.map-filters .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === this.selectedCategory);
        });
    }
    
    /**
     * Update filter counts
     */
    updateFilterCounts() {
        const counts = {
            all: this.businesses.length,
            restaurant: this.businesses.filter(b => b.businessType === 'restaurant').length,
            activity: this.businesses.filter(b => b.businessType === 'activity').length
        };
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const category = btn.dataset.category;
            const countSpan = btn.querySelector('.filter-count');
            if (countSpan) {
                countSpan.textContent = counts[category] || 0;
            }
        });
    }
    
    /**
     * Show business panel
     */
    showBusinessPanel(business) {
        console.log('📍 Showing business panel:', business.name);
        
        this.selectedBusiness = business;
        const panel = document.getElementById('mapBusinessPanel');
        if (!panel) return;
        
        // Populate panel
        panel.querySelector('.panel-image').src = business.image || 'https://via.placeholder.com/300x200';
        panel.querySelector('.panel-name').textContent = business.name;
        panel.querySelector('.panel-category').textContent = business.type || business.businessType;
        panel.querySelector('.panel-address').textContent = business.location || business.address || 'Hoi An, Vietnam';
        
        if (business.distance) {
            panel.querySelector('.panel-distance').textContent = this.formatDistance(business.distance);
            panel.querySelector('.panel-distance').style.display = 'block';
        } else {
            panel.querySelector('.panel-distance').style.display = 'none';
        }
        
        // Show panel
        panel.classList.add('active');
    }
    
    /**
     * Close business panel
     */
    closeBusinessPanel() {
        const panel = document.getElementById('mapBusinessPanel');
        if (panel) {
            panel.classList.remove('active');
        }
        this.selectedBusiness = null;
    }
    
    /**
     * Center map on user location
     */
    centerOnUserLocation() {
        if (this.userLocation && this.map) {
            this.map.setView([this.userLocation.lat, this.userLocation.lng], 16);
            
            // Flash user location marker
            if (this.userLocationMarker) {
                this.userLocationMarker.openPopup();
                setTimeout(() => {
                    this.userLocationMarker.closePopup();
                }, 2000);
            }
        } else {
            // Request location if not available
            this.requestUserLocation();
        }
    }
    
    /**
     * Get directions to selected business
     */
    getDirections() {
        if (!this.selectedBusiness) return;
        
        const coords = this.selectedBusiness.coordinates || 
                      this.geocodeCache.get(this.selectedBusiness.address || this.selectedBusiness.name);
        
        if (coords) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
            window.open(url, '_blank');
        } else {
            // Fallback to address search
            const address = encodeURIComponent(
                `${this.selectedBusiness.name}, ${this.selectedBusiness.address || 'Hoi An, Vietnam'}`
            );
            const url = `https://www.google.com/maps/search/?api=1&query=${address}`;
            window.open(url, '_blank');
        }
    }
    
    /**
     * View business profile
     */
    viewBusinessProfile() {
        if (!this.selectedBusiness) return;
        
        // Close map
        this.hideMap();
        
        // Open business profile using existing manager
        if (this.businessManager) {
            const businessType = this.selectedBusiness.businessType || 'restaurant';
            this.businessManager.openBusinessProfile(this.selectedBusiness.id, businessType);
        }
    }
    
    /**
     * Clear all markers
     */
    clearMarkers() {
        if (this.markerCluster) {
            this.markerCluster.clearLayers();
        } else {
            this.markers.forEach(marker => {
                if (this.map && marker) {
                    this.map.removeLayer(marker);
                }
            });
        }
        this.markers = [];
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        const loadingOverlay = document.querySelector('.map-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingOverlay = document.querySelector('.map-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'map-error-toast show';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
    
    /**
     * Handle map errors
     */
    handleMapError(error) {
        console.error('Map error:', error);
        
        this.hideLoading();
        
        // Show user-friendly error message
        let errorMessage = 'Unable to load map. Please try again.';
        
        if (!navigator.onLine) {
            errorMessage = 'No internet connection. Please check your connection and try again.';
        } else if (error.message && error.message.includes('permission')) {
            errorMessage = 'Location permission denied. You can still browse businesses on the map.';
        }
        
        this.showError(errorMessage);
        
        // Retry logic for recoverable errors
        if (this.loadAttempts < this.maxLoadAttempts && navigator.onLine) {
            this.loadAttempts++;
            console.log(`Retrying map load (attempt ${this.loadAttempts}/${this.maxLoadAttempts})...`);
            
            setTimeout(() => {
                this.showMap(this.selectedCategory);
            }, 2000 * this.loadAttempts);
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Remove map instance
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        // Clear markers
        this.clearMarkers();
        
        // Reset state
        this.isMapInitialized = false;
        this.markerCluster = null;
        this.userLocationMarker = null;
        this.businesses = [];
        this.geocodeCache.clear();
        
        console.log('🗺️ Map manager destroyed');
    }
}
