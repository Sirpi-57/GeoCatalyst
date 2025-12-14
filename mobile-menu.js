/* ============================================
   GEOCATALYST - MOBILE MENU FUNCTIONALITY
   Add this to your app.js or create a separate mobile.js file
   ============================================ */

// Mobile Menu Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeMobileMenu();
    initializeDashboardMobileMenu();
    handleOrientationChange();
});

/**
 * Initialize Public View Mobile Menu
 */
function initializeMobileMenu() {
    // Create mobile menu toggle button if it doesn't exist
    const header = document.querySelector('.header-content');
    if (!header) return;
    
    // Check if mobile toggle already exists
    if (!document.querySelector('.mobile-menu-toggle')) {
        const mobileToggle = document.createElement('button');
        mobileToggle.className = 'mobile-menu-toggle';
        mobileToggle.setAttribute('aria-label', 'Toggle menu');
        mobileToggle.innerHTML = '<span class="hamburger"></span>';
        
        // Insert before nav element
        const nav = header.querySelector('.nav');
        header.insertBefore(mobileToggle, nav);
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        document.body.appendChild(overlay);
        
        // Add event listeners
        mobileToggle.addEventListener('click', toggleMobileMenu);
        overlay.addEventListener('click', closeMobileMenu);
        
        // Close menu when clicking nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
    }
}

/**
 * Toggle Mobile Menu
 */
function toggleMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (!toggle || !nav || !overlay) return;
    
    const isActive = toggle.classList.contains('active');
    
    if (isActive) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

/**
 * Open Mobile Menu
 */
function openMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const overlay = document.querySelector('.mobile-overlay');
    
    toggle?.classList.add('active');
    nav?.classList.add('active');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close Mobile Menu
 */
function closeMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const overlay = document.querySelector('.mobile-overlay');
    
    toggle?.classList.remove('active');
    nav?.classList.remove('active');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Initialize Dashboard Mobile Menu
 */
function initializeDashboardMobileMenu() {
    const appView = document.getElementById('app-view');
    if (!appView) return;
    
    // Check if dashboard toggle already exists
    if (!document.querySelector('.dashboard-menu-toggle')) {
        const dashboardToggle = document.createElement('button');
        dashboardToggle.className = 'dashboard-menu-toggle';
        dashboardToggle.innerHTML = '☰';
        dashboardToggle.setAttribute('aria-label', 'Toggle sidebar');
        appView.appendChild(dashboardToggle);
        
        // Create overlay for dashboard
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay dashboard-overlay';
        appView.appendChild(overlay);
        
        // Add event listeners
        dashboardToggle.addEventListener('click', toggleDashboardSidebar);
        overlay.addEventListener('click', closeDashboardSidebar);
        
        // Close sidebar when clicking nav items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeDashboardSidebar();
                }
            });
        });
    }
}

/**
 * Toggle Dashboard Sidebar
 */
function toggleDashboardSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.dashboard-overlay');
    
    if (!sidebar) return;
    
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
        closeDashboardSidebar();
    } else {
        openDashboardSidebar();
    }
}

/**
 * Open Dashboard Sidebar
 */
function openDashboardSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.dashboard-overlay');
    
    sidebar?.classList.add('open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close Dashboard Sidebar
 */
function closeDashboardSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.dashboard-overlay');
    
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Handle Orientation Change
 */
function handleOrientationChange() {
    window.addEventListener('orientationchange', () => {
        // Close menus on orientation change
        closeMobileMenu();
        closeDashboardSidebar();
        
        // Adjust test interface if active
        const testInterface = document.getElementById('test-interface');
        if (testInterface && testInterface.style.display !== 'none') {
            adjustTestInterfaceForOrientation();
        }
    });
    
    // Also handle resize events
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 768) {
                closeMobileMenu();
                closeDashboardSidebar();
            }
        }, 250);
    });
}

/**
 * Adjust Test Interface for Orientation
 */
function adjustTestInterfaceForOrientation() {
    const testContainer = document.querySelector('.gate-test-container');
    if (!testContainer) return;
    
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile && isLandscape) {
        // Landscape mobile - side by side layout
        testContainer.style.flexDirection = 'row';
        
        const rightPanel = document.querySelector('.gate-right-panel');
        if (rightPanel) {
            rightPanel.style.maxHeight = 'none';
        }
    } else if (isMobile) {
        // Portrait mobile - stacked layout
        testContainer.style.flexDirection = 'column';
    }
}

/**
 * Prevent Body Scroll when Modals are Open
 */
function preventBodyScroll(prevent) {
    if (prevent) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    } else {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
    }
}

