 <!-- Firebase SDKs -->
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
    
    <script>
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyB-zTm6JB4EkD_7Q9056K4UGbIPyHQL4S4",
            authDomain: "hoi-an-social-app.firebaseapp.com",
            databaseURL: "https://hoi-an-social-app-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "hoi-an-social-app",
            storageBucket: "hoi-an-social-app.firebasestorage.app",
            messagingSenderId: "302219568692",
            appId: "1:302219568692:web:3edf7128342b74b1e0cc61",
            measurementId: "G-WX23VDV53B"
        };
        
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Initialize services
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        window.storage = firebase.storage();
        
        // Mark Firebase as ready
        window.CLASSIFIED = window.CLASSIFIED || {};
        window.CLASSIFIED.state = window.CLASSIFIED.state || {};
        window.CLASSIFIED.state.firebaseReady = true;
        
        console.log('🔥 Firebase initialized successfully!');
    </script>
