// Add at the top of the file after imports
let isFirstLoad = true;
let seenMatches = new Set();

// Initialize seenMatches from localStorage
function initializeSeenMatches() {
    try {
        const stored = localStorage.getItem('seenMatches');
        if (stored) {
            seenMatches = new Set(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Error loading seen matches:', error);
        seenMatches = new Set();
    }
}

// Save seenMatches to localStorage
function saveSeenMatches() {
    try {
        localStorage.setItem('seenMatches', JSON.stringify([...seenMatches]));
    } catch (error) {
        console.error('Error saving seen matches:', error);
    }
}

// Modify the setupMatchListener function
function setupMatchListener() {
    if (!currentUser) return;
    
    // Initialize on first setup
    initializeSeenMatches();
    
    // Clean up existing listener
    if (matchListenerUnsubscribe) {
        matchListenerUnsubscribe();
    }
    
    const matchesRef = collection(db, 'matches');
    const q = query(
        matchesRef,
        where('users', 'array-contains', currentUser.uid),
        orderBy('timestamp', 'desc')
    );
    
    matchListenerUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const matchData = change.doc.data();
                const matchId = change.doc.id;
                
                // Skip if this is the first load (initial data)
                if (isFirstLoad) {
                    seenMatches.add(matchId);
                    return;
                }
                
                // Skip if we've already shown this match
                if (seenMatches.has(matchId)) {
                    return;
                }
                
                // Check if match is recent (within last 30 seconds)
                const matchTime = matchData.timestamp?.toDate?.() || new Date(matchData.timestamp);
                const timeDiff = Date.now() - matchTime.getTime();
                
                if (timeDiff > 30000) { // 30 seconds
                    // Old match, just mark as seen
                    seenMatches.add(matchId);
                    saveSeenMatches();
                    return;
                }
                
                // This is a new, recent match - show popup
                try {
                    const otherUserId = matchData.users.find(id => id !== currentUser.uid);
                    if (otherUserId) {
                        // Sanitize any display data
                        const cleanName = DOMPurify.sanitize(matchData.otherUserName || 'Someone');
                        showMatchPopup(matchId, otherUserId, cleanName);
                        
                        // Mark as seen
                        seenMatches.add(matchId);
                        saveSeenMatches();
                    }
                } catch (error) {
                    console.error('Error showing match popup:', error);
                }
            }
        });
        
        // After processing initial snapshot, set firstLoad to false
        if (isFirstLoad) {
            isFirstLoad = false;
        }
    }, (error) => {
        console.error('Match listener error:', error);
    });
}

// Modify showMatchPopup to use sanitized data
function showMatchPopup(matchId, otherUserId, userName) {
    const popup = document.createElement('div');
    popup.className = 'match-popup';
    popup.innerHTML = `
        <div class="match-popup-content">
            <h3>It's a Match! 🎉</h3>
            <p></p>
            <button class="btn-primary" onclick="openChat('${matchId}', '${otherUserId}')">Send Message</button>
            <button class="btn-secondary" onclick="this.closest('.match-popup').remove()">Later</button>
        </div>
    `;
    
    // Use textContent for user-provided data
    popup.querySelector('p').textContent = `You and ${userName} liked each other!`;
    
    document.body.appendChild(popup);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        popup.remove();
    }, 5000);
}

// Clean up on logout
function cleanupMatchListener() {
    if (matchListenerUnsubscribe) {
        matchListenerUnsubscribe();
        matchListenerUnsubscribe = null;
    }
    isFirstLoad = true; // Reset for next login
    seenMatches.clear();
}