/**
 * Swipe Gesture Support for Mobile
 */
class SwipeDetector {
    constructor(element, onSwipeLeft, onSwipeRight) {
        this.element = element;
        this.onSwipeLeft = onSwipeLeft;
        this.onSwipeRight = onSwipeRight;
        this.startX = 0;
        this.startY = 0;
        this.distX = 0;
        this.distY = 0;
        this.threshold = 100; // Minimum distance for swipe
        this.restraint = 100; // Maximum perpendicular distance
        this.allowedTime = 300; // Maximum time for swipe
        this.startTime = 0;
        
        this.init();
    }
    
    init() {
        this.element.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.element.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
        this.element.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    }
    
    handleTouchStart(e) {
        const touchObj = e.changedTouches[0];
        this.startX = touchObj.pageX;
        this.startY = touchObj.pageY;
        this.startTime = new Date().getTime();
    }
    
    handleTouchMove(e) {
        // Optional: Show visual feedback during swipe
    }
    
    handleTouchEnd(e) {
        const touchObj = e.changedTouches[0];
        this.distX = touchObj.pageX - this.startX;
        this.distY = touchObj.pageY - this.startY;
        const elapsedTime = new Date().getTime() - this.startTime;
        
        if (elapsedTime <= this.allowedTime) {
            if (Math.abs(this.distX) >= this.threshold && Math.abs(this.distY) <= this.restraint) {
                if (this.distX < 0 && this.onSwipeLeft) {
                    this.onSwipeLeft();
                } else if (this.distX > 0 && this.onSwipeRight) {
                    this.onSwipeRight();
                }
            }
        }
    }
}

/**
 * Add Swipe Support to Test Interface
 */
function addTestInterfaceSwipeSupport() {
    const questionPanel = document.querySelector('.gate-question-panel');
    if (!questionPanel) return;
    
    new SwipeDetector(
        questionPanel,
        () => {
            // Swipe left - next question
            const saveNextBtn = document.getElementById('gateSaveNextBtn');
            if (saveNextBtn && window.innerWidth <= 768) {
                // Optional: Add visual feedback
                saveNextBtn.click();
            }
        },
        () => {
            // Swipe right - previous question (if needed)
            // Could implement previous question navigation here
        }
    );
}

/**
 * Optimize Images for Mobile
 */
function optimizeImagesForMobile() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        // Add loading="lazy" for better performance
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }
        
        // Add proper alt text if missing
        if (!img.alt) {
            img.alt = 'Image';
        }
    });
}

/**
 * Add Touch Ripple Effect
 */
function addTouchRippleEffect(element) {
    element.addEventListener('touchstart', function(e) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        
        const rect = this.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const y = e.touches[0].clientY - rect.top;
        
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }, { passive: true });
}

/**
 * Initialize Touch Ripple on Buttons
 */
function initializeTouchRipple() {
    const buttons = document.querySelectorAll('.btn, .gate-palette-btn, .nav-item');
    buttons.forEach(button => {
        if (!button.classList.contains('ripple-initialized')) {
            addTouchRippleEffect(button);
            button.classList.add('ripple-initialized');
        }
    });
}

/**
 * Handle Safe Area Insets for iOS
 */
function handleSafeAreaInsets() {
    // Check if device supports safe area insets (iOS)
    const supportsCSS = CSS.supports('padding-top: env(safe-area-inset-top)');
    
    if (supportsCSS) {
        document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
        document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
        document.documentElement.style.setProperty('--safe-area-left', 'env(safe-area-inset-left)');
        document.documentElement.style.setProperty('--safe-area-right', 'env(safe-area-inset-right)');
    }
}

/**
 * Initialize all mobile features
 */
function initializeAllMobileFeatures() {
    initializeMobileMenu();
    initializeDashboardMobileMenu();
    handleOrientationChange();
    optimizeImagesForMobile();
    initializeTouchRipple();
    handleSafeAreaInsets();
    
    // Add test interface swipe support when test starts
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'test-interface' && 
                mutation.target.style.display === 'flex') {
                addTestInterfaceSwipeSupport();
            }
        });
    });
    
    const testInterface = document.getElementById('test-interface');
    if (testInterface) {
        observer.observe(testInterface, { attributes: true, attributeFilter: ['style'] });
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAllMobileFeatures);
} else {
    initializeAllMobileFeatures();
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openMobileMenu,
        closeMobileMenu,
        toggleMobileMenu,
        openDashboardSidebar,
        closeDashboardSidebar,
        toggleDashboardSidebar,
        preventBodyScroll,
        SwipeDetector
    };
}