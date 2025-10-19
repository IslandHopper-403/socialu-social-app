// FILE: public/javascript/categoryPage.js

/**
 * Category Page Module
 * Handles geographic landing pages for SEO
 * Routes: /hue, /hue/coffee-shops, /hue/restaurants, etc.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

class CategoryPage {
    constructor() {
        this.location = 'hoi-an';
        this.category = null;
        this.businesses = [];
        this.allCategories = [];
        this.db = null;
        
        // Category slug to Firestore category mappings
        // Maps URL-friendly slugs to exact Firestore category field values
        this.categoryMappings = {
            // Food & Drink (matching your JSON data)
            'coffee-shops': 'Coffee Shop',
            'coffee-shop': 'Coffee Shop',
            'cafes': 'Cafe',
            'cafe': 'Cafe',
            'vietnamese-cuisine': 'Vietnamese Cuisine',
            'vietnamese': 'Vietnamese Cuisine',
            'vietnamese-fusion': 'Vietnamese & Fusion Cuisine',
            'fusion': 'Vietnamese & Fusion Cuisine',
            'restaurants': 'Vietnamese Cuisine',
            'restaurant': 'Vietnamese Cuisine',
            'western-cuisine': 'Western Cuisine',
            'western': 'Western Cuisine',
            'western-international': 'Western & International Cuisine',
            'international': 'Western & International Cuisine',
            'seafood': 'Seafood',
            'vegan': 'Vegan',
            'indian-cuisine': 'Indian Cuisine',
            'indian': 'Indian Cuisine',
            'korean-cuisine': 'Korean Cuisine',
            'korean': 'Korean Cuisine',
            'middle-eastern': 'Middle Eastern Cuisine',
            'middle-eastern-cuisine': 'Middle Eastern Cuisine',
            
            // Nightlife
            'bar': 'Bar',
            'bars': 'Bar',
            'pubs': 'Bars & Pubs',
            'pub': 'Bars & Pubs',
            'nightclub': 'Nightclub',
            'nightclubs': 'Nightclub',
            'live-music': 'Live Music Venue',
            'live-music-venue': 'Live Music Venue',
            'beach-club': 'Beach Club',
            'beach-clubs': 'Beach Club',
            'restaurant-bar': 'Restaurant Bar',
            'restaurant-bars': 'Restaurant Bar',
            
            // Activities
            'activity': 'Tours & Outdoor Activities',
            'activities': 'Tours & Outdoor Activities',
            'tour': 'Tours & Outdoor Activities',
            'tours': 'Tours & Outdoor Activities',
            'outdoor-activities': 'Tours & Outdoor Activities',
            'cooking-class': 'Cooking Classes & Workshops',
            'cooking-classes': 'Cooking Classes & Workshops',
            'workshop': 'Cooking Classes & Workshops',
            'workshops': 'Cooking Classes & Workshops',
            'wellness': 'Wellness & Relaxation',
            'wellness-relaxation': 'Wellness & Relaxation',
            'spa': 'Wellness & Relaxation',
            'yoga': 'Wellness & Relaxation',
            'entertainment': 'Entertainment & Culture',
            'entertainment-culture': 'Entertainment & Culture',
            'culture': 'Entertainment & Culture',
            'community': 'Community & Lifestyle',
            'community-lifestyle': 'Community & Lifestyle',
            'lifestyle': 'Community & Lifestyle',
            'coworking': 'Community & Lifestyle'
        };
        
        
        console.log('🏙️ [Category] CategoryPage instance created');
        this.init();
    }

    async init() {
        try {
            console.log('🏙️ [Category] Starting initialization');
            
            // Initialize Firebase
            await this.initializeFirebase();
            
            // Parse URL to get location and category
            this.parseURL();
            console.log('📍 [Category] Parsed URL - Location:', this.location, 'Category:', this.category);
            
            // Load data in parallel
            await Promise.all([
                this.loadBusinesses(),
                this.loadAllCategories()
            ]);
            
            // Update page content
            this.updateMetaTags();
            this.updateBreadcrumbs();
            this.updateHeader();
            this.renderBusinesses();
            this.renderCategoryList();
            
            // Show content, hide loading
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('categoryHeader').style.display = 'block';
            document.getElementById('businessGrid').style.display = 'grid';
            document.getElementById('categorySidebar').style.display = 'block';
            
            console.log('✅ [Category] Page fully loaded and rendered');
            
        } catch (error) {
            console.error('❌ [Category] Initialization error:', error);
            console.error('❌ [Category] Error stack:', error.stack);
            this.showError(error.message);
        }
    }

    async initializeFirebase() {
        console.log('🔥 [Category] Initializing Firebase for category page');
        
        const firebaseConfig = {
            apiKey: "AIzaSyB-zTm6JB4EkD_7Q9056K4UGbIPyHQL4S4",
            authDomain: "hoi-an-social-app.firebaseapp.com",
            databaseURL: "https://hoi-an-social-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "hoi-an-social-app",
            storageBucket: "hoi-an-social-app.firebasestorage.app",
            messagingSenderId: "302219568692",
            appId: "1:302219568692:web:3edf7128342b74b1e0cc61",
            measurementId: "G-WX23VDV53B"
        };
        
        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        
        console.log('✅ [Category] Firebase initialized successfully');
    }

   parseURL() {
    console.log('🔍 [Category] Parsing URL:', window.location.pathname);
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    console.log('🔍 [Category] Path parts:', pathParts);
    
    // Default to 'hoi-an' for location
    this.location = 'hoi-an';
    
    if (pathParts.length >= 1 && pathParts[0] === 'hoi-an') {
        this.location = pathParts[0];
        console.log('📍 [Category] Location set to:', this.location);
    }
    
    if (pathParts.length >= 2) {
        this.category = pathParts[1];
        console.log('📂 [Category] Category set to:', this.category);
    }
}

    async loadBusinesses() {
        console.log('🔍 [Category] Loading businesses from Firestore...');
        console.log('🔍 [Category] Query params - Location:', this.location, 'Category:', this.category);
        
        try {
           // Base query: active businesses
            // Note: JSON shows status: "active", not "active"
            let q = query(
                collection(this.db, 'businesses'),
                where('status', '==', 'active'),
                where('isActive', '==', true)
            );
            
            console.log('🔍 [Category] Base query created (status=active, isActive=true)');
            
            // Add category filter if specified
            if (this.category) {
                const categoryName = this.formatCategoryName(this.category);
                console.log('🔍 [Category] Adding category filter:', categoryName);
                q = query(q, where('category', '==', categoryName));
            }
            
           // Skip orderBy until index is created
            console.log('⚠️ [Category] Skipping orderBy - will sort in JavaScript');
            
            // Execute query
            console.log('🔍 [Category] Executing Firestore query...');
            const snapshot = await getDocs(q);
            console.log('📊 [Category] Query returned', snapshot.size, 'documents');
            
            // Map documents to business objects
            this.businesses = snapshot.docs.map(doc => {
                const data = doc.data();
                // Normalize field names: 'name' -> 'businessName' for consistency
                const business = {
                    id: doc.id,
                    ...data,
                    businessName: data.businessName || data.name,  // Support both field names
                    slug: data.slug || this.generateSlug(data.name || data.businessName)
                };
                console.log('📄 [Category] Business found:', business.businessName, '- Category:', business.category);
                return business;
            });
            
            // Sort by rating if orderBy failed
            if (this.businesses.length > 0) {
                this.businesses.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                console.log('✅ [Category] Sorted', this.businesses.length, 'businesses by rating');
            }
            
            console.log('✅ [Category] Loaded', this.businesses.length, 'businesses');
            console.log('📋 [Category] Business names:', this.businesses.map(b => b.businessName));
            
        } catch (error) {
            console.error('❌ [Category] Error loading businesses:', error);
            console.error('❌ [Category] Error details:', error.message);
            throw error;
        }
    }

    async loadAllCategories() {
        console.log('📂 [Category] Loading all categories...');
        
        try {
           const q = query(
                collection(this.db, 'businesses'),
                where('status', '==', 'active'),
                where('isActive', '==', true)
            );
            
            const snapshot = await getDocs(q);
            console.log('📊 [Category] Found', snapshot.size, 'total businesses for category extraction');
            
            // Extract unique categories
            const categoriesSet = new Set();
            snapshot.docs.forEach(doc => {
                const category = doc.data().category;
                if (category) {
                    categoriesSet.add(category);
                    console.log('📂 [Category] Found category:', category);
                }
            });
            
            this.allCategories = Array.from(categoriesSet).sort();
            console.log('✅ [Category] Extracted', this.allCategories.length, 'unique categories:', this.allCategories);
            
        } catch (error) {
            console.error('❌ [Category] Error loading categories:', error);
            this.allCategories = [];
        }
    }

formatCategoryName(slug) {
        // Check if we have a specific mapping first (from constructor)
        if (this.categoryMappings[slug]) {
            const mapped = this.categoryMappings[slug];
            console.log('🔄 [Category] Mapped slug:', slug, '->', mapped);
            return mapped;
        }
        
        // Otherwise, capitalize each word for display
        const formatted = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        console.log('🔄 [Category] Formatted slug (no mapping):', slug, '->', formatted);
        return formatted;
    }

    formatCategorySlug(name) {
        // First, check if we have a reverse mapping (category name -> slug)
        // Build reverse mapping from this.categoryMappings
        const reverseMapping = Object.entries(this.categoryMappings).find(
            ([slug, categoryName]) => categoryName === name
        );
        
        if (reverseMapping) {
            const [slug, categoryName] = reverseMapping;
            console.log('🔄 [Category] Reverse mapped:', name, '->', slug);
            return slug;
        }
        
        // Otherwise, convert category name to slug format
        // "Coffee Shop" -> "coffee-shop" (lowercase, replace spaces with hyphens)
        const slug = name.toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, '')     // Remove special characters
            .replace(/--+/g, '-')           // Replace multiple hyphens with single
            .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
        
        console.log('🔄 [Category] Generated slug:', name, '->', slug);
        return slug;
    }

    generateSlug(name) {
        // Generate URL-friendly slug from business name
        if (!name) return 'business';
        return name.toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, '')     // Remove special characters
            .replace(/--+/g, '-')           // Replace multiple hyphens with single
            .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
    }

    updateMetaTags() {
        console.log('📄 [Category] Updating meta tags...');
        
        const categoryName = this.category ? this.formatCategoryName(this.category) : 'All Businesses';
        const locationName = 'Hội An';
        
        const title = `${categoryName} in ${locationName} - SocialU`;
        const description = `Discover the best ${categoryName.toLowerCase()} in ${locationName}, Vietnam. Connect with local businesses on SocialU.`;
        const url = `https://hoi-an-social-app.web.app/${this.location}${this.category ? '/' + this.category : ''}`;
        
        // Update page title
        document.getElementById('pageTitle').textContent = title;
        document.title = title;
        
        // Update meta tags
        document.getElementById('pageDescription').setAttribute('content', description);
        document.getElementById('pageKeywords').setAttribute('content', `${categoryName}, ${locationName}, Vietnam, local businesses, SocialU`);
        
        // Update Open Graph tags
        document.getElementById('ogUrl').setAttribute('content', url);
        document.getElementById('ogTitle').setAttribute('content', title);
        document.getElementById('ogDescription').setAttribute('content', description);
        
        // Update Twitter tags
        document.getElementById('twitterUrl').setAttribute('content', url);
        document.getElementById('twitterTitle').setAttribute('content', title);
        document.getElementById('twitterDescription').setAttribute('content', description);
        
        // Generate structured data (JSON-LD)
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": url,
            "about": {
                "@type": "Place",
                "name": locationName,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": locationName,
                    "addressCountry": "VN"
                }
            },
            "numberOfItems": this.businesses.length
        };
        
        document.getElementById('structuredData').textContent = JSON.stringify(structuredData);
        
        console.log('✅ [Category] Meta tags updated');
        console.log('📄 [Category] Title:', title);
        console.log('📄 [Category] URL:', url);
        console.log('📄 [Category] Businesses count:', this.businesses.length);
    }

   updateBreadcrumbs() {
    console.log('🍞 [Category] Updating breadcrumbs...');
    
    const locationName = 'Hội An';
    const categoryName = this.category ? this.formatCategoryName(this.category) : null;
    
    let html = '<a href="/">Home</a>';
    html += ` / <a href="/hoi-an">${locationName}</a>`;
    
    if (categoryName) {
        html += ` / <span>${categoryName}</span>`;
    }
    
    document.getElementById('breadcrumbs').innerHTML = html;
    console.log('✅ [Category] Breadcrumbs updated');
}

    updateHeader() {
        console.log('📋 [Category] Updating page header...');
        
        const categoryName = this.category ? this.formatCategoryName(this.category) : 'All Businesses';
        const locationName = 'Hội An';
        
        document.getElementById('categoryTitle').textContent = `${categoryName} in ${locationName}`;
        document.getElementById('categoryDescription').textContent = 
            `Explore ${this.businesses.length} local ${categoryName.toLowerCase()} on SocialU`;
        
        // Calculate average rating
        const avgRating = this.businesses.length > 0
            ? (this.businesses.reduce((sum, b) => sum + (b.rating || 0), 0) / this.businesses.length).toFixed(1)
            : '0.0';
        
        document.getElementById('categoryStats').innerHTML = `
            <span>${this.businesses.length} ${this.businesses.length === 1 ? 'business' : 'businesses'}</span> • 
            <span>⭐ ${avgRating} average rating</span>
        `;
        
        console.log('✅ [Category] Header updated');
        console.log('📊 [Category] Stats - Count:', this.businesses.length, 'Avg Rating:', avgRating);
    }

    renderBusinesses() {
        console.log('🎨 [Category] Rendering business cards...');
        
        const grid = document.getElementById('businessGrid');
        
        if (this.businesses.length === 0) {
            console.log('⚠️ [Category] No businesses to display');
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                    <h3 style="font-size: 1.5rem; margin-bottom: 1rem; color: #6b7280;">No businesses found</h3>
                    <p style="color: #9ca3af;">Be the first business in this category!</p>
                    <a href="/" style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px;">
                        Join SocialU
                    </a>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = this.businesses.map(business => {
            const photoUrl = business.photos?.[0] || business.logo || '/assets/default-business.jpg';
            const bio = business.bio || business.description || 'Local business in Hội An';
            const bioPreview = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;
            
            console.log('🎨 [Category] Rendering card for:', business.businessName);
            
            return `
                <a href="/business/${business.slug}" class="business-card">
                    <img src="${photoUrl}" 
                         alt="${business.businessName}"
                         loading="lazy"
                         onerror="this.src='/assets/default-business.jpg'">
                    <div class="business-info">
                        <h3>${business.businessName}</h3>
                        <p class="business-category">${business.category || 'Business'}</p>
                        <p class="business-bio">${bioPreview}</p>
                        <div class="business-meta">
                            <span>⭐ ${business.rating || '4.5'}</span>
                            <span>${business.priceRange || '$$'}</span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
        
        console.log('✅ [Category] Rendered', this.businesses.length, 'business cards');
    }

   renderCategoryList() {
    console.log('📂 [Category] Rendering category list...');
    
    const list = document.getElementById('categoryList');
    
    if (this.allCategories.length === 0) {
        console.log('⚠️ [Category] No categories to display');
        list.innerHTML = '<li style="color: #9ca3af;">No categories available</li>';
        return;
    }
    
    list.innerHTML = `
        <li>
            <a href="/hoi-an" ${!this.category ? 'style="font-weight: 600; background: #f3f4f6;"' : ''}>
                All Categories
            </a>
        </li>
    ` + this.allCategories.map(cat => {
        const slug = this.formatCategorySlug(cat);
        const isActive = this.category === slug;
        
        return `
            <li>
                <a href="/hoi-an/${slug}" ${isActive ? 'style="font-weight: 600; background: #f3f4f6;"' : ''}>
                    ${cat}
                </a>
            </li>
        `;
    }).join('');
    
    console.log('✅ [Category] Category list rendered with', this.allCategories.length, 'categories');
}

    showError(message) {
        console.error('💥 [Category] Displaying error to user:', message);
        
        document.getElementById('loadingState').innerHTML = `
            <div>
                <h3 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">Oops! Something went wrong</h3>
                <p style="color: #6b7280; margin-bottom: 1.5rem;">${message}</p>
                <a href="/" style="display: inline-block; padding: 0.75rem 1.5rem; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px;">
                    Go back home →
                </a>
            </div>
        `;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 [Category] DOM loaded, initializing CategoryPage');
    new CategoryPage();
});