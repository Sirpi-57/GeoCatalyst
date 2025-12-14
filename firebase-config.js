// ============================================
// FIREBASE CONFIGURATION
// ============================================

// Import Firebase SDK modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// ============================================
// FIREBASE CONFIGURATION OBJECT
// ============================================
// TODO: Replace with your actual Firebase project credentials
// Get these from Firebase Console > Project Settings > General > Your apps > Web app

const firebaseConfig = {
  apiKey: "AIzaSyCSWxF7rq6zc-qtPiFqCfI8i59g7SZkgUc",
  authDomain: "geocatalyst-production.firebaseapp.com",
  projectId: "geocatalyst-production",
  storageBucket: "geocatalyst-production.firebasestorage.app",
  messagingSenderId: "199953245511",
  appId: "1:199953245511:web:213523b76e8e5f290f5862"
};

// ============================================
// INITIALIZE FIREBASE
// ============================================

let app;
let auth;
let db;
let storage;

try {
    // Initialize Firebase App
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase App initialized successfully');

    // Initialize Firebase Authentication
    auth = getAuth(app);
    console.log('✅ Firebase Auth initialized');

    // Initialize Cloud Firestore
    db = getFirestore(app);
    console.log('✅ Firestore initialized');

    // Initialize Firebase Storage
    storage = getStorage(app);
    console.log('✅ Firebase Storage initialized');

    // ============================================
    // EMULATOR SETUP (Development Only)
    // ============================================
    // Uncomment the lines below to use Firebase Emulators for local development
    
    /*
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔧 Connecting to Firebase Emulators...');
        
        // Connect to Auth Emulator
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        
        // Connect to Firestore Emulator
        connectFirestoreEmulator(db, 'localhost', 8080);
        
        // Connect to Storage Emulator
        connectStorageEmulator(storage, 'localhost', 9199);
        
        console.log('✅ Connected to Firebase Emulators');
    }
    */

} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    
    // Show user-friendly error message
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        alert('Failed to connect to Firebase. Please check your internet connection and try again.');
    }
}

// ============================================
// FIRESTORE COLLECTIONS STRUCTURE
// ============================================
/*
Database Structure:

/users/{userId}
    - uid: string
    - email: string
    - name: string
    - phone: string
    - plan: string (free, premium, master)
    - enrolledCourses: array [
        "Remote Sensing",
        "Geographic Information System (GIS)",
        "Image Processing",
        "Global Positioning System (GPS)",
        "Surveying",
        "Engineering Mathematics",
        "General Aptitude"
    ]
    - photoURL: string
    - createdAt: timestamp
    - updatedAt: timestamp
    - stats: {
        videosWatched: number
        testsAttempted: number
        doubtsAsked: number
        progress: number
    }
    
    /videoProgress/{videoId}
        - videoId: string
        - progress: number (0-100)
        - lastWatched: timestamp
    
    /testResults/{testId}
        - testId: string
        - score: number
        - totalQuestions: number
        - correctAnswers: number
        - attemptedAt: timestamp

/courses/{courseId}
    - id: string
    - name: string (Remote Sensing, GIS, Image Processing, GPS, Surveying, Engineering Mathematics, General Aptitude)
    - price: number (1000, 1000, 1250, 750, 1250, 750, 500)
    - description: string
    - thumbnail: string
    - isFree: boolean
    - order: number
    
    /lectures/{lectureId}
        - id: string
        - title: string
        - description: string
        - videoId: string (Cloudflare Stream)
        - duration: string
        - isFree: boolean
        - order: number
        - createdAt: timestamp

/materials/{materialId}
    - id: string
    - title: string
    - subject: string (exact course names)
    - type: string (pdf, notes, formula-sheet)
    - downloadURL: string
    - fileSize: string
    - isFree: boolean
    - createdAt: timestamp

/tests/{testId}
    - id: string
    - title: string
    - subject: string (exact course names)
    - type: string (free, subject, mock)
    - duration: number (minutes)
    - totalQuestions: number
    - isFree: boolean
    - questions: array
    - createdAt: timestamp

/doubts/{doubtId}
    - id: string
    - userId: string
    - userEmail: string
    - subject: string
    - question: string
    - status: string (pending, answered)
    - answer: string
    - answeredBy: string
    - answeredAt: timestamp
    - createdAt: timestamp
    - updatedAt: timestamp

/orders/{orderId}
    - orderId: string (Razorpay)
    - userId: string
    - courseName: string
    - amount: number
    - currency: string
    - status: string (created, completed, failed)
    - paymentId: string
    - signature: string
    - createdAt: timestamp
    - completedAt: timestamp
*/

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current user's ID token for API authentication
 * @returns {Promise<string>} ID token
 */
export async function getCurrentUserToken() {
    if (!auth.currentUser) {
        throw new Error('No user logged in');
    }
    return await auth.currentUser.getIdToken();
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isUserAuthenticated() {
    return auth.currentUser !== null;
}

/**
 * Get current user object
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Create Authorization header for API requests
 * @returns {Promise<Object>} Headers object with Bearer token
 */
export async function getAuthHeaders() {
    const token = await getCurrentUserToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ============================================
// CONFIGURATION VALIDATION
// ============================================

function validateFirebaseConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingFields = requiredFields.filter(field => 
        !firebaseConfig[field] || firebaseConfig[field].startsWith('YOUR_')
    );
    
    if (missingFields.length > 0) {
        console.warn('⚠️ Firebase configuration incomplete. Missing or placeholder values for:', missingFields.join(', '));
        console.warn('Please update firebase-config.js with your actual Firebase project credentials.');
        return false;
    }
    
    return true;
}

// Validate config on load (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    validateFirebaseConfig();
}

// ============================================
// EXPORT FIREBASE INSTANCES
// ============================================

export { app, auth, db, storage };

// Export config for debugging (development only)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.firebaseDebug = {
        app,
        auth,
        db,
        storage,
        config: firebaseConfig
    };
    console.log('🔍 Firebase debug info available at: window.firebaseDebug');
}

console.log('✅ Firebase configuration loaded successfully');