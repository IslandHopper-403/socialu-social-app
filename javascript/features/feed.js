// 👥 User Feed Management
    async populateUserFeed() {
        if (!this.state.isAuthenticated) return;
        
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            // Fetch real users from Firebase, excluding current user
            const snapshot = await window.db.collection('users')
                .where('uid', '!=', this.state.currentUser.uid)
                .orderBy('uid')
                .orderBy('updatedAt', 'desc')
                .limit(20)
                .get();
            
            const users = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                // Only include users with complete profiles
                if (userData.name && userData.bio && userData.interests && userData.interests.length > 0) {
                    users.push({
                        id: doc.id,
                        uid: userData.uid,
                        name: userData.name,
                        age: userData.age || 25,
                        image: userData.photos?.[0] || userData.photo || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop',
                        interests: userData.interests || ['Travel', 'Adventure'],
                        bio: userData.bio || 'Exploring Hoi An!',
                        isOnline: userData.isOnline || false,
                        distance: userData.distance || `${Math.floor(Math.random() * 5) + 1} km`,
                        matchPercentage: userData.matchPercentage || Math.floor(Math.random() * 30) + 70,
                        category: userData.category || 'all',
                        career: userData.career,
                        lookingFor: userData.lookingFor
                    });
                }
            });
            
            // Show user count
            const userCount = users.length;
            console.log(`👥 Found ${userCount} users in feed`);
            
            // If we have real users, display them
            if (users.length > 0) {
                container.innerHTML = '';
                users.forEach((user, index) => {
                    const feedItem = this.createUserFeedItem(user, index);
                    container.appendChild(feedItem);
                });
                
                // Add activity indicator
                const activityIndicator = document.createElement('div');
                activityIndicator.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: rgba(0,212,255,0.1); margin: 20px 0; border-radius: 15px;">
                        <h3>🔥 ${userCount} travelers active in Hoi An</h3>
                        <p>Join the community and start connecting!</p>
                    </div>
                `;
                container.appendChild(activityIndicator);
                
            } else {
                // Add demo users if no real users yet
                const demoUsers = this.data.users.map(user => ({
                    ...user,
                    uid: `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`,
                    id: `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`
                }));
                
                container.innerHTML = '';
                demoUsers.forEach((user, index) => {
                    const feedItem = this.createUserFeedItem(user, index);
                    container.appendChild(feedItem);
                });
                
                // Show encouraging message for first users
                const encourageMessage = document.createElement('div');
                encourageMessage.innerHTML = `
                    <div style="text-align: center; padding: 40px; opacity: 0.9;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
                        <div style="font-size: 20px; margin-bottom: 15px; color: #00D4FF;">You're among the first!</div>
                        <div style="font-size: 16px; margin-bottom: 10px;">These are demo profiles. Complete your profile and invite friends to start real connections!</div>
                        <button onclick="CLASSIFIED.shareApp()" style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #00D4FF, #0099CC); border: none; border-radius: 25px; color: white; font-weight: 600; cursor: pointer;">
                            Share CLASSIFIED 🚀
                        </button>
                    </div>
                `;
                container.appendChild(encourageMessage);
            }
            
        } catch (error) {
            console.error('❌ Error loading users:', error);
            // Show error message
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.7;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 18px; margin-bottom: 10px;">Unable to load users</div>
                    <div style="font-size: 14px;">Please check your internet connection and try again.</div>
                    <button onclick="CLASSIFIED.populateUserFeed()" style="margin-top: 20px; padding: 12px 24px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 25px; color: white; cursor: pointer;">
                        Try Again
                    </button>
                </div>
            `;
        }
    },
    
    filterUsers(filter) {
        console.log(`🔍 Filtering users by: ${filter}`);
        // Update active filter chip
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Filter users based on criteria
        let filteredUsers = this.data.users;
        if (filter === 'online') {
            filteredUsers = this.data.users.filter(user => user.isOnline);
        } else if (filter === 'nearby') {
            filteredUsers = this.data.users.filter(user => {
                const distance = parseFloat(user.distance);
                return distance < 2; // Within 2km
            });
        } else if (filter === 'nomads') {
            filteredUsers = this.data.users.filter(user => user.category === 'nomads');
        }
        
        // Re-populate feed with filtered users
        const container = document.getElementById('userFeedContainer');
        container.innerHTML = '';
        filteredUsers.forEach((user, index) => {
            const feedItem = this.createUserFeedItem(user, index);
            container.appendChild(feedItem);
        });
    },
    
    createUserFeedItem(user, index) {
        const feedItem = document.createElement('div');
        feedItem.className = 'user-feed-item';
        feedItem.style.animationDelay = `${index * 0.1}s`;
        feedItem.style.cursor = 'pointer';
        
        // Make sure user has an ID
        const userId = user.uid || user.id || `demo_${user.name.toLowerCase().replace(/\s/g, '_')}`;
        user.uid = userId;
        
        // Make the entire card clickable to view profile
        feedItem.addEventListener('click', (e) => {
            // Don't open profile if clicking on action buttons
            if (!e.target.closest('.user-actions')) {
                this.openUserProfile(user);
            }
        });
        
        feedItem.innerHTML = `
            <div class="user-status-badges">
                ${user.isOnline ? '<div class="status-badge status-online">🟢 Online</div>' : ''}
                <div class="status-badge status-distance">📍 ${user.distance}</div>
                <div class="status-badge status-match">🔥 ${user.matchPercentage}% Match</div>
            </div>
            <div class="user-image" style="background-image: url('${user.image}')">
                <div class="user-image-overlay">
                    <div class="user-name">${user.name}, ${user.age}</div>
                </div>
            </div>
            <div class="user-info">
                <div class="user-bio">${user.bio}</div>
                <div class="user-interests">
                    ${user.interests.map(interest => `<span class="interest-tag">${interest}</span>`).join('')}
                </div>
                <div class="user-actions">
                    <button class="action-btn pass-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('pass', '${userId}')">✕ Pass</button>
                    <button class="action-btn chat-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('like', '${userId}')">💬 Chat</button>
                    <button class="action-btn super-btn" onclick="event.stopPropagation(); CLASSIFIED.handleUserAction('superlike', '${userId}')">⭐ Super</button>
                </div>
            </div>
        `;
        return feedItem;
    },
