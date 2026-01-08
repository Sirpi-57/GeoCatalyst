// ============================================
// UPDATE CHECKER - Notifies users of new versions
// ============================================

let updateCheckInterval = null;
let serviceWorkerRegistration = null;

// Initialize update checker
function initializeUpdateChecker() {
    console.log('🔄 Initializing update checker...');
    
    if ('serviceWorker' in navigator) {
        registerServiceWorker();
        startPeriodicUpdateCheck();
        setupVisibilityChangeListener();
    } else {
        console.warn('⚠️ Service Workers not supported in this browser');
    }
}

// Register service worker
async function registerServiceWorker() {
    try {
        serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered');
        
        // Check for updates immediately
        serviceWorkerRegistration.update();
        
        // Listen for updates
        serviceWorkerRegistration.addEventListener('updatefound', () => {
            const newWorker = serviceWorkerRegistration.installing;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available
                    console.log('🎉 New version available!');
                    showUpdateNotification();
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
    }
}

// Show update notification banner
function showUpdateNotification() {
    // Check if banner already exists
    if (document.getElementById('update-banner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        gap: 20px;
        align-items: center;
        animation: slideDown 0.4s ease-out;
        max-width: 90%;
        width: 500px;
    `;
    
    banner.innerHTML = `
        <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">
                🎉 New Update Available!
            </div>
            <div style="font-size: 14px; opacity: 0.95;">
                We've made improvements to GeoCatalyst. Click to refresh and get the latest features.
            </div>
        </div>
        <button onclick="applyUpdate()" style="
            background: white;
            color: #667eea;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            white-space: nowrap;
            transition: all 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            Update Now
        </button>
        <button onclick="dismissUpdate()" style="
            background: transparent;
            color: white;
            border: none;
            padding: 8px;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
            opacity: 0.8;
        " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            ×
        </button>
    `;
    
    document.body.appendChild(banner);
}

// Apply update and refresh page
window.applyUpdate = function() {
    console.log('🔄 Applying update...');
    
    if (serviceWorkerRegistration && serviceWorkerRegistration.waiting) {
        serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Show loading message
    const banner = document.getElementById('update-banner');
    if (banner) {
        banner.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">
                    ⏳ Updating...
                </div>
                <div style="font-size: 14px; opacity: 0.9;">
                    Please wait while we refresh the page
                </div>
            </div>
        `;
    }
    
    // Reload after a short delay
    setTimeout(() => {
        window.location.reload();
    }, 1000);
};

// Dismiss update notification
window.dismissUpdate = function() {
    const banner = document.getElementById('update-banner');
    if (banner) {
        banner.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => banner.remove(), 300);
    }
};

// Check for updates periodically (every 5 minutes)
function startPeriodicUpdateCheck() {
    updateCheckInterval = setInterval(() => {
        if (serviceWorkerRegistration) {
            console.log('🔍 Checking for updates...');
            serviceWorkerRegistration.update();
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Check for updates when tab becomes visible
function setupVisibilityChangeListener() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && serviceWorkerRegistration) {
            console.log('👀 Tab visible - checking for updates...');
            serviceWorkerRegistration.update();
        }
    });
}

// Handle controller change (new service worker activated)
navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 New service worker activated - reloading...');
    window.location.reload();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translate(-50%, -100px);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUpdateChecker);
} else {
    initializeUpdateChecker();
}

console.log('✅ Update checker loaded');