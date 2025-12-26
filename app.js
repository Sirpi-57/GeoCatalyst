// ============================================
// APP.JS - Main Application Logic
// ============================================

// Global state
let currentUser = null;
let userPlan = 'free';
let userAnswers = {};
let currentLeaderboardTestId = null;
let leaderboardRefreshInterval = null;
let allTestsForLeaderboard = [];
let currentShareData = null;

// ============================================
// MODAL CONTROLS
// ============================================

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Clear form if it's an auth modal
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        // Clear error messages
        const errorDiv = modal.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }
    }
}

// Switch between auth modals
function switchAuthModal(type) {
    if (type === 'login') {
        closeModal('signupModal');
        openModal('loginModal');
    } else if (type === 'signup') {
        closeModal('loginModal');
        openModal('signupModal');
    }
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('auth-modal') || e.target.classList.contains('video-modal')) {
        closeModal(e.target.id);
    }
});

// Expose modal functions globally
window.openModal = openModal;
window.closeModal = closeModal;
window.switchAuthModal = switchAuthModal;

// ============================================
// VIDEO PLAYER MODAL
// ============================================

// async function openVideoPlayer(videoData) {
//     const modal = document.getElementById('videoPlayerModal');
//     const titleEl = document.getElementById('videoPlayerTitle');
//     const containerEl = document.getElementById('videoPlayerContainer');
//     const durationEl = document.getElementById('videoPlayerDuration');
//     const subjectEl = document.getElementById('videoPlayerSubject');
//     const descriptionEl = document.getElementById('videoPlayerDescription');
    
//     // Set video details
//     titleEl.textContent = videoData.title || 'Video Lecture';
//     durationEl.textContent = videoData.duration || '';
//     subjectEl.textContent = videoData.subject || '';
//     descriptionEl.textContent = videoData.description || '';
    
//     // Clear previous content first
//     containerEl.innerHTML = '';

//     // Load Cloudflare Stream video
//     if (videoData.videoId) {
//         // 1. Create the iframe element programmatically
//         const iframe = document.createElement('iframe');
//         // Use your specific Cloudflare customer URL structure
//         iframe.src = `https://customer-fgsu53kv400xosj3.cloudflarestream.com/${videoData.videoId}/iframe`;
//         iframe.style.border = 'none';
//         iframe.style.width = '100%';
//         iframe.style.height = '100%';
//         iframe.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;';
//         iframe.allowFullscreen = true;
        
//         // Append iframe to container
//         containerEl.appendChild(iframe);

//         // 2. Initialize the Cloudflare Stream Player SDK to track events
//         try {
//             if (typeof Stream === 'undefined') {
//                 console.warn("Cloudflare Stream SDK not loaded. Video tracking will not work.");
//             } else {
//                 const player = Stream(iframe);

//                 // 3. Listen for the 'ended' event to track completion
//                 player.addEventListener('ended', async () => {
//                     console.log("Video finished! Sending update to backend...");
                    
//                     try {
//                         // Dynamically import auth helper
//                         const { makeAuthenticatedRequest } = await import('./auth.js');
                        
//                         // Call the backend endpoint
//                         const response = await makeAuthenticatedRequest('/user/stats/video-watched', {
//                             method: 'POST',
//                             body: JSON.stringify({
//                                 videoId: videoData.videoId,
//                                 progress: 100 
//                             })
//                         });
                        
//                         if (response.success) {
//                             console.log("View count updated successfully.");
//                             // Optional: Refresh dashboard stats immediately
//                             if (window.loadDashboardStats) window.loadDashboardStats();
//                         }
//                     } catch (error) {
//                         console.error("Failed to update video stats:", error);
//                     }
//                 });
//             }
//         } catch (err) {
//             console.error("Error initializing video player:", err);
//         }

//     } else {
//         containerEl.innerHTML = '<div style="text-align: center; padding: 40px;">Video not available</div>';
//     }
    
//     modal.style.display = 'flex';
//     document.body.style.overflow = 'hidden';
// }

// function closeVideoPlayer() {
//     const modal = document.getElementById('videoPlayerModal');
//     const containerEl = document.getElementById('videoPlayerContainer');
    
//     // Stop video by clearing iframe
//     containerEl.innerHTML = '';
    
//     modal.style.display = 'none';
//     document.body.style.overflow = 'auto';
// }

// window.openVideoPlayer = openVideoPlayer;
// window.closeVideoPlayer = closeVideoPlayer;

// ============================================
// VIDEO PLAYER MODAL - YOUTUBE
// ============================================

// Global YouTube player instance
let youtubePlayer = null;
let isYouTubeAPIReady = false;
let pendingVideoLoad = null;

// YouTube API Ready Callback (called automatically by YouTube)
window.onYouTubeIframeAPIReady = function() {
    console.log('✅ YouTube IFrame API Ready');
    isYouTubeAPIReady = true;
    
    // Load pending video if any
    if (pendingVideoLoad) {
        console.log('🎬 Loading queued video now...');
        loadYouTubeVideo(
            pendingVideoLoad.videoId,
            pendingVideoLoad.hasAccess,
            pendingVideoLoad.videoData
        );
        pendingVideoLoad = null;
    }
};

// Helper function to wait for API
function waitForYouTubeAPI(callback, maxWait = 5000) {
    const startTime = Date.now();
    
    const checkAPI = setInterval(() => {
        if (isYouTubeAPIReady || typeof YT !== 'undefined' && YT.Player) {
            clearInterval(checkAPI);
            isYouTubeAPIReady = true;
            callback();
        } else if (Date.now() - startTime > maxWait) {
            clearInterval(checkAPI);
            console.error('❌ YouTube API failed to load');
            alert('Failed to load video player. Please refresh the page.');
        }
    }, 100);
}

