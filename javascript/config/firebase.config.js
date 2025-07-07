 waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            
            const checkFirebase = () => {
                attempts++;
                
                if (window.auth && window.db && window.storage) {
                    this.state.firebaseReady = true;
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Firebase failed to initialize'));
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            
            checkFirebase();
        });
    },
