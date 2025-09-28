// javascript/utils/validation.js

import { sanitizeText } from './security.js';

/**
 * User Profile Validation Module
 * Provides comprehensive validation for user profiles
 */

export class ProfileValidator {
    constructor() {
        // Validation rules
        this.rules = {
            name: {
                required: true,
                minLength: 2,
                maxLength: 50,
                pattern: /^[a-zA-Z\s'-]+$/,
                message: 'Name must be 2-50 characters (letters only)'
            },
            bio: {
                required: true,
                minLength: 20,
                maxLength: 500,
                message: 'Bio must be 20-500 characters'
            },
            birthday: {
                required: true,
                minAge: 18,
                maxAge: 100,
                message: 'You must be 18+ years old'
            },
            interests: {
                required: true,
                minCount: 3,
                maxCount: 8,
                message: 'Select 3-8 interests'
            },
            photos: {
                required: true,
                minCount: 1,
                maxCount: 4,
                message: 'Add at least 1 photo (max 4)'
            },
            height: {
                required: false,
                pattern: /^(\d{1,3}cm|\d'(\d{1,2})?")$/,
                message: 'Format: 170cm or 5\'7"'
            },
            career: {
                required: true,
                message: 'Please select your career'
            },
            lookingFor: {
                required: true,
                message: 'Please select what you\'re looking for'
            }
        };
        
        this.errors = {};
    }
    
    /**
     * Validate complete profile
     */
    validateProfile(profileData) {
        this.errors = {};
        let isValid = true;
        
        // Validate name
        if (!this.validateName(profileData.name)) {
            isValid = false;
        }
        
        // Validate bio
        if (!this.validateBio(profileData.bio)) {
            isValid = false;
        }
        
        // Validate birthday/age
        if (!this.validateAge(profileData.birthday)) {
            isValid = false;
        }
        
        // Validate interests
        if (!this.validateInterests(profileData.interests)) {
            isValid = false;
        }
        
        // Validate photos
        if (!this.validatePhotos(profileData.photos)) {
            isValid = false;
        }
        
        // Validate height (optional)
        if (profileData.height && !this.validateHeight(profileData.height)) {
            isValid = false;
        }
        
        // Validate career
        if (!this.validateCareer(profileData.career)) {
            isValid = false;
        }
        
        // Validate lookingFor
        if (!this.validateLookingFor(profileData.lookingFor)) {
            isValid = false;
        }
        
        return {
            isValid,
            errors: this.errors,
            sanitizedData: isValid ? this.sanitizeProfileData(profileData) : null
        };
    }
    
    /**
     * Individual field validators
     */
    validateName(name) {
        const rule = this.rules.name;
        
        if (!name || name.trim().length === 0) {
            this.errors.name = 'Name is required';
            return false;
        }
        
        const trimmed = name.trim();
        
        if (trimmed.length < rule.minLength || trimmed.length > rule.maxLength) {
            this.errors.name = rule.message;
            return false;
        }
        
        if (!rule.pattern.test(trimmed)) {
            this.errors.name = rule.message;
            return false;
        }
        
        return true;
    }
    
    validateBio(bio) {
        const rule = this.rules.bio;
        
        if (!bio || bio.trim().length === 0) {
            this.errors.bio = 'Bio is required';
            return false;
        }
        
        const trimmed = bio.trim();
        
        if (trimmed.length < rule.minLength || trimmed.length > rule.maxLength) {
            this.errors.bio = rule.message;
            return false;
        }
        
        return true;
    }
    
    validateAge(birthday) {
        const rule = this.rules.birthday;
        
        if (!birthday) {
            this.errors.birthday = 'Birthday is required';
            return false;
        }
        
        const birthDate = new Date(birthday);
        const today = new Date();
        const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
        
        if (isNaN(age)) {
            this.errors.birthday = 'Invalid date format';
            return false;
        }
        
        if (age < rule.minAge || age > rule.maxAge) {
            this.errors.birthday = rule.message;
            return false;
        }
        
        return true;
    }
    
    validateInterests(interests) {
        const rule = this.rules.interests;
        
        if (!interests || !Array.isArray(interests)) {
            this.errors.interests = rule.message;
            return false;
        }
        
        if (interests.length < rule.minCount || interests.length > rule.maxCount) {
            this.errors.interests = rule.message;
            return false;
        }
        
        return true;
    }
    
    validatePhotos(photos) {
        const rule = this.rules.photos;
        
        if (!photos || !Array.isArray(photos)) {
            this.errors.photos = rule.message;
            return false;
        }
        
        // Filter out null/undefined values
        const validPhotos = photos.filter(p => p);
        
        if (validPhotos.length < rule.minCount) {
            this.errors.photos = rule.message;
            return false;
        }
        
        return true;
    }
    
    validateHeight(height) {
        const rule = this.rules.height;
        
        if (height && !rule.pattern.test(height)) {
            this.errors.height = rule.message;
            return false;
        }
        
        return true;
    }
    
    validateCareer(career) {
        if (!career || career.trim().length === 0) {
            this.errors.career = this.rules.career.message;
            return false;
        }
        return true;
    }
    
    validateLookingFor(lookingFor) {
        if (!lookingFor || lookingFor.trim().length === 0) {
            this.errors.lookingFor = this.rules.lookingFor.message;
            return false;
        }
        return true;
    }
    
    /**
     * Sanitize all profile data
     */
    sanitizeProfileData(profileData) {
        return {
            ...profileData,
            name: sanitizeText(profileData.name).trim(),
            bio: sanitizeText(profileData.bio).trim(),
            height: profileData.height ? sanitizeText(profileData.height).trim() : '',
            career: sanitizeText(profileData.career),
            zodiac: profileData.zodiac ? sanitizeText(profileData.zodiac) : '',
            priority: profileData.priority ? sanitizeText(profileData.priority) : '',
            relationship: profileData.relationship ? sanitizeText(profileData.relationship) : '',
            lookingFor: sanitizeText(profileData.lookingFor),
            marriage: profileData.marriage ? sanitizeText(profileData.marriage) : '',
            interests: profileData.interests.map(i => sanitizeText(i))
        };
    }
    
    /**
     * Get error message for field
     */
    getError(fieldName) {
        return this.errors[fieldName] || null;
    }
    
    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors = {};
        this.clearErrorDisplay();
    }
    
    /**
     * Display error message inline
     */
    showFieldError(fieldName, message) {
        // Remove existing error
        this.clearFieldError(fieldName);
        
        // Find the field element
        let fieldElement = null;
        
        if (fieldName === 'name') {
            // Name is derived from display name, show error at top
            fieldElement = document.querySelector('.profile-editor');
        } else if (fieldName === 'interests') {
            fieldElement = document.querySelector('.interests-grid')?.parentElement;
        } else if (fieldName === 'photos') {
            fieldElement = document.querySelector('.photo-upload-section')?.parentElement;
        } else {
            fieldElement = document.getElementById(`profile${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`)?.parentElement;
        }
        
        if (fieldElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.style.cssText = `
                color: #FF6B6B;
                font-size: 12px;
                margin-top: 4px;
                padding: 4px 8px;
                background: rgba(255, 107, 107, 0.1);
                border-radius: 4px;
                border: 1px solid rgba(255, 107, 107, 0.2);
            `;
            errorDiv.textContent = message; // Safe: using textContent
            errorDiv.dataset.field = fieldName;
            
            if (fieldName === 'name') {
                // Insert at top for name
                fieldElement.insertBefore(errorDiv, fieldElement.firstChild);
            } else {
                fieldElement.appendChild(errorDiv);
            }
        }
    }
    
    /**
     * Clear specific field error
     */
    clearFieldError(fieldName) {
        const existingError = document.querySelector(`.field-error[data-field="${fieldName}"]`);
        if (existingError) {
            existingError.remove();
        }
    }
    
    /**
     * Clear all error displays
     */
    clearErrorDisplay() {
        document.querySelectorAll('.field-error').forEach(error => error.remove());
    }
    
    /**
     * Show all validation errors
     */
    showAllErrors() {
        this.clearErrorDisplay();
        Object.entries(this.errors).forEach(([field, message]) => {
            this.showFieldError(field, message);
        });
    }
}

/**
 * Create singleton instance
 */
export const profileValidator = new ProfileValidator();
