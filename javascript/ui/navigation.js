   // 📱 UI Helper Methods
    showLogin() {
        document.getElementById('loginScreen').classList.add('show');
        document.getElementById('registerScreen').classList.remove('show');
        document.getElementById('businessAuthScreen').classList.remove('show');
        document.querySelector('.main-screens').classList.remove('authenticated');
        document.querySelector('.bottom-nav').style.display = 'none';
        document.getElementById('guestBanner').style.display = 'none';
    },
    
    showRegister() {
        document.getElementById('registerScreen').classList.add('show');
        document.getElementById('loginScreen').classList.remove('show');
        document.getElementById('businessAuthScreen').classList.remove('show');
    },
    
    showBusinessAuth() {
        document.getElementById('businessAuthScreen').classList.add('show');
        document.getElementById('loginScreen').classList.remove('show');
        document.getElementById('registerScreen').classList.remove('show');
    },
    
    hideAuthScreens() {
        document.getElementById('loginScreen').classList.remove('show');
        document.getElementById('registerScreen').classList.remove('show');
        document.getElementById('businessAuthScreen').classList.remove('show');
        document.querySelector('.main-screens').classList.add('authenticated');
        document.querySelector('.bottom-nav').style.display = 'flex';
        document.getElementById('guestBanner').style.display = 'none';
        this.hideLoading();
    },
    
    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    },
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    },
