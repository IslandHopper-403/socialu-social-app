// javascript/features/profile.js

/**
 * Profile Module Entry Point
 * 
 * REFACTORED (Week 3 Section 3.7):
 * This file now serves as a thin wrapper that re-exports ProfileManager
 * 
 * NEW STRUCTURE:
 * - profiles/profileManager.js - Orchestrator (user profiles)
 * - profiles/userProfile.js - User profile logic
 * - business/businessProfile.js - Business profile logic (separate)
 * 
 * BACKWARD COMPATIBILITY:
 * main.js can still import ProfileManager from this file
 */

export { ProfileManager } from './profiles/profileManager.js';
