// javascript/utils/helpers.js
export const Helpers = {
    // Shuffle array for variety
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },
    
    // Calculate age from birthday
    calculateAge(birthday) {
        if (!birthday) return 25; // Default age
        const birthDate = new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    },
    
    // Get relative time string
    getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'now';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        return date.toLocaleDateString();
    },
    
    // Generate temp password
    generateTempPassword() {
        return Math.random().toString(36).slice(-8);
    },
    
    // Generate referral code
    generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    },
    
    // Merge users without duplicates
    mergeUsersWithoutDuplicates(realUsers, demoUsers) {
        const realUserNames = new Set(realUsers.map(u => u.name.toLowerCase()));
        const uniqueDemoUsers = demoUsers.filter(
            demo => !realUserNames.has(demo.name.toLowerCase())
        );
        return [...realUsers, ...uniqueDemoUsers];
    }
};

// Make globally available for migration
window.Helpers = Helpers;
