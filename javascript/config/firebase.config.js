// javascript/config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

/**
 * Firebase configuration and initialization module
 */
export class FirebaseConfig {
    constructor() {
        this.config = {
            apiKey: "AIzaSyB-zTm6JB4EkD_7Q9056K4UGbIPyHQL4S4",
            authDomain: "hoi-an-social-app.firebaseapp.com",
            databaseURL: "https://hoi-an-social-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "hoi-an-social-app",
            storageBucket: "hoi-an-social-app.firebasestorage.app",
            messagingSenderId: "302219568692",
            appId: "1:302219568692:web:3edf7128342b74b1e0cc61",
            measurementId: "G-WX23VDV53B"
        };
        
        this.app = null;
        this.services = {
            auth: null,
            db: null,
            storage: null,
            googleProvider: null
        };
    }
    
    /**
     * Initialize Firebase and all services
     * @returns {Object} Object containing all Firebase services
     */
    async initialize() {
        try {
            console.log('🔥 Initializing Firebase with modular SDK...');
            
            // Dynamically import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
            const { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged, updateProfile } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');
            const { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, serverTimestamp, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
            const { getStorage } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js');
            
            // Initialize Firebase app
            this.app = initializeApp(this.config);
            
            // Initialize services
            this.services.auth = getAuth(this.app);
            this.services.db = getFirestore(this.app);
            this.services.storage = getStorage(this.app);
            this.services.googleProvider = new GoogleAuthProvider();
            
            // Create compatibility layer for older Firebase code
            window.firebase = {
                auth: () => this.services.auth,
                firestore: () => this.services.db,
                storage: () => this.services.storage,
                firestore: {
                    FieldValue: {
                        serverTimestamp: () => serverTimestamp()
                    }
                }
            };
            
            // Also expose services directly for compatibility
            window.auth = this.services.auth;
            window.db = this.services.db;
            window.storage = this.services.storage;
            
            console.log('🔥 Firebase initialized successfully with modular SDK');
            console.log('📦 Services available:', {
                auth: !!this.services.auth,
                db: !!this.services.db,
                storage: !!this.services.storage,
                googleProvider: !!this.services.googleProvider
            });
            
            return this.services;
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
            console.error('Error details:', error.message);
            throw error;
        }
    }
    
    /**
     * Get Firebase services
     * @returns {Object} Firebase services object
     */
    getServices() {
        if (!this.services.auth) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.services;
    }
    
    /**
     * Check if Firebase is ready
     * @returns {Boolean} True if Firebase is initialized
     */
    isReady() {
        return !!(this.services.auth && this.services.db && this.services.storage);
    }
}
