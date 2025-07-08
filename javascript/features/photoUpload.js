// javascript/features/photoUpload.js

import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

import {
    doc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

/**
 * Photo Upload Manager
 * Handles photo uploads to Firebase Storage for user and business profiles
 */
export class PhotoUploadManager {
    constructor(firebaseServices, appState) {
        this.auth = firebaseServices.auth;
        this.db = firebaseServices.db;
        this.storage = firebaseServices.storage;
        this.state = appState;
        
        // References to other managers (set later)
        this.navigationManager = null;
        this.profileManager = null;
        
        // Upload configuration
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        
        // Track active uploads
        this.activeUploads = new Map();
    }
    
    /**
     * Set references to other managers
     */
    setManagers(managers) {
        this.navigationManager = managers.navigation;
        this.profileManager = managers.profile;
    }
    
    /**
     * Initialize photo upload system
     */
    async init() {
        console.log('📷 Initializing photo upload manager...');
        
        // Set up hidden file inputs if they don't exist
        this.setupFileInputs();
    }
    
    /**
     * Set up hidden file inputs
     */
    setupFileInputs() {
        // Check if inputs already exist
        if (!document.getElementById('photoUpload')) {
            const photoInput = document.createElement('input');
            photoInput.type = 'file';
            photoInput.id = 'photoUpload';
            photoInput.accept = 'image/*';
            photoInput.style.display = 'none';
            photoInput.onchange = (e) => this.handlePhotoUpload(e);
            document.body.appendChild(photoInput);
        }
        
        if (!document.getElementById('businessPhotoUpload')) {
            const businessInput = document.createElement('input');
            businessInput.type = 'file';
            businessInput.id = 'businessPhotoUpload';
            businessInput.accept = 'image/*';
            businessInput.style.display = 'none';
            businessInput.onchange = (e) => this.handleBusinessPhotoUpload(e);
            document.body.appendChild(businessInput);
        }
    }
    
    /**
     * Trigger photo upload for user profile
     */
    triggerPhotoUpload(slotIndex = null) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            alert('Please login to upload photos');
            return;
        }
        
        console.log(`📷 Triggering photo upload for slot ${slotIndex}`);
        this.state.set('currentUploadSlot', slotIndex);
        
        const fileInput = document.getElementById('photoUpload');
        if (fileInput) {
            fileInput.click();
        }
    }
    
    /**
     * Trigger photo upload for business profile
     */
    triggerBusinessPhotoUpload(slotIndex = null) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            alert('Please login to upload photos');
            return;
        }
        
        console.log(`📷 Triggering business photo upload for slot ${slotIndex}`);
        this.state.set('currentBusinessUploadSlot', slotIndex);
        
        const fileInput = document.getElementById('businessPhotoUpload');
        if (fileInput) {
            fileInput.click();
        }
    }
    
    /**
     * Handle photo upload for user profile
     */
    async handlePhotoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Reset input
        event.target.value = '';
        
        const slotIndex = this.state.get('currentUploadSlot');
        await this.uploadPhoto(file, 'user', slotIndex);
    }
    
    /**
     * Handle photo upload for business profile
     */
    async handleBusinessPhotoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Reset input
        event.target.value = '';
        
        const slotIndex = this.state.get('currentBusinessUploadSlot');
        await this.uploadPhoto(file, 'business', slotIndex);
    }
    
    /**
     * Upload photo to Firebase Storage
     */
    async uploadPhoto(file, profileType, slotIndex) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) {
            alert('Please login to upload photos');
            return;
        }
        
        // Validate file
        const validation = this.validateFile(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }
        
        try {
            console.log(`📤 Uploading ${profileType} photo...`);
            
            // Show loading state
            this.showUploadProgress(profileType, slotIndex, 0);
            
            // Generate unique filename
            const timestamp = Date.now();
            const filename = `${profileType}s/${currentUser.uid}/${timestamp}_${file.name}`;
            
            // Create storage reference
            const storageRef = ref(this.storage, filename);
            
            // Start upload
            const uploadTask = uploadBytesResumable(storageRef, file);
            
            // Track upload for potential cancellation
            const uploadId = `${profileType}_${slotIndex}`;
            this.activeUploads.set(uploadId, uploadTask);
            
            // Monitor upload progress
            uploadTask.on('state_changed',
                // Progress callback
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    this.showUploadProgress(profileType, slotIndex, progress);
                },
                // Error callback
                (error) => {
                    console.error('❌ Upload error:', error);
                    this.handleUploadError(profileType, slotIndex, error);
                    this.activeUploads.delete(uploadId);
                },
                // Success callback
                async () => {
                    console.log('✅ Upload completed');
                    
                    // Get download URL
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // Update profile with new photo
                    await this.updateProfilePhoto(profileType, slotIndex, downloadURL);
                    
                    // Clean up
                    this.activeUploads.delete(uploadId);
                    this.hideUploadProgress(profileType, slotIndex);
                    
                    // Update UI
                    this.updatePhotoSlotUI(profileType, slotIndex, downloadURL);
                }
            );
            
        } catch (error) {
            console.error('❌ Upload failed:', error);
            alert('Failed to upload photo. Please try again.');
            this.hideUploadProgress(profileType, slotIndex);
        }
    }
    
    /**
     * Validate file before upload
     */
    validateFile(file) {
        // Check file size
        if (file.size > this.maxFileSize) {
            return {
                valid: false,
                error: 'Photo must be less than 5MB'
            };
        }
        
        // Check file type
        if (!this.allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: 'Please upload a valid image file (JPEG, PNG, or WebP)'
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Update profile with new photo URL
     */
    async updateProfilePhoto(profileType, slotIndex, photoURL) {
        const currentUser = this.state.get('currentUser');
        if (!currentUser) return;
        
        try {
            if (profileType === 'user') {
                // Update user profile photos
                const profile = this.state.get('userProfile');
                if (!profile.photos) profile.photos = [];
                
                // Ensure array has enough slots
                while (profile.photos.length <= slotIndex) {
                    profile.photos.push(null);
                }
                
                // Delete old photo from storage if exists
                if (profile.photos[slotIndex]) {
                    await this.deleteOldPhoto(profile.photos[slotIndex]);
                }
                
                // Update photo URL
                profile.photos[slotIndex] = photoURL;
                
                // Save to Firebase
                await updateDoc(doc(this.db, 'users', currentUser.uid), {
                    photos: profile.photos,
                    updatedAt: serverTimestamp()
                });
                
                // Update local state
                this.state.set('userProfile', profile);
                
            } else if (profileType === 'business') {
                // Update business profile photos
                const profile = this.state.get('businessProfile');
                if (!profile.photos) profile.photos = [];
                
                // Ensure array has enough slots
                while (profile.photos.length <= slotIndex) {
                    profile.photos.push(null);
                }
                
                // Delete old photo from storage if exists
                if (profile.photos[slotIndex]) {
                    await this.deleteOldPhoto(profile.photos[slotIndex]);
                }
                
                // Update photo URL
                profile.photos[slotIndex] = photoURL;
                
                // Save to Firebase
                await updateDoc(doc(this.db, 'businesses', currentUser.uid), {
                    photos: profile.photos,
                    updatedAt: serverTimestamp()
                });
                
                // Update local state
                this.state.set('businessProfile', profile);
            }
            
            console.log(`✅ ${profileType} profile photo updated`);
            
        } catch (error) {
            console.error('❌ Error updating profile photo:', error);
            throw error;
        }
    }
    
    /**
     * Delete old photo from storage
     */
    async deleteOldPhoto(photoURL) {
        try {
            // Extract path from URL
            const url = new URL(photoURL);
            const path = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
            
            // Create reference and delete
            const photoRef = ref(this.storage, path);
            await deleteObject(photoRef);
            
            console.log('🗑️ Old photo deleted');
        } catch (error) {
            console.error('Error deleting old photo:', error);
            // Non-critical error, continue
        }
    }
    
    /**
     * Show upload progress
     */
    showUploadProgress(profileType, slotIndex, progress) {
        const gridId = profileType === 'user' ? 'photoGrid' : 'businessPhotoGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        
        const slots = grid.querySelectorAll('.photo-slot');
        const slot = slots[slotIndex];
        if (!slot) return;
        
        // Add uploading class
        slot.classList.add('uploading');
        
        // Update or create progress bar
        let progressContainer = slot.querySelector('.upload-progress');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.className = 'upload-progress';
            progressContainer.innerHTML = '<div class="upload-progress-bar"></div>';
            slot.appendChild(progressContainer);
        }
        
        const progressBar = progressContainer.querySelector('.upload-progress-bar');
        progressBar.style.width = `${progress}%`;
    }
    
    /**
     * Hide upload progress
     */
    hideUploadProgress(profileType, slotIndex) {
        const gridId = profileType === 'user' ? 'photoGrid' : 'businessPhotoGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        
        const slots = grid.querySelectorAll('.photo-slot');
        const slot = slots[slotIndex];
        if (!slot) return;
        
        // Remove uploading class
        slot.classList.remove('uploading');
        
        // Remove progress bar
        const progressContainer = slot.querySelector('.upload-progress');
        if (progressContainer) {
            progressContainer.remove();
        }
    }
    
    /**
     * Update photo slot UI
     */
    updatePhotoSlotUI(profileType, slotIndex, photoURL) {
        const gridId = profileType === 'user' ? 'photoGrid' : 'businessPhotoGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        
        const slots = grid.querySelectorAll('.photo-slot');
        const slot = slots[slotIndex];
        if (!slot) return;
        
        // Update slot appearance
        slot.style.backgroundImage = `url('${photoURL}')`;
        slot.classList.add('filled');
        
        // Add star icon for first photo
        if (slotIndex === 0) {
            slot.innerHTML = '<div class="star-icon">⭐</div>';
        } else {
            slot.innerHTML = '';
        }
    }
    
    /**
     * Handle upload error
     */
    handleUploadError(profileType, slotIndex, error) {
        console.error('Upload error:', error);
        
        // Hide progress
        this.hideUploadProgress(profileType, slotIndex);
        
        // Show user-friendly error
        let errorMessage = 'Failed to upload photo. Please try again.';
        
        if (error.code === 'storage/unauthorized') {
            errorMessage = 'You do not have permission to upload photos.';
        } else if (error.code === 'storage/canceled') {
            errorMessage = 'Upload was cancelled.';
        } else if (error.code === 'storage/quota-exceeded') {
            errorMessage = 'Storage quota exceeded. Please contact support.';
        }
        
        alert(errorMessage);
    }
    
    /**
     * Cancel active upload
     */
    cancelUpload(profileType, slotIndex) {
        const uploadId = `${profileType}_${slotIndex}`;
        const uploadTask = this.activeUploads.get(uploadId);
        
        if (uploadTask) {
            uploadTask.cancel();
            this.activeUploads.delete(uploadId);
            console.log('❌ Upload cancelled');
        }
    }
    
    /**
     * Resize image before upload (optional optimization)
     */
    async resizeImage(file, maxWidth = 1200, maxHeight = 1200) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }
                    
                    // Set canvas dimensions
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw and compress image
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            }));
                        } else {
                            reject(new Error('Failed to resize image'));
                        }
                    }, 'image/jpeg', 0.9);
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
}
