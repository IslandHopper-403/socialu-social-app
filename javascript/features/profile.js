 // 📝 Profile Editor Functions
    openProfileEditor() {
        console.log('✏️ Opening profile editor');
        document.getElementById('profileEditor').classList.add('show');
        this.state.isProfileEditorOpen = true;
        this.loadProfileData();
    },
    
    closeProfileEditor() {
        console.log('🔙 Closing profile editor');
        document.getElementById('profileEditor').classList.remove('show');
        this.state.isProfileEditorOpen = false;
    },
    
    openBusinessProfileEditor() {
        console.log('🏢 Opening business profile editor');
        document.getElementById('businessProfileEditor').classList.add('show');
        this.state.isBusinessProfileEditorOpen = true;
        this.loadBusinessProfileData();
    },
    
    closeBusinessProfileEditor() {
        console.log('🔙 Closing business profile editor');
        document.getElementById('businessProfileEditor').classList.remove('show');
        this.state.isBusinessProfileEditorOpen = false;
    },
    
    viewMyProfile() {
        console.log('👤 Viewing my profile');
        this.closeProfileEditor();
        document.getElementById('myProfileView').classList.add('show');
        this.updateMyProfileView();
    },
    
    closeMyProfile() {
        console.log('🔙 Closing my profile');
        document.getElementById('myProfileView').classList.remove('show');
    },
    
    viewBusinessProfile() {
        console.log('🏢 Viewing business profile');
        this.closeBusinessProfileEditor();
        // Could open business profile view here
    },
    
    loadProfileData() {
        const profile = this.state.userProfile;
        
        // Load basic info
        document.getElementById('profileBio').value = profile.bio || '';
        document.getElementById('profileBirthday').value = profile.birthday || '';
        document.getElementById('profileHeight').value = profile.height || '';
        
        // Load choices
        if (profile.zodiac) this.selectChoiceByValue('zodiac', profile.zodiac);
        if (profile.career) this.selectChoiceByValue('career', profile.career);
        if (profile.priority) this.selectChoiceByValue('priority', profile.priority);
        if (profile.relationship) this.selectChoiceByValue('relationship', profile.relationship);
        if (profile.lookingFor) this.selectChoiceByValue('lookingFor', profile.lookingFor);
        if (profile.marriage) this.selectChoiceByValue('marriage', profile.marriage);
        
        // Load interests
        document.querySelectorAll('.interest-btn').forEach(btn => {
            btn.classList.remove('active');
            if (profile.interests && profile.interests.includes(btn.dataset.interest)) {
                btn.classList.add('active');
            }
        });
        
        // Load photos
        if (profile.photos && profile.photos.length > 0) {
            profile.photos.forEach((photo, index) => {
                if (photo) {
                    const slot = document.querySelectorAll('#photoGrid .photo-slot')[index];
                    if (slot) {
                        slot.style.backgroundImage = `url('${photo}')`;
                        slot.classList.add('filled');
                        slot.innerHTML = index === 0 ? '<div class="star-icon">⭐</div>' : '';
                    }
                }
            });
        }
    },
    
    loadBusinessProfileData() {
        const profile = this.state.businessProfile;
        
        // Load basic info
        document.getElementById('businessName').value = profile.name || '';
        document.getElementById('businessType').value = profile.type || '';
        document.getElementById('businessDescription').value = profile.description || '';
        document.getElementById('businessAddress').value = profile.address || '';
        document.getElementById('businessPhone').value = profile.phone || '';
        document.getElementById('businessHours').value = profile.hours || '';
        document.getElementById('businessPriceRange').value = profile.priceRange || '';
        document.getElementById('businessPromoTitle').value = profile.promoTitle || '';
        document.getElementById('businessPromoDetails').value = profile.promoDetails || '';
        
        // Load photos
        if (profile.photos && profile.photos.length > 0) {
            profile.photos.forEach((photo, index) => {
                if (photo) {
                    const slot = document.querySelectorAll('#businessPhotoGrid .photo-slot')[index];
                    if (slot) {
                        slot.style.backgroundImage = `url('${photo}')`;
                        slot.classList.add('filled');
                        slot.innerHTML = index === 0 ? '<div class="star-icon">⭐</div>' : '';
                    }
                }
            });
        }
    },
    
    selectChoice(choiceType, value, buttonElement) {
        // Remove active from siblings
        const siblings = buttonElement.parentElement.querySelectorAll('.choice-btn');
        siblings.forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        buttonElement.classList.add('active');
        
        // Update state
        this.state.userProfile[choiceType] = value;
        console.log(`Selected ${choiceType}: ${value}`);
    },
    
    selectChoiceByValue(choiceType, value) {
        const btn = document.querySelector(`[data-choice="${choiceType}"][data-value="${value}"]`);
        if (btn) {
            this.selectChoice(choiceType, value, btn);
        }
    },
    
    toggleInterest(buttonElement) {
        const interest = buttonElement.dataset.interest;
        const isActive = buttonElement.classList.contains('active');
        
        if (!this.state.userProfile.interests) {
            this.state.userProfile.interests = [];
        }
        
        if (isActive) {
            buttonElement.classList.remove('active');
            this.state.userProfile.interests = this.state.userProfile.interests.filter(i => i !== interest);
        } else {
            if (this.state.userProfile.interests.length < 8) {
                buttonElement.classList.add('active');
                this.state.userProfile.interests.push(interest);
            } else {
                alert('You can select up to 8 interests!');
            }
        }
        console.log('Current interests:', this.state.userProfile.interests);
    },
    
    updateMyProfileView() {
        const profile = this.state.userProfile;
        
        // Update profile view with user data
        document.getElementById('myProfileName').textContent = profile.name || 'Your Name';
        document.getElementById('myProfileAge').textContent = profile.age ? `${profile.age} years old` : 'Add your age';
        document.getElementById('myProfileBio').textContent = profile.bio || 'Complete your profile to start connecting with amazing people in Hoi An!';
        
        // Update details
        document.getElementById('myProfileAgeDetail').textContent = profile.age || '-';
        document.getElementById('myProfileHeightDetail').textContent = profile.height || '-';
        document.getElementById('myProfileCareerDetail').textContent = profile.career || '-';
        document.getElementById('myProfileZodiacDetail').textContent = profile.zodiac || '-';
        document.getElementById('myProfileLookingForDetail').textContent = profile.lookingFor || '-';
        
        // Update interests
        const interestsContainer = document.getElementById('myProfileInterests');
        if (profile.interests && profile.interests.length > 0) {
            interestsContainer.innerHTML = profile.interests.map(interest => 
                `<span class="interest-tag">${interest}</span>`
            ).join('');
        } else {
            interestsContainer.innerHTML = '<span class="interest-tag">Add interests in profile editor</span>';
        }
        
        // Update hero image if photos available
        if (profile.photos && profile.photos.length > 0 && profile.photos[0]) {
            document.getElementById('myProfileHero').style.backgroundImage = `url('${profile.photos[0]}')`;
        }
    },
    
    shareMyProfile() {
        const shareText = `Check out my profile on CLASSIFIED Hoi An! 🌟`;
        if (navigator.share) {
            navigator.share({
                title: 'My CLASSIFIED Profile',
                text: shareText,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(shareText + ' - ' + window.location.href);
            alert('Profile link copied to clipboard! 📋');
        }
    },
