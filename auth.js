// ============================================
// AUTHENTICATION MODULE
// ============================================

import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ============================================
// BACKEND API CONFIGURATION
// ============================================

const API_BASE_URL = 'https://geocatalyst-student-backend.onrender.com/api';

// ============================================
// AUTHENTICATION STATE MANAGEMENT
// ============================================

let currentUser = null;

/**
 * Initialize auth state listener
 */
export function initializeAuth() {
    console.log('🔐 Initializing authentication...');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ User logged in:', user.email);
            currentUser = user;
            
            // Load user data and show app view
            await handleUserLogin(user);
        } else {
            console.log('👤 No user logged in');
            currentUser = null;
            
            // Show public view
            showPublicView();
        }
    });
}

/**
 * Handle user login - load data and switch to app view
 */
async function handleUserLogin(user) {
    try {

        await user.getIdToken(true); // true = force refresh

        console.log('✅ Fresh token generated for:', user.email);
        
        // Check if user document exists in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            console.log('📝 Creating user document in Firestore...');
            
            // Create user document
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                phone: '',
                plan: 'free',
                enrolledCourses: [],
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                stats: {
                    videosWatched: 0,
                    testsAttempted: 0,
                    doubtsAsked: 0,
                    progress: 0
                }
            });
            
            console.log('✅ User document created');
        }
        
        // Switch to app view
        showAppView(user);
        
        // Load user data
        if (window.loadUserData) {
            window.loadUserData(user);
        }
        
    } catch (error) {
        console.error('❌ Error handling user login:', error);
        showErrorMessage(null, 'Failed to load user data. Please refresh the page.');
    }
}

// ============================================
// SIGNUP FUNCTIONALITY
// ============================================

/**
 * Handle user signup
 */
