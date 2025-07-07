    
    // Initialize messaging listeners
    initMessaging() {
        if (!this.state.currentUser) return;
        
        console.log('🔄 Initializing messaging system...');
        
        // Listen for new matches
        this.listenForMatches();
        
        // Listen for chat list updates
        this.listenForChats();
        
        // Mark messages as read when user opens app
        this.markMessagesAsRead();
    },
    
    // Create or get existing chat between two users
    async getOrCreateChat(otherUserId, otherUserName) {
        const currentUserId = this.state.currentUser.uid;
        
        // Create consistent chat ID (alphabetically sorted)
        const chatId = [currentUserId, otherUserId].sort().join('_');
        
        try {
            const chatRef = window.db.collection('chats').doc(chatId);
            const chatDoc = await chatRef.get();
            
            if (!chatDoc.exists) {
                // Create new chat
                await chatRef.set({
                    participants: [currentUserId, otherUserId],
                    participantNames: {
                        [currentUserId]: this.state.currentUser.displayName || this.state.userProfile.name,
                        [otherUserId]: otherUserName
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: null,
                    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ New chat created:', chatId);
            }
            
            return chatId;
        } catch (error) {
            console.error('❌ Error creating chat:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules as shown in the console.');
                console.error('Add these rules in Firebase Console > Firestore > Rules:', `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chats/{chatId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      allow write: if request.auth != null;
    }
  }
}`);
            }
            throw error;
        }
    },
    
    // Send a message
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const messageText = input.value.trim();
        
        if (!messageText || !this.state.currentChatUser) {
            console.log('❌ No message or recipient');
            return;
        }
        
        const currentUserId = this.state.currentUser.uid;
        const recipientId = this.state.currentChatUser.uid || this.state.currentChatUser.id;
        const chatId = [currentUserId, recipientId].sort().join('_');
        
        try {
            // Add message to messages collection
            const messageData = {
                chatId: chatId,
                senderId: currentUserId,
                senderName: this.state.currentUser.displayName || this.state.userProfile.name,
                recipientId: recipientId,
                text: messageText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };
            
            await window.db.collection('messages').add(messageData);
            console.log('✅ Message sent:', messageText);
            
            // Update chat's last message
            await window.db.collection('chats').doc(chatId).update({
                lastMessage: messageText,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                lastSenderId: currentUserId
            });
            
            // Clear input
            input.value = '';
            
            // Scroll to bottom
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules.');
            } else {
                alert('Failed to send message. Please try again.');
            }
        }
    },
    
    // Listen for messages in current chat
    listenForChatMessages(chatId) {
        console.log('👂 Listening for messages in chat:', chatId);
        
        // Clean up previous listener
        if (this.messageListener) {
            this.messageListener();
        }
        
        // Set up new listener
        this.messageListener = window.db.collection('messages')
            .where('chatId', '==', chatId)
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    messages.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.displayMessages(messages);
                
                // Mark messages as read
                this.markChatMessagesAsRead(chatId);
            }, (error) => {
                console.error('❌ Error listening for messages:', error);
            });
    },
    
    // Display messages in the chat UI
    displayMessages(messages) {
        const container = document.getElementById('chatMessages');
        const currentUserId = this.state.currentUser.uid;
        
        container.innerHTML = messages.map(msg => {
            const isSent = msg.senderId === currentUserId;
            const timeStr = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble">${msg.text}</div>
                    <div class="message-time" style="font-size: 11px; opacity: 0.6; margin-top: 4px; text-align: ${isSent ? 'right' : 'left'};">${timeStr}</div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },
    
    // Mark messages as read
    async markChatMessagesAsRead(chatId) {
        const currentUserId = this.state.currentUser.uid;
        
        try {
            const unreadMessages = await window.db.collection('messages')
                .where('chatId', '==', chatId)
                .where('recipientId', '==', currentUserId)
                .where('read', '==', false)
                .get();
            
            const batch = window.db.batch();
            unreadMessages.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            
            await batch.commit();
            console.log('✅ Marked messages as read');
        } catch (error) {
            console.error('❌ Error marking messages as read:', error);
        }
    },
    
    // Listen for chat list updates
    listenForChats() {
        const currentUserId = this.state.currentUser.uid;
        
        this.chatListListener = window.db.collection('chats')
            .where('participants', 'array-contains', currentUserId)
            .orderBy('lastMessageTime', 'desc')
            .onSnapshot(async (snapshot) => {
                const chats = [];
                
                for (const doc of snapshot.docs) {
                    const chatData = doc.data();
                    const otherUserId = chatData.participants.find(id => id !== currentUserId);
                    
                    // Get other user's data
                    const userDoc = await window.db.collection('users').doc(otherUserId).get();
                    const userData = userDoc.exists ? userDoc.data() : {};
                    
                    // Count unread messages
                    const unreadCount = await this.getUnreadCount(doc.id, currentUserId);
                    
                    chats.push({
                        id: doc.id,
                        ...chatData,
                        otherUserId: otherUserId,
                        otherUserName: userData.name || chatData.participantNames?.[otherUserId] || 'Unknown',
                        otherUserAvatar: userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100',
                        unreadCount: unreadCount
                    });
                }
                
                this.displayChatList(chats);
            });
    },
    
    // Get unread message count
    async getUnreadCount(chatId, userId) {
        const snapshot = await window.db.collection('messages')
            .where('chatId', '==', chatId)
            .where('recipientId', '==', userId)
            .where('read', '==', false)
            .get();
        
        return snapshot.size;
    },
    
    // Display chat list
    displayChatList(chats) {
        const container = document.getElementById('chatList');
        
        if (chats.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; opacity: 0.6;">
                    <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
                    <div>No conversations yet</div>
                    <div style="font-size: 14px; margin-top: 5px;">Like someone to start chatting!</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = chats.map(chat => {
            const timeStr = chat.lastMessageTime ? this.getRelativeTime(chat.lastMessageTime.toDate()) : '';
            const isUnread = chat.unreadCount > 0;
            
            return `
                <div class="chat-item" onclick="CLASSIFIED.openChatFromList('${chat.otherUserId}', '${chat.otherUserName}', '${chat.otherUserAvatar}')" style="${isUnread ? 'background: rgba(0,212,255,0.05);' : ''}">
                    <div class="chat-avatar" style="background-image: url('${chat.otherUserAvatar}')">
                        ${isUnread ? `<div style="position: absolute; top: 0; right: 0; background: #00D4FF; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #1a1a1a;"></div>` : ''}
                    </div>
                    <div class="chat-info">
                        <div class="chat-name" style="${isUnread ? 'font-weight: 700;' : ''}">${chat.otherUserName}</div>
                        <div class="chat-message" style="${isUnread ? 'font-weight: 600; opacity: 0.9;' : ''}">${chat.lastMessage || 'Start a conversation!'}</div>
                    </div>
                    <div class="chat-time">${timeStr}</div>
                </div>
            `;
        }).join('');
    },
    
    // Open chat from list
    async openChatFromList(userId, userName, userAvatar) {
        // Create user object
        const user = {
            id: userId,
            uid: userId,
            name: userName,
            image: userAvatar
        };
        
        this.state.currentChatUser = user;
        
        // Get or create chat
        const chatId = await this.getOrCreateChat(userId, userName);
        
        // Open chat UI
        this.openChat(userName, userAvatar);
        
        // Start listening for messages
        this.listenForChatMessages(chatId);
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
    
    // 💕 MATCHING SYSTEM
    
    // Handle user like action
    async handleUserLike(targetUserId, targetUserName) {
        const currentUserId = this.state.currentUser.uid;
        
        try {
            // Record the like
            await window.db.collection('likes').add({
                fromUserId: currentUserId,
                toUserId: targetUserId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Check if other user already liked us (mutual match)
            const mutualLike = await window.db.collection('likes')
                .where('fromUserId', '==', targetUserId)
                .where('toUserId', '==', currentUserId)
                .get();
            
            if (!mutualLike.empty) {
                // It's a match!
                await this.createMatch(currentUserId, targetUserId, targetUserName);
                this.showMatchPopup(targetUserName);
            } else {
                alert(`You liked ${targetUserName}! 💕 They'll be notified.`);
            }
            
        } catch (error) {
            console.error('❌ Error handling like:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules as shown in the console.');
            } else {
                alert('Failed to process like. Please try again.');
            }
        }
    },
    
    // Create a match between users
    async createMatch(userId1, userId2, user2Name) {
        const matchId = [userId1, userId2].sort().join('_');
        
        try {
            await window.db.collection('matches').doc(matchId).set({
                users: [userId1, userId2],
                matchedAt: firebase.firestore.FieldValue.serverTimestamp(),
                chatStarted: false
            });
            
            // Create initial chat
            await this.getOrCreateChat(userId2, user2Name);
            
            console.log('✅ Match created!');
        } catch (error) {
            console.error('❌ Error creating match:', error);
            if (error.code === 'permission-denied') {
                alert('⚠️ Permission denied. Please configure Firestore security rules.');
            }
        }
    },
    
    // Listen for new matches
    listenForMatches() {
        const currentUserId = this.state.currentUser.uid;
        
        this.matchListener = window.db.collection('matches')
            .where('users', 'array-contains', currentUserId)
            .orderBy('matchedAt', 'desc')
            .onSnapshot(async (snapshot) => {
                const matches = [];
                
                for (const doc of snapshot.docs) {
                    const matchData = doc.data();
                    const otherUserId = matchData.users.find(id => id !== currentUserId);
                    
                    // Get other user's data
                    const userDoc = await window.db.collection('users').doc(otherUserId).get();
                    const userData = userDoc.exists ? userDoc.data() : {};
                    
                    matches.push({
                        id: doc.id,
                        ...matchData,
                        otherUser: {
                            id: otherUserId,
                            name: userData.name || 'Unknown',
                            avatar: userData.photos?.[0] || userData.photo || 'https://via.placeholder.com/100'
                        }
                    });
                }
                
                this.displayMatches(matches);
            }, (error) => {
                if (error.code === 'permission-denied') {
                    console.log('Cannot load matches - permission denied');
                }
            });
    },
    
    // Display matches
    displayMatches(matches) {
        const container = document.getElementById('matchesScroll');
        
        container.innerHTML = matches.slice(0, 10).map(match => `
            <div class="match-avatar" style="background-image: url('${match.otherUser.avatar}')" 
                 onclick="CLASSIFIED.openChatFromMatch('${match.otherUser.id}', '${match.otherUser.name}', '${match.otherUser.avatar}')"
                 title="${match.otherUser.name}"></div>
        `).join('');
    },
    
    // Open chat from match
    async openChatFromMatch(userId, userName, userAvatar) {
        await this.openChatFromList(userId, userName, userAvatar);
        
        // Update match as chat started
        const matchId = [this.state.currentUser.uid, userId].sort().join('_');
        await window.db.collection('matches').doc(matchId).update({
            chatStarted: true
        });
    },
    
    // Show match popup with correct user
    showMatchPopup(userName = 'Someone') {
        const popup = document.getElementById('matchPopup');
        popup.innerHTML = `
            <div class="match-content">
                <div class="match-text">IT'S A MATCH! 🎉</div>
                <p>You and ${userName} both liked each other</p>
                <button class="match-btn" onclick="CLASSIFIED.closeMatchPopup()">Start Chatting</button>
            </div>
        `;
        popup.classList.add('show');
    },
    
    // Close match popup
    closeMatchPopup() {
        document.getElementById('matchPopup').classList.remove('show');
        // Navigate to messaging tab
        this.showScreen('social');
        this.switchSocialTab('messaging');
    },
    
    // Clean up listeners when logging out
    cleanupMessagingListeners() {
        if (this.messageListener) this.messageListener();
        if (this.chatListListener) this.chatListListener();
        if (this.matchListener) this.matchListener();
    },
