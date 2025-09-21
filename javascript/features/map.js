// javascript/features/map.js
import { db } from '../config/firebase-config.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import BusinessManager from '../managers/BusinessManager.js';
import NavigationManager from '../managers/NavigationManager.js';

class MapManager {
    constructor() {
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
        
        // Bind methods
        this.initializeMap = this.initializeMap.bind(this);
        this.showMap = this.showMap.bind(this);
        this.hideMap = this.hideMap.bind(this);
        this.handleCategoryFilter = this.handleCategoryFilter.bind(this);
    }

    async initialize() {
        // Load Leaflet CSS and JS dynamically
        if (!window.L) {
            await this.loadLeafletLibraries();
        }
        
        this.setupEventListeners();
        this.injectMapHTML();
        this.requestUserLocation();
    }

    async loadLeafletLibraries() {
        // Load Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
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
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    injectMapHTML() {
        // Check if map overlay already exists
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
                    <div class="map-loading-overlay">
                        <div class="map-spinner"></div>
                        <p>Loading map...</p>
                    </div>
                </div>
                
                <div class="map-business-panel hidden">
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

    setupEventListeners() {
        // Replace settings icons with map icons in both tabs
        document.addEventListener('click', (e) => {
            // Check for map button clicks (replacing settings gear)
            if (e.target.closest('.settings-btn') || e.target.closest('.map-trigger-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const parentTab = e.target.closest('.tab-content');
                if (parentTab && (parentTab.id === 'restaurantTab' || parentTab.id === 'activityTab')) {
                    const category = parentTab.id === 'restaurantTab' ? 'restaurant' : 'activity';
                    this.showMap(category);
                }
            }

            // Map overlay controls
            if (e.target.closest('.map-close-btn')) {
                this.hideMap();
            }

            if (e.target.closest('.map-center-btn')) {
                this.centerOnUserLocation();
            }

            if (e.target.closest('.filter-btn')) {
                this.handleCategoryFilter(e.target.closest('.filter-btn'));
            }

            if (e.target.closest('.panel-close-btn')) {
                this.closeBusinessPanel();
            }

            if (e.target.closest('.panel-directions-btn')) {
                const business = this.selectedBusiness;
                if (business && business.coordinates) {
                    this.openDirections(business.coordinates);
                }
            }

            if (e.target.closest('.panel-view-btn')) {
                const business = this.selectedBusiness;
                if (business) {
                    this.viewBusinessProfile(business);
                }
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('mapOverlay').classList.contains('hidden')) {
                this.hideMap();
            }
        });
    }

    async showMap(initialCategory = 'all') {
        const overlay = document.getElementById('mapOverlay');
        if (!overlay) return;

        // Show overlay with loading state
        overlay.classList.remove('hidden');
        document.querySelector('.map-loading-overlay').classList.add('active');
        
        // Set initial category
        this.selectedCategory = initialCategory;
        this.updateFilterButtons();

        // Initialize map if needed
        if (!this.isMapInitialized) {
            await this.initializeMap();
        }

        // Load and display businesses
        await this.loadBusinesses();
        
        // Hide loading overlay
        document.querySelector('.map-loading-overlay').classList.remove('active');
        
        // Trigger map resize to ensure proper rendering
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }

        // Add to navigation history
        NavigationManager.pushState('map');
    }

    hideMap() {
        const overlay = document.getElementById('mapOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        this.closeBusinessPanel();
        NavigationManager.popState();
    }

    async initializeMap() {
        if (this.isMapInitialized || !window.L) return;

        try {
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
            
            // Add user location if available
            if (this.userLocation) {
                this.addUserLocationMarker();
            }

            this.isMapInitialized = true;
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to initialize map. Please try again.');
        }
    }

    async requestUserLocation() {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                if (this.map) {
                    this.addUserLocationMarker();
                    // Only center if user is reasonably close to Hoi An
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
                console.log('Location permission denied or error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 300000 // Cache for 5 minutes
            }
        );
    }

    addUserLocationMarker() {
        if (!this.map || !this.userLocation) return;

        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

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

    async loadBusinesses() {
        try {
            // Clear existing markers
            this.clearMarkers();

            // Fetch businesses based on category
            let businesses = [];
            
            if (this.selectedCategory === 'all' || this.selectedCategory === 'restaurant') {
                const restaurants = await BusinessManager.getRestaurants();
                businesses = businesses.concat(restaurants.map(b => ({ ...b, type: 'restaurant' })));
            }
            
            if (this.selectedCategory === 'all' || this.selectedCategory === 'activity') {
                const activities = await BusinessManager.getActivities();
                businesses = businesses.concat(activities.map(b => ({ ...b, type: 'activity' })));
            }

            this.businesses = businesses;
            
            // Update filter counts
            this.updateFilterCounts();
            
            // Add markers for each business
            for (const business of businesses) {
                await this.addBusinessMarker(business);
            }

            // Fit map to show all markers
            if (this.markers.length > 0) {
                const group = L.featureGroup(this.markers);
                this.map.fitBounds(group.getBounds().pad(0.1));
            }

        } catch (error) {
            console.error('Error loading businesses:', error);
            this.showError('Failed to load businesses. Please try again.');
        }
    }

    async addBusinessMarker(business) {
        // Get coordinates (geocode if needed)
        const coords = await this.getBusinessCoordinates(business);
        if (!coords) return;

        business.coordinates = coords;

        // Calculate distance from user
        if (this.userLocation) {
            business.distance = this.calculateDistance(this.userLocation, coords);
        }

        // Create custom icon
        const icon = L.divIcon({
            className: `business-marker ${business.type}-marker`,
            html: `<div class="marker-icon">${business.type === 'restaurant' ? '🍽️' : '🎯'}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });

        // Create marker
        const marker = L.marker([coords.lat, coords.lng], { icon });
        
        // Add popup with business info
        const popupContent = `
            <div class="map-popup">
                ${business.primaryImage ? `<img src="${business.primaryImage}" alt="${business.name}">` : ''}
                <h4>${business.name}</h4>
                <p>${business.category || business.type}</p>
                ${business.distance ? `<p class="distance">📍 ${this.formatDistance(business.distance)}</p>` : ''}
                <button class="popup-details-btn" data-business-id="${business.id}">View Details</button>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Handle marker click
        marker.on('click', () => {
            this.showBusinessPanel(business);
        });

        // Add to cluster group
        this.markerCluster.addLayer(marker);
        this.markers.push(marker);
    }

    async getBusinessCoordinates(business) {
        // Check if coordinates already exist
        if (business.coordinates) {
            return business.coordinates;
        }

        // Check if we have latitude and longitude
        if (business.latitude && business.longitude) {
            return { lat: business.latitude, lng: business.longitude };
        }

        // Check geocode cache
        const cacheKey = business.address || business.name;
        if (this.geocodeCache.has(cacheKey)) {
            return this.geocodeCache.get(cacheKey);
        }

        // For Hoi An businesses, use approximate coordinates based on area
        // This is a simplified approach - in production, you'd want proper geocoding
        const coords = this.getApproximateCoordinates(business);
        
        // Cache the result
        this.geocodeCache.set(cacheKey, coords);
        
        return coords;
    }

    getApproximateCoordinates(business) {
        // Generate random coordinates within Hoi An area for demo
        // In production, implement proper geocoding service
        const latVariation = (Math.random() - 0.5) * 0.04;
        const lngVariation = (Math.random() - 0.5) * 0.04;
        
        return {
            lat: this.defaultCenter.lat + latVariation,
            lng: this.defaultCenter.lng + lngVariation
        };
    }

    calculateDistance(point1, point2) {
        // Haversine formula for distance calculation
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

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    formatDistance(km) {
        if (km < 1) {
            return `${Math.round(km * 1000)}m away`;
        }
        return `${km.toFixed(1)}km away`;
    }

    handleCategoryFilter(button) {
        // Update active state
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Update category and reload businesses
        this.selectedCategory = button.dataset.category;
        this.loadBusinesses();
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === this.selectedCategory);
        });
    }

    updateFilterCounts() {
        const counts = {
            all: this.businesses.length,
            restaurant: this.businesses.filter(b => b.type === 'restaurant').length,
            activity: this.businesses.filter(b => b.type === 'activity').length
        };

        document.querySelectorAll('.filter-btn').forEach(btn => {
            const category = btn.dataset.category;
            const countSpan = btn.querySelector('.filter-count');
            if (countSpan) {
                countSpan.textContent = counts[category] || 0;
            }
        });
    }

    showBusinessPanel(business) {
        this.selectedBusiness = business;
        const panel = document.querySelector('.map-business-panel');
        
        // Populate panel with business data
        panel.querySelector('.panel-image').src = business.primaryImage || '/images/placeholder.jpg';
        panel.querySelector('.panel-name').textContent = business.name;
        panel.querySelector('.panel-category').textContent = business.category || business.type;
        panel.querySelector('.panel-address').textContent = business.address || 'Hoi An, Vietnam';
        
        if (business.distance) {
            panel.querySelector('.panel-distance').textContent = this.formatDistance(business.distance);
            panel.querySelector('.panel-distance').style.display = 'block';
        } else {
            panel.querySelector('.panel-distance').style.display = 'none';
        }
        
        // Show panel with animation
        panel.classList.remove('hidden');
        setTimeout(() => {
            panel.classList.add('active');
        }, 10);
    }

    closeBusinessPanel() {
        const panel = document.querySelector('.map-business-panel');
        panel.classList.remove('active');
        setTimeout(() => {
            panel.classList.add('hidden');
        }, 300);
        this.selectedBusiness = null;
    }

    centerOnUserLocation() {
        if (this.userLocation && this.map) {
            this.map.setView([this.userLocation.lat, this.userLocation.lng], 16);
            
            // Flash the user location marker
            if (this.userLocationMarker) {
                this.userLocationMarker.openPopup();
                setTimeout(() => {
                    this.userLocationMarker.closePopup();
                }, 2000);
            }
        } else {
            this.requestUserLocation();
        }
    }

    openDirections(coords) {
        if (!coords) return;
        
        const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
        window.open(url, '_blank');
    }

    viewBusinessProfile(business) {
        // Close map and trigger business profile view
        this.hideMap();
        
        // Use existing business profile viewer
        if (window.BusinessManager && window.BusinessManager.viewBusinessDetails) {
            window.BusinessManager.viewBusinessDetails(business.id);
        }
    }

    clearMarkers() {
        if (this.markerCluster) {
            this.markerCluster.clearLayers();
        }
        this.markers = [];
    }

    showError(message) {
        // Create error toast notification
        const toast = document.createElement('div');
        toast.className = 'map-error-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Clean up method
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.isMapInitialized = false;
        this.markers = [];
        this.markerCluster = null;
        this.userLocationMarker = null;
    }
}

// Export as singleton
const mapManager = new MapManager();
export default mapManager;