function openVideoPlayer(videoData) {
    console.log('📹 Opening video player:', videoData);
    
    const modal = document.getElementById('videoPlayerModal');
    const titleEl = document.getElementById('videoPlayerTitle');
    const subjectEl = document.getElementById('videoPlayerSubject');
    const descriptionEl = document.getElementById('videoPlayerDescription');
    
    // Set video details
    titleEl.textContent = videoData.title || 'Video Lecture';
    subjectEl.textContent = videoData.subject || '';
    descriptionEl.textContent = videoData.description || '';
    
    // Load YouTube video
    if (videoData.youtubeId) {
        loadYouTubeVideo(videoData.youtubeId, videoData.hasAccess, videoData);
    } else {
        console.error('❌ No YouTube ID found in video data');
        alert('This video is not available yet.');
        return;
    }
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function loadYouTubeVideo(youtubeId, hasAccess, videoData) {
    console.log('📹 Loading YouTube video:', youtubeId, 'Access:', hasAccess);
    
    const playerDiv = document.getElementById('youtubePlayer');
    const lockedOverlay = document.getElementById('videoLockedOverlay');
    
    // Check access
    if (!hasAccess) {
        console.log('🔒 Video locked - no access');
        playerDiv.style.display = 'none';
        lockedOverlay.style.display = 'flex';
        
        // Update locked message
        const subjectSpan = document.getElementById('requiredSubject');
        if (subjectSpan && videoData) {
            subjectSpan.textContent = videoData.subject || 'this subject';
        }
        return;
    }
    
    // Show player, hide locked overlay
    playerDiv.style.display = 'block';
    lockedOverlay.style.display = 'none';
    
    // Check if API is ready
    if (!isYouTubeAPIReady && typeof YT === 'undefined') {
        console.log('⏳ YouTube API not ready yet, waiting...');
        pendingVideoLoad = { youtubeId, hasAccess, videoData };
        
        // Show loading message
        playerDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 500px; background: #000; color: white; flex-direction: column;">
                <div class="spinner" style="margin-bottom: 20px;"></div>
                <p>Loading YouTube player...</p>
            </div>
        `;
        
        // Wait for API and retry
        waitForYouTubeAPI(() => {
            if (pendingVideoLoad) {
                loadYouTubeVideo(
                    pendingVideoLoad.videoId,
                    pendingVideoLoad.hasAccess,
                    pendingVideoLoad.videoData
                );
                pendingVideoLoad = null;
            }
        });
        return;
    }
    
    // Set flag if API is actually loaded
    if (typeof YT !== 'undefined' && YT.Player) {
        isYouTubeAPIReady = true;
    }
    
    // Destroy existing player if any
    if (youtubePlayer) {
        youtubePlayer.destroy();
    }
    
    // Create new YouTube player
    youtubePlayer = new YT.Player('youtubePlayer', {
        height: '100%',
        width: '100%',
        videoId: youtubeId,
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'modestbranding': 1,  // Minimal YouTube branding
            'rel': 0,              // Don't show related videos
            'fs': 1,               // Allow fullscreen
            'cc_load_policy': 0,   // Don't show captions by default
            'iv_load_policy': 3,   // Hide annotations
            'playsinline': 1       // Play inline on mobile
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    console.log('✅ YouTube player ready');
}

function onPlayerStateChange(event) {
    // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
    
    if (event.data === YT.PlayerState.PLAYING) {
        console.log('▶️ Video playing');
        trackVideoView();
    }
    
    if (event.data === YT.PlayerState.ENDED) {
        console.log('✅ Video ended');
        markVideoComplete();
    }
}

function onPlayerError(event) {
    console.error('❌ YouTube player error:', event.data);
    
    let errorMessage = 'Error playing video';
    
    if (event.data === 2) {
        errorMessage = 'Invalid video ID';
    } else if (event.data === 5) {
        errorMessage = 'HTML5 player error';
    } else if (event.data === 100) {
        errorMessage = 'Video not found or is private';
    } else if (event.data === 101 || event.data === 150) {
        errorMessage = 'Video cannot be embedded. Please check video settings.';
    }
    
    alert(errorMessage);
}

async function trackVideoView() {
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        const response = await makeAuthenticatedRequest('/user/stats/video-watched', {
            method: 'POST',
            body: JSON.stringify({
                videoId: 'youtube_video',
                progress: 0
            })
        });
        
        if (response.success) {
            console.log('✅ View tracked');
            if (window.loadDashboardStats) window.loadDashboardStats();
        }
    } catch (error) {
        console.error('Error tracking view:', error);
    }
}

async function markVideoComplete() {
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        await makeAuthenticatedRequest('/user/stats/video-watched', {
            method: 'POST',
            body: JSON.stringify({
                videoId: 'youtube_video',
                progress: 100
            })
        });
        
        console.log('✅ Video marked as complete');
        if (window.loadDashboardStats) window.loadDashboardStats();
        
    } catch (error) {
        console.error('Error marking video complete:', error);
    }
}

function closeVideoPlayer() {
    const modal = document.getElementById('videoPlayerModal');
    
    // Stop video by destroying player
    if (youtubePlayer) {
        youtubePlayer.destroy();
        youtubePlayer = null;
    }
    
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.openVideoPlayer = openVideoPlayer;
window.closeVideoPlayer = closeVideoPlayer;

// ============================================
// PAYMENT MODAL
// ============================================

function openPaymentModal(courseName, price) {
    const modal = document.getElementById('paymentModal');
    const subjectNameEl = document.getElementById('paymentSubjectName');
    const amountEl = document.getElementById('paymentAmount');
    
    subjectNameEl.textContent = courseName;
    amountEl.textContent = price;
    
    openModal('paymentModal');
    
    // Set up payment button click (Razorpay will be integrated here)
    const paymentBtn = document.getElementById('paymentButton');
    paymentBtn.onclick = () => {
        initiatePayment(courseName, price);
    };
}

async function initiatePayment(courseName, price) {
    console.log('Initiating payment for:', courseName, 'Price:', price);
    
    // Check if user is logged in
    if (!currentUser) {
        closeModal('paymentModal');
        openModal('loginModal');
        alert('Please login first to make a purchase');
        return;
    }
    
    try {
        // Show loading
        const paymentBtn = document.getElementById('paymentButton');
        paymentBtn.disabled = true;
        paymentBtn.innerHTML = '<span class="spinner-small"></span> Processing...';
        
        // Import auth helpers
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // Create order on backend
        const orderData = await makeAuthenticatedRequest('/payment/create-order', {
            method: 'POST',
            body: JSON.stringify({
                courseName: courseName
            })
        });
        
        // Razorpay options
        const options = {
            key: orderData.data.key, // Razorpay key from backend
            amount: orderData.data.amount * 100, // Amount in paise
            currency: orderData.data.currency,
            name: 'GeoCatalyst',
            description: `Purchase: ${courseName}`,
            order_id: orderData.data.orderId,
            handler: async function (response) {
                // Payment successful - verify on backend
                try {
                    await verifyPayment(response, orderData.data.orderId);
                } catch (error) {
                    console.error('Payment verification failed:', error);
                    alert('Payment verification failed. Please contact support.');
                }
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                contact: ''
            },
            theme: {
                color: '#667eea'
            },
            modal: {
                ondismiss: function() {
                    // Reset button
                    paymentBtn.disabled = false;
                    paymentBtn.innerHTML = '💳 Proceed to Payment';
                }
            }
        };
        
        // Open Razorpay checkout
        const razorpay = new Razorpay(options);
        razorpay.open();
        
        // Reset button after opening
        paymentBtn.disabled = false;
        paymentBtn.innerHTML = '💳 Proceed to Payment';
        
    } catch (error) {
        console.error('Payment initiation error:', error);
        alert('Failed to initiate payment. Please try again.');
        
        // Reset button
        const paymentBtn = document.getElementById('paymentButton');
        paymentBtn.disabled = false;
        paymentBtn.innerHTML = '💳 Proceed to Payment';
    }
}

async function verifyPayment(paymentResponse, orderId) {
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // Verify payment on backend
        const result = await makeAuthenticatedRequest('/payment/verify', {
            method: 'POST',
            body: JSON.stringify({
                orderId: orderId,
                paymentId: paymentResponse.razorpay_payment_id,
                signature: paymentResponse.razorpay_signature
            })
        });
        
        if (result.success) {
            // Close payment modal
            closeModal('paymentModal');
            
            // Show success message
            alert('✅ Payment successful! Course access granted.');
            
            // Reload user data
            if (window.loadUserData && currentUser) {
                window.loadUserData(currentUser);
            }
            
            // Navigate to profile or courses
            switchDashboardSection('profile');
        } else {
            throw new Error('Payment verification failed');
        }
        
    } catch (error) {
        console.error('Payment verification error:', error);
        throw error;
    }
}

window.openPaymentModal = openPaymentModal;

// ============================================
// TAB NAVIGATION (Public View)
// ============================================

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
        
        // Add active class to corresponding nav link
        const navLink = document.querySelector(`[data-tab="${tabName}"]`);
        if (navLink) navLink.classList.add('active');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Set up tab navigation listeners
document.addEventListener('DOMContentLoaded', () => {
    // Nav links
    document.querySelectorAll('[data-tab]').forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = element.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Auth buttons
    document.querySelectorAll('[data-action="signin"]').forEach(btn => {
        btn.addEventListener('click', () => openModal('loginModal'));
    });
    
    document.querySelectorAll('[data-action="signup"]').forEach(btn => {
        btn.addEventListener('click', () => openModal('signupModal'));
    });
    
    document.querySelectorAll('[data-action="purchase"]').forEach(btn => {
        btn.addEventListener('click', () => openModal('signupModal'));
    });
});

// ============================================
// DASHBOARD NAVIGATION (App View)
// ============================================

function switchDashboardSection(sectionId) {
    // ✅ ADD VALIDATION
    if (!sectionId || sectionId === 'null' || sectionId === 'undefined') {
        console.error('❌ Invalid section ID:', sectionId);
        return;
    }
    
    console.log('🔄 Switching to section:', sectionId);
    
    // Hide all sections
    document.querySelectorAll('.dashboard-content-section, .dashboard-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // ✅ MAP SECTION IDS - Handle different ID formats
    const sectionIdMap = {
        'leaderboard': 'leaderboardSection',
        'leaderboardSection': 'leaderboardSection',
        'dashboard-home': 'dashboard-home',
        'lectures': 'lectures',
        'study-materials': 'study-materials',
        'tests': 'tests',
        'doubts': 'doubts',
        'profile': 'profile'
    };
    
    // Get the actual element ID
    const actualSectionId = sectionIdMap[sectionId] || sectionId;
    
    // Show selected section
    const selectedSection = document.getElementById(actualSectionId);
    
    if (selectedSection) {
        selectedSection.classList.add('active');
        selectedSection.style.display = 'block';
        
        // Add active class to corresponding nav item
        const navItem = document.querySelector(
            `[data-target="${sectionId}"], [data-section="${sectionId}"]`
        );
        if (navItem) {
            navItem.classList.add('active');
        }
        
        // Load section data
        loadSectionData(sectionId);
        
        console.log('✅ Section switched to:', actualSectionId);
    } else {
        console.error('❌ Section element not found:', actualSectionId, 'from:', sectionId);
        
        // ✅ SHOW ALL SECTION IDS FOR DEBUGGING
        console.log('Available sections:', 
            Array.from(document.querySelectorAll('.dashboard-content-section, .dashboard-section'))
                .map(s => s.id)
        );
    }
}

function loadSectionData(sectionId) {
    console.log('📂 Loading data for section:', sectionId);
    
    // ✅ NORMALIZE SECTION ID
    const normalizedId = sectionId === 'leaderboardSection' ? 'leaderboard' : sectionId;
    
    switch(normalizedId) {
        case 'dashboard-home':
            loadDashboardStats();
            break;
        case 'lectures':
            loadLectures();
            break;
        case 'study-materials':
            loadMaterials();
            break;
        case 'tests':
            loadTests();
            break;
        case 'doubts':
            loadDoubts();
            break;
        case 'profile':
            loadProfile();
            break;
        case 'leaderboard':
            stopLeaderboardAutoRefresh();
            loadTestsForLeaderboard();
            break;
        default:
            console.warn('⚠️ Unknown section:', sectionId);
    }
}

// Set up dashboard navigation listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            // ✅ HANDLE BOTH data-target AND data-section
            const target = item.getAttribute('data-target') || item.getAttribute('data-section');
            
            if (target) {
                switchDashboardSection(target);
            } else {
                console.warn('⚠️ Nav item has no data-target or data-section:', item);
            }
        });
    });
    
    // Handle data-nav buttons
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-nav');
            switchDashboardSection(target);
        });
    });
});

// ============================================
// VIEW SWITCHING (Public ↔ App)
// ============================================

function showPublicView() {
    document.getElementById('public-view').style.display = 'block';
    document.getElementById('app-view').style.display = 'none';
    currentUser = null;
}

function showAppView(user) {
    document.getElementById('public-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    currentUser = user;
    
    // Load user data
    loadUserData(user);
}

window.showPublicView = showPublicView;
window.showAppView = showAppView;

// ============================================
// DATA LOADING FUNCTIONS (Placeholders for Firebase)
// ============================================

function loadUserData(user) {
    console.log('Loading user data for:', user.email);
    
    // Update sidebar user info
    document.getElementById('sidebarUserName').textContent = user.displayName || user.email;
    document.getElementById('sidebarUserEmail').textContent = user.email;
    
    // Update profile
    document.getElementById('profileName').textContent = user.displayName || user.email;
    document.getElementById('profileEmail').textContent = user.email;
    
    // Load dashboard
    loadDashboardStats();
}

async function loadDashboardStats() {
    const container = document.getElementById('dashboardStatsCards');
    
    try {
        // Import auth
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // Get user stats from backend
        const statsData = await makeAuthenticatedRequest('/user/stats');
        const stats = statsData.data || {};
        
        container.innerHTML = `
            <div class="dashboard-card">
                <div class="dashboard-card-icon">📹</div>
                <div class="dashboard-card-content">
                    <h3>Videos Watched</h3>
                    <div class="dashboard-card-value">${stats.videosWatched || 0}</div>
                    <p>${stats.videosWatched > 0 ? 'Keep it up!' : 'Start learning!'}</p>
                </div>
            </div>
            <div class="dashboard-card">
                <div class="dashboard-card-icon">📝</div>
                <div class="dashboard-card-content">
                    <h3>Tests Attempted</h3>
                    <div class="dashboard-card-value">${stats.testsAttempted || 0}</div>
                    <p>${stats.testsAttempted > 0 ? 'Great progress!' : 'Start practicing'}</p>
                </div>
            </div>
            <div class="dashboard-card">
                <div class="dashboard-card-icon">💬</div>
                <div class="dashboard-card-content">
                    <h3>Doubts Asked</h3>
                    <div class="dashboard-card-value">${stats.doubtsAsked || 0}</div>
                    <p>${stats.doubtsAsked > 0 ? 'Keep asking!' : 'Ask your questions'}</p>
                </div>
            </div>
            <div class="dashboard-card">
                <div class="dashboard-card-icon">📊</div>
                <div class="dashboard-card-content">
                    <h3>Progress</h3>
                    <div class="dashboard-card-value">${stats.progress || 0}%</div>
                    <p>${stats.progress > 0 ? 'Well done!' : 'Begin your journey'}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        // Fallback to default stats
        container.innerHTML = `
            <div class="dashboard-card">
                <div class="dashboard-card-icon">📹</div>
                <div class="dashboard-card-content">
                    <h3>Videos Watched</h3>
                    <div class="dashboard-card-value">0</div>
                    <p>Keep learning!</p>
                </div>
            </div>
            <div class="dashboard-card">
                <div class="dashboard-card-icon">📝</div>
                <div class="dashboard-card-content">
                    <h3>Tests Attempted</h3>
                    <div class="dashboard-card-value">0</div>
                    <p>Start practicing</p>
                </div>
            </div>
            <div class="dashboard-card">
                <div class="dashboard-card-icon">💬</div>
                <div class="dashboard-card-content">
                    <h3>Doubts Asked</h3>
                    <div class="dashboard-card-value">0</div>
                    <p>Ask your questions</p>
                </div>
            </div>
            <div class="dashboard-card">
                <div class="dashboard-card-icon">📊</div>
                <div class="dashboard-card-content">
                    <h3>Progress</h3>
                    <div class="dashboard-card-value">0%</div>
                    <p>Begin your journey</p>
                </div>
            </div>
        `;
    }
}

async function loadLectures() {
    const container = document.getElementById('coursesContainer');

    // Show loading
    showLoading('coursesContainer'); 
    try {
        // Import Firebase
        const { db } = await import('./firebase-config.js');
        const { collection, query, getDocs, orderBy } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js'); 

        // Get user's enrolled courses
        const { makeAuthenticatedRequest } = await import('./auth.js'); 
        const userData = await makeAuthenticatedRequest('/user/profile'); 
        const enrolledCourses = userData.data.enrolledCourses || []; 
        const userPlanType = userData.data.plan || 'free'; 

        // Get all videos from the 'videos' collection
        const videosRef = collection(db, 'videos');
        const videosQuery = query(videosRef, orderBy('subject'), orderBy('order'));
        const videosSnapshot = await getDocs(videosQuery);

        if (videosSnapshot.empty) { 
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="color: var(--text-light); font-size: 18px; margin-bottom: 16px;">🎥 Lectures Coming Soon</p>
                    <p style="color: var(--text-light); margin-bottom: 24px;">We're uploading video content. Check back soon!</p>
                </div>
            `;
            return; 
        }

        // Group videos by subject
        const videosBySubject = {};
        videosSnapshot.forEach((doc) => {
            const video = doc.data();
            video.id = doc.id; // Add the document ID
            const subject = video.subject || 'General';

            if (!videosBySubject[subject]) {
                videosBySubject[subject] = [];
            }

            // Check access
            const isFree = video.access === 'free';
            const isEnrolled = enrolledCourses.includes(subject);
            const hasAccess = isFree || isEnrolled || userPlanType === 'master';
            video.hasAccess = hasAccess;

            videosBySubject[subject].push(video);
        });

        // Build HTML
        let lecturesHTML = '';
        for (const subject in videosBySubject) {
            const videos = videosBySubject[subject];
            const subjectIcon = getCourseIcon(subject); // getCourseIcon helper is fine [cite: 462]

            lecturesHTML += `
                <div style="margin-bottom: 32px;">
                    <h3 style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 22px;">
                        <span style="font-size: 32px;">${subjectIcon}</span>
                        ${subject}
                    </h3>
                    <div style="display: grid; gap: 12px;">
            `;

            videos.forEach(video => {
                // Prepare video data for the player
                const videoData = {
                    title: video.title,
                    subject: video.subject,
                    description: video.description,
                    youtubeId: video.youtubeId || video.youtubeUrl?.split('v=')[1]?.split('&')[0], // Extract ID
                    hasAccess: video.hasAccess
                };

                // Need to stringify the object to pass it in onclick
                const videoDataString = JSON.stringify(videoData).replace(/'/g, "\\'");

                lecturesHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 4px;">${video.title}</div>
                            <div style="font-size: 14px; color: var(--text-light);">
                                ${video.description || 'No description'}
                                ${video.access === 'free' ? ' • <span style="color: var(--success-color);">Free</span>' : ''}
                            </div>
                        </div>
                        <div>
                        ${video.hasAccess 
                            ? `<button class="btn btn-sm btn-primary" onclick='openVideoPlayer(${videoDataString})'>▶️ Watch</button>`
                            : `<button class="btn btn-sm btn-secondary" disabled>🔒 Locked</button>`
                        }
                        </div>
                    </div>
                `;
            });

            lecturesHTML += `</div></div>`;
        }

        container.innerHTML = lecturesHTML;

    } catch (error) {
        console.error('Error loading lectures:', error);
        showError('coursesContainer', 'Failed to load video lectures');
    }
}

function getCourseIcon(courseName) {
    const icons = {
        'Remote Sensing': '📡',
        'Geographic Information System (GIS)': '🗺️',
        'Image Processing': '🖼️',
        'Global Positioning System (GPS)': '🛰️',
        'Surveying': '📐',
        'Engineering Mathematics': '🔢',
        'General Aptitude': '🧠'
    };
    return icons[courseName] || '📚';
}

async function viewCourseLectures(courseId, courseName) {
    console.log('Viewing lectures for:', courseName);
    // TODO: Implement lecture viewing UI
    alert(`Loading lectures for ${courseName}...`);
}

window.viewCourseLectures = viewCourseLectures;

async function loadMaterials() {
    console.log("Loading materials to update cards...");
    
    // Get all the card 'p' tags
    const countElements = {
        'Remote Sensing': document.getElementById('materialCount-RS'),
        'Geographic Information System (GIS)': document.getElementById('materialCount-GIS'),
        'Image Processing': document.getElementById('materialCount-IP'),
        'Global Positioning System (GPS)': document.getElementById('materialCount-GPS'),
        'Surveying': document.getElementById('materialCount-SUR'),
        'Engineering Mathematics': document.getElementById('materialCount-MATH'),
        'General Aptitude': document.getElementById('materialCount-GA'),
        // Add any other subjects here
    };

    // This is the container *below* the cards
    const materialsListContainer = document.getElementById('materialsContainer');
    materialsListContainer.innerHTML = ''; // Clear the list container

    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // 1. Call your backend
        const materialsData = await makeAuthenticatedRequest('/materials'); 
        
        if (!materialsData.success || !materialsData.data) {
            throw new Error('Failed to load materials data');
        }

        const allMaterials = materialsData.data;

        // 2. Group materials by subject
        const materialsBySubject = {};
        
        // Initialize counts for all subjects
        Object.keys(countElements).forEach(subject => {
            materialsBySubject[subject] = [];
        });

        allMaterials.forEach((material) => {
            const subject = material.subject || 'Other';
            if (!materialsBySubject[subject]) {
                materialsBySubject[subject] = [];
            }
            materialsBySubject[subject].push(material);
        });

        // 3. Update the static "Loading..." cards
        Object.keys(countElements).forEach(subject => {
            const countEl = countElements[subject];
            if (countEl) {
                const count = materialsBySubject[subject] ? materialsBySubject[subject].length : 0;
                if (count > 0) {
                    countEl.textContent = `${count} ${count === 1 ? 'Material' : 'Materials'}`;
                    countEl.style.color = 'var(--success-color)'; // Make it green
                } else {
                    countEl.textContent = 'No Materials';
                    countEl.style.color = 'var(--text-light)'; // Make it grey
                }
            }
        });

        // 4. Build the *full list* in the container below the cards
        if (allMaterials.length === 0) {
            materialsListContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="color: var(--text-light); font-size: 18px; margin-bottom: 16px;">📚 Study Materials Coming Soon</p>
                    <p style="color: var(--text-light); margin-bottom: 24px;">We're uploading study materials. Check back soon!</p>
                </div>
            `;
            return;
        }
        
        let materialsHTML = '';
        Object.keys(materialsBySubject).forEach(subject => {
            const materials = materialsBySubject[subject];
            if (materials.length === 0) return; // Don't show empty subjects in the list

            const subjectIcon = getCourseIcon(subject); 
            
            materialsHTML += `
                <div style="margin-bottom: 32px;">
                    <h3 style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 22px;">
                        <span style="font-size: 32px;">${subjectIcon}</span>
                        ${subject}
                    </h3>
                    <div style="display: grid; gap: 12px;">
            `;
            
            materials.forEach(material => {
                // Calculate file size
                let fileSize = '...';
                if (material.size) {
                    fileSize = (material.size / (1024 * 1024)).toFixed(2) + ' MB';
                }

                materialsHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 4px;">${material.title}</div>
                            <div style="font-size: 14px; color: var(--text-light);">
                                ${material.type || 'PDF'} • ${fileSize}
                                ${material.access === 'free' ? ' • <span style="color: var(--success-color);">Free</span>' : ''}
                            </div>
                        </div>
                        <div>
                            ${material.hasAccess 
                                ? `<button class="btn btn-sm btn-primary" onclick="downloadMaterial(this, '${material.id}')">📥 Download</button>`
                                : `<button class="btn btn-sm btn-secondary" disabled>🔒 Locked</button>`
                            }
                        </div>
                    </div>
                `;
            });
            
            materialsHTML += `</div></div>`;
        });
        
        materialsListContainer.innerHTML = materialsHTML;
        
    } catch (error) {
        console.error('Error loading materials:', error);
        // Show error in the main list container
        showError('materialsContainer', 'Failed to load study materials');
        
        // Also show error in the cards
        Object.values(countElements).forEach(el => {
            if (el) {
                el.textContent = 'Error';
                el.style.color = 'var(--error-color)';
            }
        });
    }
}