async function handleSignup(event) {
    event.preventDefault();
    
    // Get form values
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    
    // Validation
    if (!name || !email || !password) {
        showErrorMessage('signupError', 'Please fill in all required fields');
        return;
    }
    
    if (password.length < 6) {
        showErrorMessage('signupError', 'Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        showErrorMessage('signupError', 'Passwords do not match');
        return;
    }
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    try {
        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ User created:', user.uid);
        
        // Update user profile with name
        await updateProfile(user, {
            displayName: name
        });
        
        console.log('✅ Profile updated with name');
        
        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: email,
            name: name,
            phone: phone,
            plan: 'free',
            enrolledCourses: [],
            photoURL: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            stats: {
                videosWatched: 0,
                testsAttempted: 0,
                doubtsAsked: 0,
                progress: 0
            }
        });
        
        console.log('✅ User document created in Firestore');
        
        // Close signup modal
        closeModal('signupModal');
        
        // Show success message
        showSuccessMessage('Account created successfully! Welcome to GeoCatalyst.');
        
        // Auth state listener will automatically switch to app view
        
    } catch (error) {
        console.error('❌ Signup error:', error);
        
        // Handle specific error codes
        let errorMessage = 'Failed to create account. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Please sign in instead.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use a stronger password.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
        }
        
        showErrorMessage('signupError', errorMessage);
        
    } finally {
        // Reset button state
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// ============================================
// LOGIN FUNCTIONALITY
// ============================================

/**
 * Handle user login
 */
async function handleLogin(event) {
    event.preventDefault();
    
    // Get form values
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // Validation
    if (!email || !password) {
        showErrorMessage('loginError', 'Please enter both email and password');
        return;
    }
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    try {
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ User logged in:', user.email);
        
        // Close login modal
        closeModal('loginModal');
        
        // Show success message
        showSuccessMessage('Welcome back to GeoCatalyst!');
        
        // Auth state listener will automatically switch to app view
        
    } catch (error) {
        console.error('❌ Login error:', error);
        
        // Handle specific error codes
        let errorMessage = 'Failed to sign in. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Invalid email or password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
        }
        
        showErrorMessage('loginError', errorMessage);
        
    } finally {
        // Reset button state
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// ============================================
// LOGOUT FUNCTIONALITY
// ============================================

/**
 * Handle user logout
 */
async function handleLogout() {
    try {
        await signOut(auth);
        console.log('✅ User logged out');
        
        // Show success message
        showSuccessMessage('Logged out successfully. See you soon!');
        
        // Auth state listener will automatically switch to public view
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        showErrorMessage(null, 'Failed to log out. Please try again.');
    }
}

/**
 * Handle password change
 */
async function handleChangePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    // Validation
    if (newPassword !== confirmNewPassword) {
        showErrorMessage('changePasswordError', 'New passwords do not match');
        return;
    }
    
    if (newPassword.length < 6) {
        showErrorMessage('changePasswordError', 'Password must be at least 6 characters');
        return;
    }
    
    // Show loading
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    try {
        // Import necessary Firebase functions
        const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }
        
        // Re-authenticate user with current password
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        // Update to new password
        await updatePassword(user, newPassword);
        
        console.log('✅ Password changed successfully');
        
        // Close modal and clear form
        closeModal('changePasswordModal');
        document.getElementById('changePasswordForm').reset();
        
        // Show success message
        showSuccessMessage('Password changed successfully!');
        
    } catch (error) {
        console.error('❌ Password change error:', error);
        
        let errorMessage = 'Failed to change password. Please try again.';
        
        switch (error.code) {
            case 'auth/wrong-password':
                errorMessage = 'Current password is incorrect.';
                break;
            case 'auth/weak-password':
                errorMessage = 'New password is too weak.';
                break;
            case 'auth/requires-recent-login':
                errorMessage = 'Please log out and log back in before changing your password.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection.';
                break;
        }
        
        showErrorMessage('changePasswordError', errorMessage);
        
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// Export the function
window.handleChangePassword = handleChangePassword;

// ============================================
// PASSWORD RESET
// ============================================

/**
 * Send password reset email
 */
export async function sendPasswordReset(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showSuccessMessage('Password reset email sent! Check your inbox.');
        return true;
    } catch (error) {
        console.error('❌ Password reset error:', error);
        
        let errorMessage = 'Failed to send password reset email.';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
        }
        
        showErrorMessage(null, errorMessage);
        return false;
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Show error message in modal or as toast
 */
function showErrorMessage(errorDivId, message) {
    if (errorDivId) {
        // Show in modal
        const errorDiv = document.getElementById(errorDivId);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    } else {
        // Show as toast/alert
        alert(message);
    }
}

/**
 * Show success message as toast
 */
function showSuccessMessage(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Get current user's ID token for API calls
 */
export async function getCurrentUserToken() {
    if (!currentUser) {
        throw new Error('No user logged in');
    }
    return await currentUser.getIdToken();
}

/**
 * Make authenticated API call
 */
export async function makeAuthenticatedRequest(endpoint, options = {}) {
    try {
        const token = await getCurrentUserToken();
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
        
    } catch (error) {
        console.error('❌ API request error:', error);
        throw error;
    }
}

// ============================================
// EVENT LISTENERS SETUP
// ============================================

/**
 * Set up all authentication event listeners
 */
export function setupAuthListeners() {
    console.log('🎧 Setting up auth event listeners...');
    
    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Change password form
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePassword);
    }
    
    // Logout buttons (multiple - in sidebar and elsewhere)
    document.querySelectorAll('[data-action="signout"]').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
    
    console.log('✅ Auth event listeners set up');
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing GeoCatalyst authentication...');
    
    // Initialize auth state listener
    initializeAuth();
    
    // Set up event listeners
    setupAuthListeners();
    
    console.log('✅ Authentication module loaded');
});

// ============================================
// UTILITY EXPORTS
// ============================================

export {
    currentUser,
    handleSignup,
    handleLogin,
    handleLogout,
    showErrorMessage,
    showSuccessMessage
};

// Add CSS animations for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .success-toast {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
    }
    
    .error-message {
        background: #fee;
        color: #c33;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 14px;
        border: 1px solid #fcc;
    }
`;
document.head.appendChild(style);

console.log('✅ Auth.js loaded successfully');