async function downloadMaterial(button, materialId) {
    if (!button || !materialId) return;

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-small"></span>'; // Show loading spinner

    try {
        // Import the auth request function
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // 1. Call the new backend endpoint
        // (Remember, makeAuthenticatedRequest already adds the /api prefix)
        const response = await makeAuthenticatedRequest(`/material/${materialId}/download`);

        if (response.success && response.data.downloadUrl) {
            // 2. Open the *real* signed URL from the backend
            window.open(response.data.downloadUrl, '_blank');
        } else {
            throw new Error(response.error || 'No download URL returned');
        }

    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to get download link. Please try again.');
    } finally {
        // 3. Restore the button
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

// Make sure it's still globally accessible
window.downloadMaterial = downloadMaterial;

async function loadTests() {
    const testsContainer = document.getElementById('testsContainer');
    const subjectCards = {
        'Remote Sensing': document.getElementById('testCount-RS'),
        'Geographic Information System (GIS)': document.getElementById('testCount-GIS'),
        'Image Processing': document.getElementById('testCount-IP'),
        'Global Positioning System (GPS)': document.getElementById('testCount-GPS'),
        'Surveying': document.getElementById('testCount-SUR'),
        'Engineering Mathematics': document.getElementById('testCount-MATH'),
        'General Aptitude': document.getElementById('testCount-GA')
    };
    const attemptedSpans = {
         'Remote Sensing': document.getElementById('testAttempted-RS'),
         'Geographic Information System (GIS)': document.getElementById('testAttempted-GIS'),
         'Image Processing': document.getElementById('testAttempted-IP'),
         'Global Positioning System (GPS)': document.getElementById('testAttempted-GPS'),
         'Surveying': document.getElementById('testAttempted-SUR'),
         'Engineering Mathematics': document.getElementById('testAttempted-MATH'),
         'General Aptitude': document.getElementById('testAttempted-GA')
    };

    showLoading('testsContainer');
    Object.values(subjectCards).forEach(el => el ? el.textContent = 'Loading...' : null);
    Object.values(attemptedSpans).forEach(el => el ? el.textContent = '...' : null);

    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');

        // ✅ FEATURE 1: Fetch user's attempts to check which tests are attempted
        const attemptsResponse = await makeAuthenticatedRequest('/user/test-attempts');
        const userAttempts = attemptsResponse.success ? attemptsResponse.data : [];
        const attemptedTestIds = userAttempts.map(a => a.testId);

        // Fetch all tests
        const response = await makeAuthenticatedRequest('/tests');

        if (!response.success || !Array.isArray(response.data)) {
            throw new Error(response.error || 'Failed to load tests or invalid data format');
        }

        let allTests = response.data;
        
        // ✅ Mark tests as attempted
        allTests = allTests.map(test => ({
            ...test,
            isAttempted: attemptedTestIds.includes(test.id)
        }));

        // Group tests by subject and count totals/attempted
        const testsBySubject = {};
        const subjectCounts = {};

        Object.keys(subjectCards).forEach(subject => {
            subjectCounts[subject] = { total: 0, attempted: 0 };
            testsBySubject[subject] = [];
        });

        allTests.forEach((test) => {
            const subject = test.subject || 'General';
            if (!testsBySubject[subject]) {
                testsBySubject[subject] = [];
                subjectCounts[subject] = { total: 0, attempted: 0 };
            }
            testsBySubject[subject].push(test);
            subjectCounts[subject].total++;
            if (test.isAttempted) {
                subjectCounts[subject].attempted++;
            }
        });

        // Update Subject Card Counts
        Object.keys(subjectCards).forEach(subject => {
            const countEl = subjectCards[subject];
            const attemptedEl = attemptedSpans[subject];
            const counts = subjectCounts[subject];

            if (countEl) {
                countEl.textContent = `${counts.total} ${counts.total === 1 ? 'test' : 'tests'}`;
            }
            if (attemptedEl) {
                attemptedEl.textContent = `${counts.attempted} attempted`;
            }
        });

        // Build Tests List HTML
        if (allTests.length === 0) {
            testsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="color: var(--text-light); font-size: 18px; margin-bottom: 16px;">📝 Practice Tests Coming Soon</p>
                    <p style="color: var(--text-light); margin-bottom: 24px;">We're preparing test series. Check back soon!</p>
                </div>
            `;
            return;
        }

        let testsHTML = '';
        Object.keys(testsBySubject).sort().forEach(subject => {
            const tests = testsBySubject[subject];
            if (tests.length === 0) return;

            const subjectIcon = getCourseIcon(subject);

            testsHTML += `
                <div style="margin-bottom: 32px;" class="test-subject-group" data-subject="${escapeHtml(subject)}">
                    <h3 style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 22px; color: var(--text-dark);">
                        <span style="font-size: 32px;">${subjectIcon}</span>
                        ${escapeHtml(subject)} Tests
                    </h3>
                    <div style="display: grid; gap: 12px;">
            `;

            tests.forEach(test => {
                const accessLabel = test.access === 'free' ? ' • <span style="color: var(--success-color);">Free</span>' : '';

                testsHTML += `
                    <div class="test-list-item ${test.isAttempted ? 'attempted' : ''}" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: white; border-radius: 8px; box-shadow: var(--shadow-sm);">
                        <div style="flex: 1; margin-right: 16px;">
                            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-dark);">${escapeHtml(test.title)}</div>
                            <div style="font-size: 14px; color: var(--text-light);">
                                ${test.totalQuestions || 0} Questions • ${test.duration || '?'} Min • ${test.totalMarks || '?'} Marks
                                ${accessLabel}
                                ${test.isAttempted ? ' • <span style="color: var(--secondary-color); font-weight: 500;">✓ Already Attempted</span>' : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                           ${test.isAttempted 
                                ? `<button class="btn btn-sm btn-outline" onclick="viewLeaderboardForTest('${test.id}')">View Leaderboard</button>` 
                                : ''
                           }
                           ${test.hasAccess
                                ? `<button class="btn btn-sm btn-primary test-start-btn" onclick="startTest('${test.id}', '${escapeHtml(test.title)}')" ${test.isAttempted ? '' : ''}>▶️ ${test.isAttempted ? 'Re-attempt' : 'Start Test'}</button>`
                                : `<button class="btn btn-sm btn-secondary" disabled title="Upgrade required">🔒 Locked</button>`
                           }
                        </div>
                    </div>
                `;
            });

            testsHTML += `
                    </div>
                </div>
            `;
        });

        testsContainer.innerHTML = testsHTML;
        setupTestFilters();

    } catch (error) {
        console.error('❌ Error loading tests:', error);
        showError('testsContainer', `Failed to load practice tests: ${error.message || error}`);
        Object.values(subjectCards).forEach(el => el ? el.textContent = 'Error' : null);
        Object.values(attemptedSpans).forEach(el => el ? el.textContent = 'Error' : null);
    }
}

// --- Placeholder for fetching attempted tests ---
// Replace this with an actual API call to your backend
async function fetchUserAttemptedtests() {
    console.log("Fetching attempted test IDs...");
    try {
        // Example: const response = await makeAuthenticatedRequest('/user/test-attempts');
        // return response.data || []; // Assuming backend returns { success: true, data: ["testId1", "testId2"] }
        return ['testIdPlaceholder1', 'testIdPlaceholder2']; // Return placeholder IDs for now
    } catch (error) {
        console.error("Failed to fetch attempted tests:", error);
        return []; // Return empty array on error
    }
}
// --- End Placeholder ---


// --- Test Filter Logic ---
function setupTestFilters() {
    const filterButtons = document.querySelectorAll('.test-filter-btn');
    const testsContainer = document.getElementById('testsContainer');
    const allTestItems = testsContainer.querySelectorAll('.test-list-item'); // Get individual test items
    const allSubjectGroups = testsContainer.querySelectorAll('.test-subject-group'); // Get subject groups

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button style
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filterType = button.getAttribute('data-filter');

            allSubjectGroups.forEach(group => {
                 let groupHasVisibleTests = false;
                 group.querySelectorAll('.test-list-item').forEach(item => {
                     let show = false;
                     const isFree = item.querySelector('span[style*="color: var(--success-color)"]'); // Check if free label exists

                     if (filterType === 'all') {
                         show = true;
                     } else if (filterType === 'free') {
                         show = !!isFree; // Show only if the free label exists
                     } else if (filterType === 'subject') {
                         // This filter might be better handled by selecting a specific subject card
                         // For now, let's assume 'subject' means non-mock tests
                         const testTitle = item.querySelector('div[style*="font-weight: 600"]').textContent.toLowerCase();
                         show = !testTitle.includes('mock'); // Simple check, adjust if needed
                     } else if (filterType === 'mock') {
                         const testTitle = item.querySelector('div[style*="font-weight: 600"]').textContent.toLowerCase();
                         show = testTitle.includes('mock'); // Show if title contains 'mock'
                     }

                     item.style.display = show ? 'flex' : 'none';
                     if(show) groupHasVisibleTests = true;
                 });
                 // Hide the entire subject group (including title) if no tests within it match the filter
                 group.style.display = groupHasVisibleTests ? 'block' : 'none';
            });
        });
    });
}
// --- End Filter Logic ---


// --- Placeholder for Viewing Results ---
function viewTestResult(testId) {
    console.log("Viewing result for test:", testId);
    alert(`Functionality to view results for test ${testId} will be added here.`);
    // TODO: Implement result viewing UI (maybe fetch result from backend using testId and userId)
}
window.viewTestResult = viewTestResult;
// --- End Placeholder ---

// ============================================
// TEST INTERFACE STATE VARIABLES
// ============================================
let currentTest = null;         // Stores the full test data (questions, details)
let currentQuestionIndex = 0;   // Index of the question currently displayed
let studentAnswers = {};        // Stores student's answers { questionIndex: answer }
let questionStatus = [];        // Stores status ('not-visited', 'not-answered', 'answered', 'marked', 'answered-marked')
let testTimerInterval = null;   // Holds the interval ID for the timer
let timeLeft = 0;               // Time remaining in seconds
let testStartTime = null;       // Timestamp when the test started
let natKeyboard = null;         // Instance of the virtual keyboard

// ============================================
// TEST INTERFACE FUNCTIONS
// ============================================

/**
 * Initiates the test process when a "Start Test" button is clicked in the list.
 * Fetches test data and shows the instructions modal.
 * @param {string} testId - The ID of the test to start.
 * @param {string} testTitle - The title of the test.
 */
async function startTest(testId, testTitle) {
    console.log(`🚀 Attempting to start test: ${testId} - ${testTitle}`);

    // ✅ FEATURE 1: Check if already attempted
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        const checkResponse = await makeAuthenticatedRequest(`/tests/${testId}/check-attempt`);
        
        if (checkResponse.success && checkResponse.data.attempted) {
            alert('⚠️ You have already attempted this test. You can view the leaderboard instead.');
            return;
        }
    } catch (checkError) {
        console.warn('Could not check attempt status:', checkError);
        // Continue anyway if check fails
    }
    
    // Show loading on the container
    const testsContainer = document.getElementById('testsContainer');
    if (testsContainer) {
        testsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div class="spinner"></div>
                <p style="color: var(--text-light); margin-top: 16px;">Loading test...</p>
            </div>
        `;
    }

    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        console.log('📡 Making request to backend...');
        
        // Fetch full test details, including questions, from the backend
        const response = await makeAuthenticatedRequest(`/tests/${testId}`);
        
        console.log('📦 Response received:', response);

        // Check if response is successful
        if (!response || !response.success) {
            const errorMsg = response?.error || response?.message || 'Failed to load test data.';
            throw new Error(errorMsg);
        }

        // Check if we have data
        if (!response.data) {
            throw new Error('No test data received from server');
        }

        // Check if test has questions
        if (!response.data.questions || response.data.questions.length === 0) {
            throw new Error('This test has no questions');
        }

        currentTest = response.data; // Store the full test data globally
        currentQuestionIndex = 0;    // Reset question index
        studentAnswers = {};         // Clear previous answers
        questionStatus = new Array(currentTest.questions.length).fill('not-visited'); // Reset status

        console.log(`✅ Test loaded successfully: ${currentTest.questions.length} questions`);

        // --- Populate Instructions Modal ---
        document.getElementById('instructionsTestTitle').textContent = `Instructions - ${currentTest.title || 'Test'}`;
        document.getElementById('instructionsDuration').textContent = currentTest.duration || '--';

        // Populate marking scheme
        const markingSchemeDiv = document.getElementById('testMarkingScheme');
        let mcq1 = 0, mcq2 = 0, msq1 = 0, msq2 = 0, nat1 = 0, nat2 = 0;
        let totalQuestions = currentTest.questions.length;
        
        currentTest.questions.forEach(q => {
            if (q.type === 'mcq') { 
                if (q.marks === 1) mcq1++; 
                else mcq2++; 
            } else if (q.type === 'msq') { 
                if (q.marks === 1) msq1++; 
                else msq2++; 
            } else if (q.type === 'numerical') { 
                if (q.marks === 1) nat1++; 
                else nat2++; 
            }
        });

        markingSchemeDiv.innerHTML = `
            <p>This test contains a total of <strong>${totalQuestions}</strong> questions for <strong>${currentTest.totalMarks || '--'}</strong> marks.</p>
            <ul>
                ${mcq1 > 0 ? `<li>MCQ (1 Mark): ${mcq1} questions (+1 / -${(1/3).toFixed(2)})</li>` : ''}
                ${mcq2 > 0 ? `<li>MCQ (2 Marks): ${mcq2} questions (+2 / -${(2/3).toFixed(2)})</li>` : ''}
                ${msq1 > 0 ? `<li>MSQ (1 Mark): ${msq1} questions (+1 / 0)</li>` : ''}
                ${msq2 > 0 ? `<li>MSQ (2 Marks): ${msq2} questions (+2 / 0)</li>` : ''}
                ${nat1 > 0 ? `<li>NAT (1 Mark): ${nat1} questions (+1 / 0)</li>` : ''}
                ${nat2 > 0 ? `<li>NAT (2 Marks): ${nat2} questions (+2 / 0)</li>` : ''}
            </ul>
            <p><strong>Note:</strong> For MSQ questions, partial credit might apply based on options selected (full marks only if all correct options and no incorrect options are chosen).</p>
        `;

        // Reset and show instructions modal
        document.getElementById('instructionsAcknowledge').checked = false;
        document.getElementById('startTestButton').disabled = true;
        
        // Reload the tests list (clear loading)
        loadTests();
        
        // Show instructions modal
        openModal('testInstructionsModal');

    } catch (error) {
        console.error('❌ Error starting test:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        // Show error in the container
        if (testsContainer) {
            testsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="color: var(--error-color); margin-bottom: 16px;">⚠️ ${error.message}</p>
                    <button class="btn btn-secondary" onclick="loadTests()">Try Again</button>
                </div>
            `;
        }
        
        // Also show an alert for visibility
        alert(`Could not start test: ${error.message}`);
    }
}
window.startTest = startTest; // Make it accessible globally

function initializeTestInterface() {
    console.log('🚀 Initializing Test Interface...');
    if (!currentTest) {
        console.error("❌ Cannot initialize test interface: currentTest data is missing.");
        alert("Error: Test data not loaded. Please try starting the test again.");
        return;
    }

    closeModal('testInstructionsModal');

    // Hide the main app container
    const appContainer = document.querySelector('#app-view .app-container');
    if (appContainer) {
        appContainer.style.display = 'none';
        console.log("Hiding main app container.");
    } else {
        console.error("❌ Could not find .app-container inside #app-view during init!");
        const contentEl = document.getElementById('content');
        const sidebarEl = document.getElementById('sidebar');
        if (contentEl) contentEl.style.display = 'none';
        if (sidebarEl) sidebarEl.style.display = 'none';
    }

    // Show the test interface
    const testInterface = document.getElementById('test-interface');
    if (testInterface) {
        testInterface.style.display = 'flex';
        console.log("Showing test interface.");
    } else {
        console.error("❌ Could not find #test-interface! Check HTML structure.");
        alert("Fatal Error: Test interface element is missing. Cannot proceed.");
        if (appContainer) appContainer.style.display = '';
        return;
    }

    // Populate header - UPDATED IDs
    const gateTestNameEl = document.getElementById('gateTestName');
    if (gateTestNameEl) {
        gateTestNameEl.textContent = currentTest.title || 'Practice Test';
    } else {
        console.warn("Element with ID 'gateTestName' not found.");
    }

    // Populate user details in test interface - UPDATED IDs
    const gateUserPhotoEl = document.getElementById('gateUserPhoto');
    const gateUserNameEl = document.getElementById('gateUserName');
    const sidebarUserAvatarEl = document.getElementById('sidebarUserAvatar');
    const sidebarUserNameEl = document.getElementById('sidebarUserName');

    if (gateUserPhotoEl && sidebarUserAvatarEl) {
        gateUserPhotoEl.src = sidebarUserAvatarEl.src;
    } else {
        console.warn("Could not find gateUserPhoto or sidebarUserAvatar elements.");
    }
    if (gateUserNameEl && sidebarUserNameEl) {
        gateUserNameEl.textContent = sidebarUserNameEl.textContent || 'Student';
    } else {
        console.warn("Could not find gateUserName or sidebarUserName elements.");
        if(gateUserNameEl) gateUserNameEl.textContent = 'Student';
    }

    // Build Question Palette - UPDATED IDs and classes
    const palette = document.getElementById('gatePaletteGrid');
    if (palette) {
        palette.innerHTML = '';
        if (currentTest.questions && currentTest.questions.length > 0) {
            for (let i = 0; i < currentTest.questions.length; i++) {
                const button = document.createElement('button');
                button.className = 'gate-palette-btn gate-not-visited'; // NEW class names
                button.textContent = i + 1;
                button.onclick = () => handlePaletteClick(i);
                palette.appendChild(button);
            }
        } else {
             palette.innerHTML = '<p>No questions found in test data.</p>';
             console.error("❌ No questions found in currentTest.questions array.");
        }
    } else {
        console.error("❌ Element with ID 'gatePaletteGrid' not found!");
    }

    // Set up timer
    timeLeft = (currentTest.duration || 60) * 60;
    startTimer();
    testStartTime = Date.now();

    // Load the first question
    if (currentTest.questions && currentTest.questions.length > 0) {
        loadQuestion(0);
    } else {
        const questionContent = document.getElementById('gateQuestionContent');
        if(questionContent) {
            questionContent.innerHTML = '<p style="text-align: center; color: var(--error-color); padding: 20px;">Error: No questions loaded for this test.</p>';
        }
        document.getElementById('gateSaveNextBtn')?.setAttribute('disabled', 'true');
        document.getElementById('gateMarkReviewBtn')?.setAttribute('disabled', 'true');
        document.getElementById('gateClearBtn')?.setAttribute('disabled', 'true');
    }

    console.log('✅ Test Interface Initialized.');
}

/**
 * Loads and displays a specific question by its index.
 * @param {number} questionIndex - The index of the question to load.
 */
function loadQuestion(questionIndex) {
    if (!currentTest || questionIndex < 0 || questionIndex >= currentTest.questions.length) {
        console.error(`❌ Invalid question index: ${questionIndex}`);
        return;
    }

    currentQuestionIndex = questionIndex;
    const question = currentTest.questions[questionIndex];

    console.log('📖 Loading question:', questionIndex, question); // Debug log

    // Update header info
    document.getElementById('gateQuestionNumber').textContent = questionIndex + 1;
    document.getElementById('gateQuestionType').textContent = question.type.toUpperCase();
    document.getElementById('gateQuestionMarks').textContent = `+${question.marks || '?'}`;
    document.getElementById('gateQuestionNegative').textContent = `-${question.negativeMarks?.toFixed(2) || '0.00'}`;
    
    // Update section names
    let sectionName = question.section || 'General Aptitude';
    if (sectionName === 'General Aptitude') {
        sectionName = 'General';
    }
    document.getElementById('gateCurrentSection').textContent = sectionName;
    document.getElementById('gatePaletteSection').textContent = sectionName;

    // Update question content
    const questionContent = document.getElementById('gateQuestionContent');
    
    // 🆕 BUILD QUESTION HTML WITH IMAGE SUPPORT
    let questionHTML = `<div class="question-text">${question.question || 'Question text missing.'}</div>`;
    
    // 🆕 ADD IMAGE IF PRESENT
    if (question.imageUrl) {
        console.log('🖼️ Question has image:', question.imageUrl);
        questionHTML += `
            <div style="margin-top: 20px; text-align: center;">
                <img src="${question.imageUrl}" 
                    alt="Question Image" 
                    style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #e0e0e0; cursor: zoom-in; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" 
                    onclick="window.open('${question.imageUrl}', '_blank')"
                    onerror="console.error('Failed to load image:', '${question.imageUrl}')">
                <p style="font-size: 12px; color: var(--text-light); margin-top: 8px; font-style: italic;">📌 Click image to view full size in new tab</p>
            </div>
        `;
    } else {
        console.log('ℹ️ No image for this question'); // Debug log
    }
    
    questionContent.innerHTML = questionHTML;

    // Get the options container
    const optionsContainer = document.getElementById('gateAnswerOptions');
    optionsContainer.innerHTML = '';

    // Render answer options based on type
    const savedAnswer = studentAnswers[questionIndex];

    if (question.type === 'mcq') {
        optionsContainer.innerHTML = renderMCQOptions(question.options, questionIndex, savedAnswer);
        hideNatKeyboard();
    } else if (question.type === 'msq') {
        optionsContainer.innerHTML = renderMSQOptions(question.options, questionIndex, savedAnswer);
        hideNatKeyboard();
    } else if (question.type === 'numerical') {
        renderNATInput(questionIndex, savedAnswer);
    } else if (question.type === 'true-false') {
        optionsContainer.innerHTML = renderTrueFalseOptions(questionIndex, savedAnswer);
        hideNatKeyboard();
    } else {
        optionsContainer.innerHTML = '<p>Unsupported question type.</p>';
        hideNatKeyboard();
    }

    // Apply MathJax rendering
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        MathJax.typesetPromise([questionContent, optionsContainer]).catch((err) => console.error('MathJax Error:', err));
    }

    // Update status
    if (questionStatus[questionIndex] === 'not-visited') {
        updatePaletteStatus(questionIndex, 'not-answered');
    } else {
        updatePaletteStatus(questionIndex, questionStatus[questionIndex]);
    }
}

/**
 * Renders HTML for MCQ options.
 */
function renderMCQOptions(options, questionIndex, savedAnswer) {
    let html = '';
    const optionKeys = ['A', 'B', 'C', 'D'];
    
    optionKeys.forEach(key => {
        if (options && options[key]) {
            const isChecked = savedAnswer === key;
            const uniqueId = `q${questionIndex}_opt_${key}`;
            html += `
                <div class="gate-option-item" onclick="document.getElementById('${uniqueId}').click()" style="cursor: pointer;">
                    <input type="radio" 
                           id="${uniqueId}" 
                           name="q_${questionIndex}_mcq" 
                           value="${key}" 
                           class="gate-radio-input"
                           ${isChecked ? 'checked' : ''}
                           onclick="event.stopPropagation();">
                    <label for="${uniqueId}" class="gate-option-label" style="cursor: pointer; flex: 1;">
                        <span class="gate-option-letter">${key}</span>
                        <span class="gate-option-text">${escapeHtml(options[key])}</span>
                    </label>
                </div>
            `;
        }
    });
    return html;
}


/**
 * Renders HTML for MSQ options.
 */
function renderMSQOptions(options, questionIndex, savedAnswers) {
    let html = '';
    const optionKeys = ['A', 'B', 'C', 'D'];
    const savedSet = new Set(savedAnswers || []);
    
    optionKeys.forEach(key => {
        if (options && options[key]) {
            const isChecked = savedSet.has(key);
            const uniqueId = `q${questionIndex}_opt_${key}`;
            html += `
                <div class="gate-option-item" onclick="document.getElementById('${uniqueId}').click()" style="cursor: pointer;">
                    <input type="checkbox" 
                           id="${uniqueId}" 
                           name="q_${questionIndex}_msq" 
                           value="${key}" 
                           class="gate-checkbox-input"
                           ${isChecked ? 'checked' : ''}
                           onclick="event.stopPropagation();">
                    <label for="${uniqueId}" class="gate-option-label" style="cursor: pointer; flex: 1;">
                        <span class="gate-option-letter">${key}</span>
                        <span class="gate-option-text">${escapeHtml(options[key])}</span>
                    </label>
                </div>
            `;
        }
    });
    return html;
}

/**
 * Renders HTML for True/False options.
 */
function renderTrueFalseOptions(questionIndex, savedAnswer) {
    const isTrueChecked = savedAnswer === true;
    const isFalseChecked = savedAnswer === false;
    return `
        <label class="mcq-option">
            <input type="radio" name="q_${questionIndex}_tf" value="true" ${isTrueChecked ? 'checked' : ''}>
            <span class="option-key">A)</span> <span class="option-text">True</span>
        </label>
        <label class="mcq-option">
            <input type="radio" name="q_${questionIndex}_tf" value="false" ${isFalseChecked ? 'checked' : ''}>
            <span class="option-key">B)</span> <span class="option-text">False</span>
        </label>
    `;
}

/**
 * Sets up the NAT input display and initializes/shows the virtual keyboard.
 */
function renderNATInput(questionIndex, savedAnswer) {
    const natContainer = document.getElementById('gateNATContainer');
    const natDisplay = document.getElementById('gateNATInput');
    
    // Set initial value
    const initialValue = savedAnswer !== undefined && savedAnswer !== null ? String(savedAnswer) : '';
    natDisplay.value = initialValue;
    natContainer.style.display = 'block';

    // Initialize Simple-Keyboard if not already done
    if (!natKeyboard) {
        natKeyboard = new window.SimpleKeyboard.default("#gateNATKeyboard", { // ✅ FIXED - removed the dot
            onChange: input => {
                natDisplay.value = input;
                console.log('NAT Input Changed:', input);
            },
            onKeyPress: button => handleNatKeyPress(button),
            layout: {
                default: [
                    "7 8 9",
                    "4 5 6",
                    "1 2 3",
                    "0 . - {bksp}"
                ]
            },
            display: {
                '{bksp}': '←'
            },
            preventMouseDownDefault: true
        });
        console.log('✅ NAT Keyboard initialized');
    } else {
        natKeyboard.setInput(initialValue);
    }
}

/**
 * Hides the NAT virtual keyboard container.
 */
function hideNatKeyboard() {
    const natContainer = document.getElementById('gateNATContainer'); // UPDATED ID
    if (natContainer) {
        natContainer.style.display = 'none';
    }
}

/**
 * Handles special key presses on the NAT keyboard (like backspace).
 */
function handleNatKeyPress(button) {
    const natDisplay = document.getElementById('gateNATInput');
    console.log('Key Pressed:', button, 'Current Value:', natDisplay.value); // Debug log
    
    if (button === "{bksp}") {
        // Backspace is handled by onChange
        console.log('Backspace pressed');
    }
    
    // Sync keyboard with display after any key press
    if (natKeyboard) {
        natKeyboard.setInput(natDisplay.value);
    }
}

/**
 * Saves the current answer and moves to the next question.
 */
function handleSaveAndNext() {
    const saved = saveCurrentAnswer();
    // Update status only if an answer was actually entered/selected
    if (saved) {
         updatePaletteStatus(currentQuestionIndex, 'answered');
    } else if (questionStatus[currentQuestionIndex] !== 'marked') {
         // If nothing saved and not marked, it's 'not-answered'
        updatePaletteStatus(currentQuestionIndex, 'not-answered');
    }

    if (currentQuestionIndex < currentTest.questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        // Last question reached
        showTestNotification("You have reached the last question. Review using the palette or submit.");
    }
}

/**
 * Marks the current question for review and moves to the next question.
 */
function handleMarkForReview() {
    const saved = saveCurrentAnswer(); // Save answer if selected
    const currentStatus = questionStatus[currentQuestionIndex];

    if (saved || currentStatus === 'answered' || currentStatus === 'answered-marked') {
        updatePaletteStatus(currentQuestionIndex, 'answered-marked');
    } else {
        updatePaletteStatus(currentQuestionIndex, 'marked');
    }

    if (currentQuestionIndex < currentTest.questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        showTestNotification("You have reached the last question. Review using the palette or submit.");
    }
}

/**
 * Clears the selected/entered response for the current question.
 */
function handleClearResponse() {
    const question = currentTest.questions[currentQuestionIndex];
    if (question.type === 'mcq' || question.type === 'true-false') {
        document.querySelectorAll(`input[name="q_${currentQuestionIndex}_mcq"], input[name="q_${currentQuestionIndex}_tf"]`).forEach(rb => rb.checked = false);
    } else if (question.type === 'msq') {
        document.querySelectorAll(`input[name="q_${currentQuestionIndex}_msq"]`).forEach(cb => cb.checked = false);
    } else if (question.type === 'numerical') {
        const natDisplay = document.getElementById('gateNATInput'); // UPDATED ID
        natDisplay.value = '';
        if (natKeyboard) natKeyboard.clearInput();
    }
    delete studentAnswers[currentQuestionIndex];

    if(questionStatus[currentQuestionIndex] !== 'not-visited') {
       updatePaletteStatus(currentQuestionIndex, 'not-answered');
    }
    console.log(`Cleared response for Q${currentQuestionIndex + 1}`);
}

/**
 * Handles clicks on the question palette buttons.
 * Saves the current answer before navigating.
 */
function handlePaletteClick(questionIndex) {
    if (questionIndex === currentQuestionIndex) return; // Clicked on the current question

    // IMPORTANT: Save answer of the *previous* question before jumping
    saveCurrentAnswer();
     // Update status of previous question based on whether something was saved
    if (studentAnswers.hasOwnProperty(currentQuestionIndex)) {
        if(questionStatus[currentQuestionIndex] !== 'answered-marked' && questionStatus[currentQuestionIndex] !== 'marked') {
             updatePaletteStatus(currentQuestionIndex, 'answered');
        }
    } else {
         if(questionStatus[currentQuestionIndex] === 'answered' || questionStatus[currentQuestionIndex] === 'answered-marked') {
            // If answer was cleared just before palette click, update status
             updatePaletteStatus(currentQuestionIndex, questionStatus[currentQuestionIndex] === 'answered-marked' ? 'marked' : 'not-answered');
         } else if (questionStatus[currentQuestionIndex] !== 'marked' && questionStatus[currentQuestionIndex] !== 'not-visited') {
              updatePaletteStatus(currentQuestionIndex, 'not-answered');
         }
    }


    loadQuestion(questionIndex);
}

/**
 * Saves the answer for the currently displayed question.
 * Reads the value from the appropriate input (radio, checkbox, text).
 * Returns true if an answer was saved, false otherwise.
 */
function saveCurrentAnswer() {
    const question = currentTest.questions[currentQuestionIndex];
    let answer = null;
    let saved = false;

    if (question.type === 'mcq' || question.type === 'true-false') {
        const selected = document.querySelector(`input[name="q_${currentQuestionIndex}_mcq"]:checked, input[name="q_${currentQuestionIndex}_tf"]:checked`);
        if (selected) {
            answer = selected.value;
            if (question.type === 'true-false') {
                 answer = (answer === 'true');
            }
            saved = true;
        }
    } else if (question.type === 'msq') {
        const selected = Array.from(document.querySelectorAll(`input[name="q_${currentQuestionIndex}_msq"]:checked`)).map(cb => cb.value);
        if (selected.length > 0) {
            answer = selected;
            saved = true;
        }
    } else if (question.type === 'numerical') {
        const natDisplay = document.getElementById('gateNATInput');
        const inputValue = natDisplay.value.trim();
        
        console.log('Saving NAT Answer:', inputValue); // Debug log
        
        if (inputValue !== '') {
            if (/^-?\d*(\.\d+)?$/.test(inputValue) && inputValue !== '-' && inputValue !== '.') {
                answer = inputValue;
                saved = true;
                console.log('✅ NAT Answer Valid:', answer); // Debug log
            } else {
                console.warn(`❌ Invalid numerical input: "${inputValue}"`); // Debug log
            }
        } else {
            console.log('ℹ️ NAT Answer is empty'); // Debug log
        }
    }

    if (saved) {
        studentAnswers[currentQuestionIndex] = answer;
        console.log(`Saved answer for Q${currentQuestionIndex + 1}:`, answer);
    } else {
        delete studentAnswers[currentQuestionIndex];
    }
    return saved;
}


/**
 * Updates the visual status (CSS class) of a question palette button.
 * @param {number} questionIndex - The index of the button.
 * @param {string} status - The new status ('not-visited', 'not-answered', 'answered', 'marked', 'answered-marked').
 */
function updatePaletteStatus(questionIndex, status) {
    const palette = document.getElementById('gatePaletteGrid'); // UPDATED ID
    const button = palette.children[questionIndex];
    if (!button) return;
    
    // Remove all status classes
    button.classList.remove('gate-answered', 'gate-not-answered', 'gate-not-visited', 
                           'gate-marked', 'gate-answered-marked');
    
    // Map old status names to new GATE class names
    const statusClassMap = {
        'answered': 'gate-answered',
        'not-answered': 'gate-not-answered',
        'not-visited': 'gate-not-visited',
        'marked': 'gate-marked',
        'answered-marked': 'gate-answered-marked'
    };
    
    const newClass = statusClassMap[status] || 'gate-not-visited';
    button.classList.add(newClass);
    
    // Handle checkmark for answered-marked status
    if (status === 'answered-marked') {
        if (!button.querySelector('.gate-check-icon')) {
            button.innerHTML = `
                <span>${questionIndex + 1}</span>
                <i class="fas fa-check gate-check-icon"></i>
            `;
        }
    } else {
        // Remove checkmark and restore plain number
        button.textContent = questionIndex + 1;
    }
    
    // Update global status array
    questionStatus[questionIndex] = status;
}

/**
 * Starts the test timer countdown.
 */
function startTimer() {
    if (testTimerInterval) clearInterval(testTimerInterval);

    const timerDisplay = document.getElementById('gateTimer'); // UPDATED ID

    updateTimerDisplay();

    testTimerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            handleTimeUp();
        }
    }, 1000);
}

/**
 * Updates the timer display (HH:MM:SS format).
 */
function updateTimerDisplay() {
    const timerDisplay = document.getElementById('gateTimer'); // UPDATED ID
    if (!timerDisplay) return;

    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    timerDisplay.textContent =
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Add warning class if time is low
    if (timeLeft <= 300) {
        timerDisplay.classList.add('low-time');
    } else {
        timerDisplay.classList.remove('low-time');
    }
}

/**
 * Handles the event when the timer runs out. Automatically submits the test.
 */
function handleTimeUp() {
    console.log("⏰ Time is up!");
    clearInterval(testTimerInterval);
    alert("Time is up! Your test will be submitted automatically.");
    // Force final save just in case
    saveCurrentAnswer();
    // Directly trigger final submission logic
    handleFinalSubmit(true); // Pass flag indicating auto-submit
}

/**
 * Stops the timer, saves the current answer, and shows the summary modal.
 */
function handleSubmitClick() {
    console.log("Submit button clicked. Showing summary...");
    clearInterval(testTimerInterval); // Stop the timer
    saveCurrentAnswer(); // Save the very last answer

    // --- Populate Summary Modal ---
    const summaryBody = document.getElementById('summaryTableBody');
    summaryBody.innerHTML = ''; // Clear previous summary

    let totalAnswered = 0;
    let totalNotAnswered = 0;
    let totalMarked = 0;
    let totalNotVisited = 0;
    let totalAnsweredMarked = 0;

    questionStatus.forEach((status, index) => {
        if (status === 'answered') totalAnswered++;
        else if (status === 'not-answered') totalNotAnswered++;
        else if (status === 'marked') totalMarked++;
        else if (status === 'not-visited') totalNotVisited++;
        else if (status === 'answered-marked') {
            totalAnsweredMarked++;
            totalAnswered++; // Count as answered for evaluation
            totalMarked++; // Also count as marked for review visibility
        }
    });

    // Create a summary row (can be more detailed with sections later)
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>All Sections</td>
        <td>${currentTest.questions.length}</td>
        <td>${totalAnswered}</td>
        <td>${totalNotAnswered}</td>
        <td>${totalMarked} (${totalAnsweredMarked} answered)</td>
        <td>${totalNotVisited}</td>
    `;
    summaryBody.appendChild(row);
    // --- End Populate Summary ---

    openModal('testSummaryModal');
}

/**
 * Sends the final answers to the backend for evaluation.
 * @param {boolean} [isAutoSubmit=false] - Flag indicating if triggered by timer.
 */
async function handleFinalSubmit(isAutoSubmit = false) {
    try {
        console.log("Submitting final answers... (Auto-submit:", isAutoSubmit, ")");

        if (!isAutoSubmit) {
            closeModal('testSummaryModal');
        }
        
        if (testTimerInterval) {
            clearInterval(testTimerInterval);
            testTimerInterval = null;
        }

        const timeTaken = currentTest.duration * 60 - timeLeft;

        showLoading('gate-question-panel');

        const { makeAuthenticatedRequest } = await import('./auth.js');

        const submissionData = {
            answers: studentAnswers,
            timeTaken: timeTaken,
            submittedAt: new Date().toISOString()
        };

        const response = await makeAuthenticatedRequest(`/tests/${currentTest.id}/submit`, {
            method: 'POST',
            body: JSON.stringify(submissionData)
        });

        if (!response.success) {
            throw new Error(response.message || "Failed to submit test");
        }

        const result = response.data;
        console.log("✅ Test submitted successfully. Result:", result);

        hideLoading('gate-question-panel');

        console.log("Opening result modal...");
        openModal('testResultModal');

        await new Promise(resolve => setTimeout(resolve, 100));

        console.log("Querying modal elements...");
        const scoreElement = document.getElementById('resultScore');
        const percentageElement = document.getElementById('resultPercentage');
        const correctElement = document.getElementById('resultCorrect');
        const wrongElement = document.getElementById('resultWrong');
        const unattemptedElement = document.getElementById('resultUnattempted');
        const timeElement = document.getElementById('resultTimeTaken');

        if (!scoreElement || !percentageElement || !correctElement || !wrongElement || !unattemptedElement || !timeElement) {
            console.error("❌ Missing modal elements!");
            
            alert(
                `Test Submitted Successfully!\n\n` +
                `Score: ${result.score} / ${currentTest.totalMarks}\n` +
                `Percentage: ${result.percentage?.toFixed(2)}%\n` +
                `Correct: ${result.correctAnswers}\n` +
                `Wrong: ${result.wrongAnswers}\n` +
                `Unattempted: ${result.unattempted}\n` +
                `Time: ${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`
            );
            
            exitTestInterface();
            return;
        }

        console.log("✅ Populating result modal...");
        scoreElement.textContent = `${result.score} / ${currentTest.totalMarks}`;
        percentageElement.textContent = `${result.percentage?.toFixed(2)}%`;
        correctElement.textContent = result.correctAnswers;
        wrongElement.textContent = result.wrongAnswers;
        unattemptedElement.textContent = result.unattempted;
        timeElement.textContent = `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`;
        
        // 🆕 ADD VIEW REVIEW BUTTON
        const modalActions = document.querySelector('#testResultModal .modal-actions');
        if (modalActions && !document.getElementById('viewReviewBtn')) {
            const reviewBtn = document.createElement('button');
            reviewBtn.id = 'viewReviewBtn';
            reviewBtn.className = 'btn btn-secondary btn-large';
            reviewBtn.textContent = '📋 View Detailed Review';
            reviewBtn.onclick = () => {
                closeModal('testResultModal');
                showTestReview(result.attemptId);
            };
            
            // Insert before the "Return to Dashboard" button
            const returnBtn = modalActions.querySelector('.btn-primary');
            if (returnBtn) {
                modalActions.insertBefore(reviewBtn, returnBtn);
            } else {
                modalActions.appendChild(reviewBtn);
            }
        }
        
        console.log("✅ Result modal populated successfully!");

    } catch (error) {
        console.error("❌ Final submission error:", error);
        alert(`Error submitting test: ${error.message}`);
        
        hideLoading('gate-question-panel');
        
        if (!isAutoSubmit && timeLeft > 0) {
            startTimer();
        }
    }
}

// ============================================
// TEST REVIEW FUNCTIONS - NEW
// ============================================

/**
 * Show detailed test review with questions, answers, and explanations
 */
async function showTestReview(attemptId) {
    console.log('📋 Loading test review for attempt:', attemptId);
    
    openModal('testReviewModal');
    
    const container = document.getElementById('reviewQuestionsContainer');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner"></div>
            <p style="color: var(--text-light); margin-top: 16px;">Loading review...</p>
        </div>
    `;
    
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // Fetch the detailed attempt with full questions
        const response = await makeAuthenticatedRequest(`/user/test-attempts/${attemptId}`);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load review');
        }
        
        const attemptData = response.data;
        const questions = attemptData.testQuestions || [];
        const studentAnswers = attemptData.answers || {};
        
        // Update modal title
        document.getElementById('reviewModalTitle').textContent = `Test Review: ${attemptData.testTitle}`;
        
        // Update summary cards
        document.getElementById('reviewScore').textContent = `${attemptData.score} / ${attemptData.totalMarks}`;
        document.getElementById('reviewCorrect').textContent = attemptData.correctAnswers;
        document.getElementById('reviewWrong').textContent = attemptData.wrongAnswers;
        document.getElementById('reviewUnattempted').textContent = attemptData.unattempted;
        
        // Build questions review HTML
        let reviewHTML = '';
        
        questions.forEach((question, index) => {
            const studentAnswer = studentAnswers[String(index)];
            reviewHTML += buildReviewQuestionHTML(question, studentAnswer, index);
        });
        
        if (reviewHTML === '') {
            reviewHTML = '<p style="text-align: center; color: var(--text-light);">No questions to review.</p>';
        }
        
        container.innerHTML = reviewHTML;
        
        // Render MathJax
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            MathJax.typesetPromise([container]).catch((err) => console.error('MathJax Error:', err));
        }
        
        console.log('✅ Test review loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading test review:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--error-color);">
                <p>⚠️ Failed to load review</p>
                <p style="font-size: 14px; margin-top: 8px;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Build HTML for a single question review
 */
function buildReviewQuestionHTML(question, studentAnswer, index) {
    const qType = question.type;
    let isCorrect = false;
    let statusText = 'Unattempted';
    let statusClass = 'unattempted';
    
    // Determine if answer is correct
    if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        if (qType === 'mcq' || qType === 'true-false') {
            isCorrect = studentAnswer === question.correctAnswer;
        } else if (qType === 'msq') {
            const correctSet = new Set(question.correctAnswers || []);
            const studentSet = new Set(Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]);
            isCorrect = correctSet.size === studentSet.size && [...correctSet].every(ans => studentSet.has(ans));
        } else if (qType === 'numerical') {
            const correctNum = parseFloat(question.correctAnswer);
            const tolerance = parseFloat(question.tolerance || 0);
            const studentNum = parseFloat(studentAnswer);
            isCorrect = !isNaN(studentNum) && Math.abs(studentNum - correctNum) <= tolerance;
        }
        
        statusText = isCorrect ? 'Correct' : 'Wrong';
        statusClass = isCorrect ? 'correct' : 'wrong';
    }
    
    // Format answers for display
    let yourAnswerText = 'Not attempted';
    let correctAnswerText = '';
    
    if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        if (qType === 'mcq') {
            yourAnswerText = `Option ${studentAnswer}: ${question.options[studentAnswer] || ''}`;
        } else if (qType === 'msq') {
            const answers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
            yourAnswerText = answers.map(ans => `${ans}: ${question.options[ans] || ''}`).join(', ');
        } else if (qType === 'numerical') {
            yourAnswerText = studentAnswer;
        } else if (qType === 'true-false') {
            yourAnswerText = studentAnswer === true ? 'True' : 'False';
        }
    }
    
    // Format correct answer
    if (qType === 'mcq') {
        correctAnswerText = `Option ${question.correctAnswer}: ${question.options[question.correctAnswer] || ''}`;
    } else if (qType === 'msq') {
        correctAnswerText = (question.correctAnswers || []).map(ans => `${ans}: ${question.options[ans] || ''}`).join(', ');
    } else if (qType === 'numerical') {
        correctAnswerText = `${question.correctAnswer}${question.tolerance > 0 ? ` (±${question.tolerance})` : ''}`;
    } else if (qType === 'true-false') {
        correctAnswerText = question.correctAnswer === true ? 'True' : 'False';
    }
    
    // 🆕 BUILD SOLUTION IMAGE HTML
    let solutionImageHTML = '';
    if (question.solutionImageUrl) {
        solutionImageHTML = `
            <div class="solution-image-container" style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 2px solid #e2e8f0;">
                <h5 style="margin: 0 0 12px 0; color: #2563eb; font-size: 0.95em; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    📷 Visual Solution
                </h5>
                <img 
                    src="${question.solutionImageUrl}" 
                    alt="Solution Diagram" 
                    style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #ddd; cursor: pointer; transition: transform 0.2s ease;" 
                    onclick="window.open('${question.solutionImageUrl}', '_blank')"
                    onmouseover="this.style.transform='scale(1.02)'"
                    onmouseout="this.style.transform='scale(1)'"
                >
                <p style="margin: 8px 0 0 0; font-size: 0.85em; color: #666; font-style: italic;">
                    💡 Click image to view full size
                </p>
            </div>
        `;
    }
    
    return `
        <div class="review-question-card ${statusClass}">
            <div class="review-question-header">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <strong style="font-size: 18px; color: var(--text-dark);">Question ${index + 1}</strong>
                    <span style="background: var(--bg-light); padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${qType}</span>
                    <span style="background: var(--bg-light); padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">${question.marks}M</span>
                </div>
                <span class="review-status-badge ${statusClass}">${statusText}</span>
            </div>
            
            <div style="margin-bottom: 16px; color: var(--text-dark); line-height: 1.6;">
                ${question.question}
            </div>
            
            ${question.imageUrl ? `
                <div class="review-question-image">
                    <img src="${question.imageUrl}" alt="Question Image" onclick="window.open('${question.imageUrl}', '_blank')" style="cursor: pointer;">
                    <p style="font-size: 12px; color: var(--text-light); margin-top: 8px;">Click to view full size</p>
                </div>
            ` : ''}
            
            ${qType === 'mcq' || qType === 'msq' ? `
                <div style="margin: 16px 0;">
                    <strong style="font-size: 14px; color: #374151;">Options:</strong>
                    <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                        ${Object.entries(question.options || {}).map(([key, value]) => `
                            <div style="padding: 8px 12px; background: var(--bg-light); border-radius: 6px; font-size: 14px;">
                                <strong>${key}.</strong> ${value}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="review-answer-section">
                <div style="margin-bottom: 12px;">
                    <div class="review-answer-label">Your Answer:</div>
                    <div style="font-size: 14px; color: ${statusClass === 'correct' ? 'var(--success-color)' : statusClass === 'wrong' ? 'var(--error-color)' : '#6b7280'}; font-weight: 600;">
                        ${yourAnswerText}
                    </div>
                </div>
                <div>
                    <div class="review-answer-label">Correct Answer:</div>
                    <div style="font-size: 14px; color: var(--success-color); font-weight: 600;">
                        ${correctAnswerText}
                    </div>
                </div>
            </div>
            
            ${question.explanation ? `
                <div class="review-explanation">
                    <div class="review-explanation-title">💡 Explanation:</div>
                    <div style="color: #1e40af; line-height: 1.6;">
                        ${question.explanation}
                    </div>
                </div>
            ` : ''}
            
            ${solutionImageHTML}
        </div>
    `;
}

// Make function globally accessible
window.showTestReview = showTestReview;

// ============================================
// FEATURE 3: LEADERBOARD FUNCTIONS
// ============================================

/**
 * Initialize leaderboard section event listeners
 */
function initializeLeaderboard() {
    console.log('🏆 Initializing leaderboard section...');
    
    // Subject filter change
    const subjectFilter = document.getElementById('leaderboardSubjectFilter');
    if (subjectFilter) {
        subjectFilter.addEventListener('change', (e) => {
            const selectedSubject = e.target.value;
            loadTestsForLeaderboard(selectedSubject);
        });
    }
    
    // Load button
    const loadBtn = document.getElementById('loadLeaderboardBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const testId = document.getElementById('leaderboardTestFilter').value;
            if (testId) {
                loadLeaderboard(testId);
            } else {
                alert('Please select a test first');
            }
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshLeaderboardBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (currentLeaderboardTestId) {
                loadLeaderboard(currentLeaderboardTestId);
            }
        });
    }
    
    // Navigate to test button
    const navigateBtn = document.getElementById('navigateToTestBtn');
    if (navigateBtn) {
        navigateBtn.addEventListener('click', () => {
            switchDashboardSection('tests');
        });
    }
    
    // Share button
    const shareBtn = document.getElementById('shareLeaderboardBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            openShareModal();
        });
    }
    
    // ❌ REMOVE THIS LINE - Don't load tests on init
    // loadTestsForLeaderboard();
    
    console.log('✅ Leaderboard initialized - tests will load when section is viewed');
}

/**
 * Load tests for leaderboard dropdown
 */
async function loadTestsForLeaderboard(subject = '') {
    console.log('📋 Loading tests for leaderboard, subject:', subject);
    
    const testFilter = document.getElementById('leaderboardTestFilter');
    
    // Show loading in dropdown
    if (testFilter) {
        testFilter.innerHTML = '<option value="">Loading tests...</option>';
        testFilter.disabled = true;
    }
    
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        let url = '/tests';
        if (subject) {
            url += `?subject=${encodeURIComponent(subject)}`;
        }
        
        const response = await makeAuthenticatedRequest(url);
        
        if (!response.success) {
            throw new Error('Failed to load tests');
        }
        
        allTestsForLeaderboard = response.data || [];
        
        // Populate test filter dropdown
        if (testFilter) {
            testFilter.innerHTML = '<option value="">Select a test...</option>';
            
            allTestsForLeaderboard.forEach(test => {
                const option = document.createElement('option');
                option.value = test.id;
                option.textContent = test.title;
                testFilter.appendChild(option);
            });
            
            testFilter.disabled = false;
        }
        
        console.log(`✅ Loaded ${allTestsForLeaderboard.length} tests for leaderboard`);
        
    } catch (error) {
        console.error('Error loading tests for leaderboard:', error);
        
        // Show error in dropdown
        if (testFilter) {
            testFilter.innerHTML = '<option value="">Error loading tests</option>';
            testFilter.disabled = false;
        }
        
        // Only show alert if it's not a "no user" error (user will login soon)
        if (!error.message.includes('No user logged in')) {
            alert('Failed to load tests. Please try again.');
        }
    }
}

/**
 * Load leaderboard for a specific test
 */
async function loadLeaderboard(testId) {
    console.log('📊 Loading leaderboard for test:', testId);
    
    if (!testId) {
        alert('Please select a test');
        return;
    }
    
    currentLeaderboardTestId = testId;
    
    // Show loading
    const loadingOverlay = document.getElementById('leaderboardLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        const response = await makeAuthenticatedRequest(`/student/leaderboard/${testId}`);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load leaderboard');
        }
        
        const data = response.data;
        
        // Display leaderboard
        displayLeaderboard(data);
        
        // Start auto-refresh
        startLeaderboardAutoRefresh(testId);
        
        console.log('✅ Leaderboard loaded successfully');
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        
        // ✅ SHOW HELPFUL ERROR MESSAGE
        const tableBody = document.getElementById('leaderboardTableBody');
        if (tableBody) {
            let errorHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div class="empty-state-content" style="color: var(--error-color);">
                            <span class="empty-icon">⚠️</span>
                            <p style="font-weight: bold; margin-bottom: 8px;">Failed to load leaderboard</p>
            `;
            
            // Check for specific error types
            if (error.message && error.message.includes('index')) {
                errorHTML += `
                    <p style="font-size: 14px; color: var(--text-light);">
                        Database index required. Please contact the administrator.
                    </p>
                `;
            } else {
                errorHTML += `
                    <p style="font-size: 14px; color: var(--text-light);">
                        ${error.message || 'Unknown error occurred'}
                    </p>
                `;
            }
            
            errorHTML += `
                            <button class="btn btn-secondary btn-sm" onclick="loadLeaderboard('${testId}')" style="margin-top: 12px;">
                                Try Again
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            tableBody.innerHTML = errorHTML;
        }
        
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

/**
 * Display leaderboard data
 */
function displayLeaderboard(data) {
    console.log('🎨 Displaying leaderboard data');
    
    const { testId, testName, totalMarks, totalAttempts, attempts, currentUser, avgScore, highestScore } = data;
    
    // Update header
    const header = document.getElementById('leaderboardHeader');
    if (header) {
        header.style.display = 'block';
    }
    
    document.getElementById('leaderboardTestTitle').textContent = testName;
    document.getElementById('leaderboardTotalAttempts').textContent = totalAttempts;
    document.getElementById('leaderboardAvgScore').textContent = `${avgScore.toFixed(2)}%`;
    document.getElementById('leaderboardHighScore').textContent = `${highestScore}%`;
    document.getElementById('leaderboardYourRank').textContent = currentUser.attempted ? `#${currentUser.rank}` : '-';
    
    // Show/hide "Your Status" section
    const yourStatusSection = document.getElementById('yourStatusSection');
    if (yourStatusSection) {
        if (!currentUser.attempted) {
            yourStatusSection.style.display = 'block';
        } else {
            yourStatusSection.style.display = 'none';
            
            // Store share data
            currentShareData = {
                testName: testName,
                rank: currentUser.rank,
                score: currentUser.attemptData.score,
                totalMarks: totalMarks,
                percentage: currentUser.attemptData.percentage
            };
            
            // Show share button
            const shareBtn = document.getElementById('shareLeaderboardBtn');
            if (shareBtn) {
                shareBtn.style.display = 'flex';
            }
        }
    }
    
    // Render table rows
    const tableBody = document.getElementById('leaderboardTableBody');
    if (!tableBody) return;
    
    if (attempts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-state-content">
                        <span class="empty-icon">📊</span>
                        <p>No attempts yet for this test</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    attempts.forEach((attempt, index) => {
        const rank = attempt.rank || (index + 1);
        const isCurrentUser = currentUser.attempted && attempt.userId === currentUser.attemptData.userId;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const userClass = isCurrentUser ? 'current-user' : '';
        
        // ✅ FIXED DATE FORMATTING - HANDLES DUPLICATE TIMEZONE
        let submittedDate = 'Unknown';
        if (attempt.submittedAt) {
            try {
                let dateString = attempt.submittedAt;
                
                // Fix: Remove duplicate timezone indicators
                // Pattern: +00:00Z or -05:00Z (has both offset and Z)
                if (dateString.match(/[+-]\d{2}:\d{2}Z$/)) {
                    dateString = dateString.slice(0, -1); // Remove trailing Z
                    console.log('🔧 Fixed duplicate timezone:', attempt.submittedAt, '->', dateString);
                }
                
                // Parse the cleaned string
                const date = new Date(dateString);
                
                // Check if date is valid
                if (!isNaN(date.getTime())) {
                    submittedDate = date.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    });
                } else {
                    console.warn('⚠️ Invalid date after cleaning:', dateString);
                    submittedDate = 'Invalid Date';
                }
            } catch (dateError) {
                console.error('❌ Date parsing error:', dateError, 'Value:', attempt.submittedAt);
                submittedDate = 'Error';
            }
        }
        
        const timeTakenMin = Math.floor(attempt.timeTaken / 60);
        const timeTakenSec = attempt.timeTaken % 60;
        
        html += `
            <tr class="${rankClass} ${userClass}">
                <td class="rank-col">${rank}</td>
                <td class="name-col">${escapeHtml(attempt.userName || 'Anonymous')}${isCurrentUser ? ' (You)' : ''}</td>
                <td class="score-col">${attempt.score} / ${totalMarks}</td>
                <td class="percentage-col">${attempt.percentage.toFixed(2)}%</td>
                <td class="correct-col">${attempt.correctAnswers}</td>
                <td class="wrong-col">${attempt.wrongAnswers}</td>
                <td class="time-col">${timeTakenMin}m ${timeTakenSec}s</td>
                <td class="date-col">${submittedDate}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

/**
 * Start auto-refresh for leaderboard
 */
function startLeaderboardAutoRefresh(testId) {
    // Clear existing interval
    stopLeaderboardAutoRefresh();
    
    // Set new interval (30 seconds)
    leaderboardRefreshInterval = setInterval(() => {
        const leaderboardSection = document.getElementById('leaderboardSection');
        if (leaderboardSection && leaderboardSection.style.display !== 'none') {
            console.log('🔄 Auto-refreshing leaderboard');
            loadLeaderboard(testId);
        }
    }, 30000);
}

/**
 * Stop auto-refresh
 */
function stopLeaderboardAutoRefresh() {
    if (leaderboardRefreshInterval) {
        clearInterval(leaderboardRefreshInterval);
        leaderboardRefreshInterval = null;
    }
}

/**
 * View leaderboard for a specific test (called from test list)
 */
function viewLeaderboardForTest(testId) {
    console.log('🏆 Navigating to leaderboard for test:', testId);
    
    // ✅ ADD DEBUGGING
    const section = document.getElementById('leaderboardSection');
    console.log('Section element:', section);
    console.log('Section display:', section ? section.style.display : 'NOT FOUND');
    
    switchDashboardSection('leaderboard');
    
    // ✅ CHECK AGAIN AFTER SWITCH
    setTimeout(() => {
        console.log('After switch - display:', section ? section.style.display : 'NOT FOUND');
        console.log('After switch - classList:', section ? section.classList : 'NOT FOUND');
    }, 100);
    
    setTimeout(() => {
        currentLeaderboardTestId = testId;
        const testFilter = document.getElementById('leaderboardTestFilter');
        if (testFilter) {
            testFilter.value = testId;
        }
        loadLeaderboard(testId);
    }, 100);
}

/**
 * Open share modal
 */
function openShareModal() {
    if (!currentShareData) {
        alert('No data to share');
        return;
    }
    
    const { testName, rank, score, totalMarks, percentage } = currentShareData;
    
    // Populate share data
    document.getElementById('shareTestName').textContent = testName;
    document.getElementById('shareRank').textContent = `#${rank}`;
    document.getElementById('shareScore').textContent = `${score} / ${totalMarks}`;
    document.getElementById('sharePercentage').textContent = `${percentage.toFixed(2)}%`;
    
    // Create share message
    const shareMessage = `🎯 I just took "${testName}" on GeoCatalyst and scored ${percentage.toFixed(2)}% (Rank #${rank})!

📚 Preparing for GATE Geomatics? Join me at GeoCatalyst!

🔗 Visit: https://geocatalyst.in`;
    
    document.getElementById('shareMessageText').value = shareMessage;
    
    openModal('shareLeaderboardModal');
}

/**
 * Close share modal
 */
function closeShareModal() {
    closeModal('shareLeaderboardModal');
}

/**
 * Share to WhatsApp
 */
function shareToWhatsApp() {
    const message = document.getElementById('shareMessageText').value;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

/**
 * Share to LinkedIn
 */
function shareToLinkedIn() {
    const message = document.getElementById('shareMessageText').value;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://geocatalyst.in')}&summary=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

/**
 * Share to Instagram (copies message and opens Instagram)
 */
function shareToInstagram() {
    const message = document.getElementById('shareMessageText').value;
    
    // Copy to clipboard
    navigator.clipboard.writeText(message).then(() => {
        alert('Message copied! Now opening Instagram...');
        window.open('instagram://story-camera', '_blank');
    }).catch(err => {
        alert('Failed to copy message');
    });
}

/**
 * Copy share message
 */
function copyShareMessage() {
    const message = document.getElementById('shareMessageText').value;
    
    navigator.clipboard.writeText(message).then(() => {
        alert('✅ Message copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy message');
    });
}

// Make functions globally accessible
window.viewLeaderboardForTest = viewLeaderboardForTest;
window.shareToWhatsApp = shareToWhatsApp;
window.shareToLinkedIn = shareToLinkedIn;
window.shareToInstagram = shareToInstagram;
window.copyShareMessage = copyShareMessage;
window.closeShareModal = closeShareModal;

// /**
//  * Update exitTestInterface to properly close the modal first
//  */
// function exitTestInterface() {
//     console.log("Exiting test interface...");
    
//     // Close any open modals first
//     closeModal('testResultModal');
//     closeModal('testSummaryModal');
//     closeModal('calculatorModal');
//     closeModal('questionPaperModal');
//     closeModal('usefulDataModal');
//     closeModal('confirmationModal');
    
//     // Clean up test state
//     cleanupTestInterface();
    
//     // NOW hide test interface
//     const testInterface = document.getElementById('test-interface');
//     if (testInterface) {
//         testInterface.style.display = 'none';
//     }
    
//     // Show dashboard
//     const dashboard = document.getElementById('dashboard-tab');
//     if (dashboard) {
//         switchTab('dashboard');
//     }
// }

/**
 * Cleans up the test state and returns to the dashboard view.
 */
function cleanupTestInterface() {
     hideLoading('test-interface');
     clearInterval(testTimerInterval);
     exitFullscreen();

     // Close all test-related modals
     closeModal('calculatorModal');
     closeModal('testResultModal');
     closeModal('testSummaryModal');
     closeModal('questionPaperModal');
     closeModal('usefulDataModal');
     closeModal('confirmationModal');
     closeModal('testReviewModal'); // 🆕 ADD THIS

     // Reset state variables
     currentTest = null;
     currentQuestionIndex = 0;
     studentAnswers = {};
     questionStatus = [];
     testTimerInterval = null;
     timeLeft = 0;
     testStartTime = null;
     if (natKeyboard) {
          natKeyboard.destroy();
          natKeyboard = null;
     }

     // Hide test interface, show dashboard
     document.getElementById('test-interface').style.display = 'none';
     
     const appContainer = document.querySelector('#app-view .app-container');
     if (appContainer) {
         appContainer.style.display = '';
     } else {
         document.getElementById('content').style.display = 'block';
         document.getElementById('sidebar').style.display = 'block';
     }

     switchDashboardSection('tests');
     loadTests();
}

/**
 * Opens the calculator modal.
 */
function handleCalculatorClick() {
    const calculatorUrl = "https://tcsion.com/OnlineAssessment/ScientificCalculator/Calculator.html";
    const windowName = "CalculatorPopup";
    // Define features: width, height, and allow resizing/scrolling
    const windowFeatures = "width=450,height=450,resizable=yes,scrollbars=yes";

    // Open the window
    window.open(calculatorUrl, windowName, windowFeatures);

    console.log("Opening calculator in a popup window.");
}


/**
 * Re-opens the instructions modal during the test.
 */
function handleInstructionsClick() {
    // Optionally hide the start button/checkbox if already started
     const startButton = document.getElementById('startTestButton');
     const acknowledgeCheckbox = document.getElementById('instructionsAcknowledge').parentElement; // Get the label element
     if(startButton) startButton.style.display = 'none';
     if(acknowledgeCheckbox) acknowledgeCheckbox.style.display = 'none';

    openModal('testInstructionsModal');
}

/**
 * Shows the full question paper (Placeholder).
 */
function handleQuestionPaperClick() {
    const container = document.getElementById('questionPaperContent');
    if (!currentTest || !currentTest.questions) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No questions available.</p>';
        openModal('questionPaperModal');
        return;
    }
    
    let html = '<div class="question-paper-list" style="display: flex; flex-direction: column; gap: 12px;">';
    currentTest.questions.forEach((q, index) => {
        const statusText = questionStatus[index] || 'not-visited';
        const statusIcon = {
            'answered': '✓',
            'not-answered': '○',
            'not-visited': '−',
            'marked': '⚑',
            'answered-marked': '✓⚑'
        }[statusText] || '−';
        
        const statusColor = {
            'answered': '#7BC043',
            'not-answered': '#FF5733',
            'not-visited': '#D3D3D3',
            'marked': '#8B5CF6',
            'answered-marked': '#8B5CF6'
        }[statusText] || '#D3D3D3';
        
        html += `
            <div class="question-paper-item" onclick="handlePaletteClick(${index}); closeModal('questionPaperModal');" 
                 style="display: flex; align-items: center; gap: 16px; padding: 12px; background: var(--white); 
                        border-radius: 8px; cursor: pointer; border: 1px solid #e0e0e0; transition: all 0.2s;"
                 onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" 
                 onmouseout="this.style.boxShadow='none'">
                <div style="font-weight: bold; color: var(--primary-color); min-width: 50px;">Q${index + 1}</div>
                <div style="flex: 1; display: flex; gap: 12px;">
                    <span style="background: var(--bg-light); padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500;">${q.type.toUpperCase()}</span>
                    <span style="background: var(--bg-light); padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500;">${q.marks}M</span>
                </div>
                <div style="font-size: 18px; color: ${statusColor}; min-width: 30px; text-align: center;">${statusIcon}</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    openModal('questionPaperModal');
}

/**
 * Attempts to enter fullscreen mode.
 */
function enterFullscreen() {
    const elem = document.documentElement; // Full page
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
            console.warn(`Fullscreen request failed: ${err.message} (${err.name})`);
        });
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

/**
 * Attempts to exit fullscreen mode.
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
             console.warn(`Exit fullscreen request failed: ${err.message} (${err.name})`);
        });
    } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
    }
}

/**
 * Placeholder for periodically saving test progress (e.g., to local storage).
 */
function updateTestProgress() {
    // Example: Save answers and timeLeft to localStorage
    // const progress = {
    //     testId: currentTest.id,
    //     answers: studentAnswers,
    //     timeLeft: timeLeft,
    //     lastUpdated: Date.now()
    // };
    // localStorage.setItem(`testProgress_${currentTest.id}`, JSON.stringify(progress));
    // console.log("⏳ Test progress auto-saved.");
}


// ============================================
// EVENT LISTENERS FOR TEST INTERFACE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Instructions Modal Acknowledge Checkbox
    const acknowledgeCheckbox = document.getElementById('instructionsAcknowledge');
    const startTestActualBtn = document.getElementById('startTestButton');
    if (acknowledgeCheckbox && startTestActualBtn) {
        acknowledgeCheckbox.addEventListener('change', () => {
            startTestActualBtn.disabled = !acknowledgeCheckbox.checked;
        });
        startTestActualBtn.addEventListener('click', initializeTestInterface);
    }

    // Test Interface Navigation Buttons - UPDATED IDs
    document.getElementById('gateSaveNextBtn')?.addEventListener('click', handleSaveAndNext);
    document.getElementById('gateMarkReviewBtn')?.addEventListener('click', handleMarkForReview);
    document.getElementById('gateClearBtn')?.addEventListener('click', handleClearResponse);
    
    // Submit Button - UPDATED ID
    document.getElementById('gateSubmitBtn')?.addEventListener('click', handleSubmitClick);
    
    // Calculator Button - UPDATED ID
    document.getElementById('gateCalculatorBtn')?.addEventListener('click', handleCalculatorClick);
    
    // Header Buttons - UPDATED IDs
    document.getElementById('headerInstructionsBtn')?.addEventListener('click', handleInstructionsClick);
    document.getElementById('headerQuestionPaperBtn')?.addEventListener('click', handleQuestionPaperClick);
    document.getElementById('headerUsefulDataBtn')?.addEventListener('click', handleUsefulDataClick); // NEW

    // Summary Modal Final Submit Button
    document.getElementById('finalSubmitBtn')?.addEventListener('click', () => handleFinalSubmit(false));
});

function handleUsefulDataClick() {
    openModal('usefulDataModal');
}

/**
 * Shows a simple notification using the confirmation modal.
 * @param {string} message - The message to display.
 * @param {string} [title="Notification"] - The modal title.
 */
function showTestNotification(message, title = "Notification") {
    const modal = document.getElementById('confirmationModal');
    if (!modal) {
        alert(message); // Fallback if modal is missing
        return;
    }
    
    document.getElementById('confirmationTitle').textContent = title;
    document.getElementById('confirmationIcon').textContent = 'ℹ️';
    document.getElementById('confirmationMessage').textContent = message;
    
    // Hide the "Confirm" button
    document.getElementById('confirmationActionBtn').style.display = 'none';
    
    // Change "Cancel" button to "OK" and ensure it just closes the modal
    const okBtn = modal.querySelector('.btn-secondary');
    okBtn.textContent = 'OK';
    okBtn.onclick = () => closeModal('confirmationModal'); 
    
    openModal('confirmationModal');
}

function exitTestInterface() {
    closeModal('testResultModal');
    cleanupTestInterface();
}

window.startTest = startTest;
window.exitTestInterface = exitTestInterface;

async function loadDoubts() {
    const container = document.getElementById('doubtMessages');

    // Show loading
    container.innerHTML = `
        <div style="text-align: center; color: var(--text-light); margin-top: 150px;">
            <div class="spinner"></div>
            <p style="margin-top: 16px;">Loading your doubts...</p>
        </div>
    `;

    try {
        // Import makeAuthenticatedRequest (assuming it's in auth.js)
        const { makeAuthenticatedRequest } = await import('./auth.js');

        // --- Fetch doubts using your backend API ---
        const response = await makeAuthenticatedRequest('/doubts'); // Use your student backend route

        if (!response.success || !Array.isArray(response.data)) {
             throw new Error(response.error || 'Failed to load doubts or invalid data format');
        }

        const userDoubts = response.data;
        // --- End Fetch ---

        if (userDoubts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-light); margin-top: 150px;">
                    <p>💬 No doubts yet!</p>
                    <p style="font-size: 14px; margin-top: 8px;">Ask your first question below and get expert guidance</p>
                </div>
            `;
        } else {
            // --- Build doubts HTML using conversationLog ---
            let doubtsHTML = '';

            userDoubts.forEach((doubt) => {
                const createdAt = doubt.createdAt ? (doubt.createdAt.toDate ? doubt.createdAt.toDate() : new Date(doubt.createdAt._seconds * 1000)) : null;
                const timeStr = createdAt ? createdAt.toLocaleDateString() + ' ' + createdAt.toLocaleTimeString() : 'Unknown date';
                const conversationLog = doubt.conversationLog || []; // Ensure it's an array

                doubtsHTML += `
                    <div style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                            <span style="font-weight: 600; color: var(--primary-color);">${escapeHtml(doubt.subject || 'General')}</span>
                            <span style="font-size: 12px; color: var(--text-muted);">${timeStr}</span>
                        </div>

                        <div class="doubt-conversation-history" style="margin-bottom: 12px;">`;

                if (conversationLog.length > 0) {
                    conversationLog.forEach(message => {
                        const messageTimestamp = message.timestamp ? (message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp._seconds * 1000)) : null;
                        const messageTimeStr = messageTimestamp ? messageTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        const isStudent = message.senderType === 'student';

                        doubtsHTML += `
                            <div class="doubt-message ${isStudent ? 'student-message' : 'admin-message'}" style="margin-bottom: 8px; padding: 8px 12px; border-radius: 6px; background-color: ${isStudent ? '#eef2ff' : '#f3f4f6'}; border-left: 3px solid ${isStudent ? 'var(--primary-color)' : 'var(--success-color)'};">
                                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                                    <strong>${escapeHtml(message.senderName || (isStudent ? 'You' : 'Expert'))}</strong>
                                    <span>${messageTimeStr}</span>
                                </div>
                                <div style="color: var(--text-dark); white-space: pre-wrap;">${escapeHtml(message.text || '')}</div>
                            </div>`;
                    });
                } else {
                    // Fallback if conversationLog is empty but doubt exists
                     doubtsHTML += `<p style="color: var(--text-muted); font-style: italic;">No messages found in log.</p>`;
                     if (doubt.question) { // Try to display old question field if log is empty
                          doubtsHTML += `<div class="doubt-message student-message"><strong>You:</strong> ${escapeHtml(doubt.question)}</div>`;
                     }
                      if (doubt.answer) { // Try to display old answer field if log is empty
                           doubtsHTML += `<div class="doubt-message admin-message"><strong>Expert:</strong> ${escapeHtml(doubt.answer)}</div>`;
                      }
                }

                doubtsHTML += `</div> `;

                 // Display status (Pending/Answered) at the bottom
                 if (doubt.status === 'pending') {
                      doubtsHTML += `
                          <div style="padding: 8px 12px; background: var(--warning-color); color: white; border-radius: 6px; font-size: 13px; text-align: center;">
                              ⏳ Pending response (within 24 hours)
                          </div>`;
                 } else if (doubt.status === 'answered') {
                      doubtsHTML += `
                          <div style="padding: 8px 12px; background: var(--success-color); color: white; border-radius: 6px; font-size: 13px; text-align: center;">
                              ✓ Answered
                          </div>`;
                 }


                doubtsHTML += `</div> `;
            });

            container.innerHTML = doubtsHTML;
        }

    } catch (error) {
        console.error('Error loading doubts:', error);
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-light); margin-top: 150px;">
                <p style="color: var(--error-color);">Failed to load doubts</p>
                <p style="font-size: 14px; margin-top: 8px;">Please try again later: ${error.message}</p>
            </div>
        `;
    }

    // --- Keep Submit Setup ---
    // Set up doubt submission button (no changes needed here)
    const submitBtn = document.getElementById('submitDoubtBtn');
    const doubtInput = document.getElementById('doubtInput');
    const subjectSelect = document.getElementById('doubtSubjectSelect');

    if (submitBtn && doubtInput && subjectSelect) {
        submitBtn.onclick = () => {
            const doubt = doubtInput.value.trim();
            const subject = subjectSelect.value;

            if (!subject) {
                alert('Please select a subject/topic');
                return;
            }
            if (!doubt) {
                alert('Please enter your doubt');
                return;
            }
            submitDoubt(subject, doubt); // Assuming submitDoubt function is defined elsewhere
        };
    } else {
         console.warn("Could not find submit doubt elements.");
    }
     // --- End Submit Setup ---
}

function escapeHtml(text) {
    if (text === null || typeof text === 'undefined') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : (timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp));
    if (isNaN(date)) return ''; // Invalid date check
    // Example format, adjust as needed
    return date.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

async function submitDoubt(subject, doubt) {
    console.log('Submitting doubt:', subject, doubt);
    
    try {
        const { makeAuthenticatedRequest } = await import('./auth.js');
        
        // Show loading on button
        const submitBtn = document.getElementById('submitDoubtBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Sending...';
        
        // Submit to backend
        await makeAuthenticatedRequest('/doubts', {
            method: 'POST',
            body: JSON.stringify({
                subject: subject,
                question: doubt
            })
        });
        
        // Clear input
        document.getElementById('doubtInput').value = '';
        
        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📤 Send';
        
        // Show success
        alert('✅ Doubt submitted! Our experts will respond within 24 hours.');
        
        // Reload doubts
        loadDoubts();
        
    } catch (error) {
        console.error('Error submitting doubt:', error);
        alert('Failed to submit doubt. Please try again.');
        
        // Reset button
        const submitBtn = document.getElementById('submitDoubtBtn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📤 Send';
    }
}

async function loadProfile() {
    const statsContainer = document.getElementById('profileStats');
    const enrolledContainer = document.getElementById('enrolledCoursesList');
    
    try {
        // Import auth
        const { makeAuthenticatedRequest } = await import('./auth.js');
        const { getCurrentUser } = await import('./firebase-config.js');
        
        const user = getCurrentUser();
        if (!user) return;
        
        // Get user data from backend
        const userData = await makeAuthenticatedRequest('/user/profile');
        const profile = userData.data;
        
        // ============================================
        // FIX 1: PROPER DATE CONVERSION
        // ============================================
        let joinedDate = new Date(); // Default to now
        if (profile.createdAt) {
            // Check if it's a Firestore timestamp object with _seconds
            if (profile.createdAt._seconds) {
                joinedDate = new Date(profile.createdAt._seconds * 1000);
            } 
            // Check if it has a toDate method (Firestore Timestamp)
            else if (profile.createdAt.toDate && typeof profile.createdAt.toDate === 'function') {
                joinedDate = profile.createdAt.toDate();
            } 
            // Try parsing as ISO string or standard date
            else {
                try {
                    joinedDate = new Date(profile.createdAt);
                    // Verify it's a valid date
                    if (isNaN(joinedDate.getTime())) {
                        joinedDate = new Date(); // Fallback to now
                    }
                } catch (e) {
                    console.warn('Could not parse createdAt date:', e);
                    joinedDate = new Date();
                }
            }
        }
        
        // ============================================
        // FIX 2: UPDATE PROFILE PHOTOS
        // ============================================
        const photoURL = profile.photoURL || user.photoURL || 'https://i.stack.imgur.com/34AD2.jpg';
        
        // Update all profile photo elements
        const profileAvatar = document.getElementById('profileAvatar');
        const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
        
        if (profileAvatar) profileAvatar.src = photoURL;
        if (sidebarUserAvatar) sidebarUserAvatar.src = photoURL;
        
        console.log('✅ Profile photo loaded:', photoURL);
        
        // ============================================
        // UPDATE STATS WITH PROPERLY FORMATTED DATE
        // ============================================
        statsContainer.innerHTML = `
            <h4 style="margin-bottom: 12px;">Account Details</h4>
            <p style="font-size: 14px; color: var(--text-light); margin-bottom: 8px;"><strong>Joined:</strong> ${joinedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            <p style="font-size: 14px; color: var(--text-light); margin-bottom: 8px;"><strong>Plan:</strong> ${profile.plan || 'Free'}</p>
            <p style="font-size: 14px; color: var(--text-light); margin-bottom: 8px;"><strong>Videos Watched:</strong> ${profile.stats?.videosWatched || 0}</p>
            <p style="font-size: 14px; color: var(--text-light); margin-bottom: 8px;"><strong>Tests Attempted:</strong> ${profile.stats?.testsAttempted || 0}</p>
            <p style="font-size: 14px; color: var(--text-light);"><strong>Doubts Asked:</strong> ${profile.stats?.doubtsAsked || 0}</p>
        `;
        
        // Update enrolled courses
        const enrolledCourses = profile.enrolledCourses || [];
        
        if (enrolledCourses.length === 0) {
            enrolledContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-light); padding: 20px 0;">
                    <p>No enrolled courses yet</p>
                    <p style="font-size: 14px; margin-top: 8px;">Browse available courses below to get started</p>
                </div>
            `;
        } else {
            let enrolledHTML = '<div style="display: flex; flex-direction: column; gap: 12px;">';
            
            enrolledCourses.forEach(course => {
                const icon = getCourseIcon(course);
                enrolledHTML += `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-light); border-radius: 8px;">
                        <span style="font-size: 24px;">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${course}</div>
                            <div style="font-size: 12px; color: var(--success-color);">✓ Enrolled</div>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="viewCourseLectures('${course}', '${course}')">View</button>
                    </div>
                `;
            });
            
            enrolledHTML += '</div>';
            enrolledContainer.innerHTML = enrolledHTML;
        }
        
        // Update plan badge
        document.getElementById('sidebarUserPlanBadge').textContent = profile.plan || 'Free';
        document.getElementById('profilePlan').textContent = (profile.plan || 'Free') + ' Plan';
        
        // ============================================
        // SETUP PHOTO UPLOAD (Call after DOM is updated)
        // ============================================
        setTimeout(() => {
            setupPhotoUpload();
        }, 100);
        
    } catch (error) {
        console.error('Error loading profile:', error);
        statsContainer.innerHTML = '<p style="color: var(--error-color);">Failed to load profile data</p>';
        enrolledContainer.innerHTML = '<p style="color: var(--error-color);">Failed to load enrolled courses</p>';
    }
    
    // Set up course purchase buttons (must run after DOM is updated)
    setTimeout(() => {
        document.querySelectorAll('.course-purchase-item button').forEach(btn => {
            btn.addEventListener('click', () => {
                const courseName = btn.getAttribute('data-course');
                const price = btn.getAttribute('data-price');
                openPaymentModal(courseName, price);
            });
        });
    }, 100);
}

// ============================================
// PHOTO UPLOAD FUNCTIONALITY
// ============================================

/**
 * Handle profile photo upload
 */
async function handlePhotoUpload(file) {
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
    }
    
    try {
        // Import Firebase modules
        const { storage } = await import('./firebase-config.js');
        const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js');
        const { getCurrentUser } = await import('./firebase-config.js');
        const { makeAuthenticatedRequest } = await import('./auth.js');
        const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        
        const user = getCurrentUser();
        if (!user) {
            alert('Please login to upload photo');
            return;
        }
        
        // Show loading
        const changePhotoBtn = document.getElementById('changePhotoBtn');
        const originalText = changePhotoBtn.innerHTML;
        changePhotoBtn.innerHTML = '<span class="spinner-small"></span> Uploading...';
        changePhotoBtn.disabled = true;
        
        // Create a unique filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const filename = `profile-photos/${user.uid}/${timestamp}.${fileExtension}`;
        
        // Upload to Firebase Storage
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, file);
        console.log('✅ Photo uploaded to storage');
        
        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        console.log('✅ Download URL obtained:', downloadURL);
        
        // Update user profile in backend
        await makeAuthenticatedRequest('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({
                photoURL: downloadURL
            })
        });
        console.log('✅ Profile updated in backend');
        
        // Update Firebase Auth profile
        await updateProfile(user, {
            photoURL: downloadURL
        });
        console.log('✅ Firebase Auth profile updated');
        
        // Update UI immediately
        document.getElementById('profileAvatar').src = downloadURL;
        document.getElementById('sidebarUserAvatar').src = downloadURL;
        
        // Also update gateUserPhoto if it exists (test interface)
        const gateUserPhoto = document.getElementById('gateUserPhoto');
        if (gateUserPhoto) {
            gateUserPhoto.src = downloadURL;
        }
        
        // Show success message
        alert('✅ Profile photo updated successfully!');
        
        // Reset button
        changePhotoBtn.innerHTML = originalText;
        changePhotoBtn.disabled = false;
        
    } catch (error) {
        console.error('❌ Error uploading photo:', error);
        alert(`Failed to upload photo: ${error.message}`);
        
        // Reset button
        const changePhotoBtn = document.getElementById('changePhotoBtn');
        if (changePhotoBtn) {
            changePhotoBtn.innerHTML = '📷 Change Photo';
            changePhotoBtn.disabled = false;
        }
    }
}

/**
 * Set up photo upload event listeners
 */
function setupPhotoUpload() {
    const photoInput = document.getElementById('profilePhotoInput');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    
    if (changePhotoBtn && photoInput) {
        console.log('✅ Setting up photo upload listeners');
        
        // Click button triggers file input
        changePhotoBtn.addEventListener('click', () => {
            photoInput.click();
        });
        
        // Handle file selection
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handlePhotoUpload(file);
            }
            // Reset input so same file can be selected again
            e.target.value = '';
        });
    } else {
        console.warn('⚠️ Photo upload elements not found');
    }
}

// Make functions globally accessible
window.handlePhotoUpload = handlePhotoUpload;
window.setupPhotoUpload = setupPhotoUpload;

// ============================================
// COURSE FILTER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('courseFilter');
    
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            const selectedCourse = e.target.value;
            console.log('Filtering courses by:', selectedCourse);
            // TODO: Implement filtering logic with Firebase data
        });
    }
});

// ============================================
// SUBJECT CARD INTERACTIONS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Material subject cards
    document.querySelectorAll('.material-subject-card').forEach(card => {
        card.addEventListener('click', () => {
            const subject = card.getAttribute('data-subject');
            console.log('Loading materials for:', subject);
            // TODO: Load materials for selected subject
        });
    });
    
    // Test subject cards
    document.querySelectorAll('.test-subject-card button').forEach(btn => {
        btn.addEventListener('click', () => {
            const subject = btn.getAttribute('data-subject');
            console.log('Loading tests for:', subject);
            // TODO: Load tests for selected subject
        });
    });

    initializeLeaderboard();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div class="spinner"></div>
                <p style="color: var(--text-light); margin-top: 16px;">Loading...</p>
            </div>
        `;
    }
}

function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        // Remove the loading spinner by clearing only if it contains a spinner
        const spinner = container.querySelector('.spinner');
        if (spinner) {
            container.innerHTML = ''; // Clear the loading content
        }
    }
}

window.hideLoading = hideLoading;

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <p style="color: var(--error-color); margin-bottom: 16px;">⚠️ ${message}</p>
                <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

// Open change password modal
function openChangePasswordModal() {
    openModal('changePasswordModal');
}

window.openChangePasswordModal = openChangePasswordModal;

// Open coming soon modal
function openComingSoonModal() {
    openModal('comingSoonModal');
}

window.openComingSoonModal = openComingSoonModal;

// Export functions for use in auth.js
window.loadUserData = loadUserData;
window.loadDashboardStats = loadDashboardStats;
window.loadCourses = loadLectures;
window.loadMaterials = loadMaterials;
window.loadTests = loadTests;
window.loadDoubts = loadDoubts;
window.loadProfile = loadProfile;
window.showLoading = showLoading;
window.showError = showError;
window.hideLoading = hideLoading;

console.log('✅ App.js loaded successfully');