// Enhanced PWA utility functions for better mobile experience on Android and iPhone

export const isPWA = () => {
  try {
    return (
      window.navigator.standalone ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.location.search.includes('utm_source=homescreen') ||
      document.referrer === "" ||
      document.referrer.includes("android-app://")
    );
  } catch (e) {
    return false;
  }
};

export const isIOS = () => {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  } catch (e) {
    return false;
  }
};

export const isAndroid = () => {
  try {
    return /Android/.test(navigator.userAgent);
  } catch (e) {
    return false;
  }
};

export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(userAgent);
  const isSamsung = /Samsung/.test(userAgent);
  const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
  const isSafari = /Safari/.test(userAgent) && /Apple Computer/.test(navigator.vendor);
  
  return {
    isIOS,
    isAndroid,
    isSamsung,
    isChrome,
    isSafari,
    isPWA: isPWA(),
    standalone: window.navigator.standalone,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    }
  };
};

// Enhanced iOS-specific optimizations
export const setupIOSOptimizations = () => {
  if (!isIOS()) return;

  console.log('PWA: Setting up iOS optimizations');

  // Prevent iOS zoom on input focus
  const preventZoom = () => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      const content = meta.getAttribute('content');
      if (!content.includes('maximum-scale')) {
        meta.setAttribute('content', content + ', maximum-scale=1.0');
      }
    }
  };

  // Handle iOS safe area
  const handleSafeArea = () => {
    const root = document.documentElement;
    if (CSS.supports('padding: env(safe-area-inset-top)')) {
      root.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
      root.style.setProperty('--safe-area-right', 'env(safe-area-inset-right)');
      root.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
      root.style.setProperty('--safe-area-left', 'env(safe-area-inset-left)');
    }
  };

  // Improve iOS scrolling
  const improveScrolling = () => {
    document.body.style.webkitOverflowScrolling = 'touch';
    document.body.style.overscrollBehavior = 'contain';
  };

  // Handle iOS keyboard
  const handleKeyboard = () => {
    let initialViewportHeight = window.innerHeight;
    
    const checkKeyboard = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      if (heightDifference > 150) {
        // Keyboard is likely open
        document.body.classList.add('keyboard-open');
        // Adjust FAB position
        const fab = document.querySelector('.MuiFab-root');
        if (fab) {
          fab.style.bottom = '16px';
        }
      } else {
        // Keyboard is closed
        document.body.classList.remove('keyboard-open');
        const fab = document.querySelector('.MuiFab-root');
        if (fab) {
          fab.style.bottom = '';
        }
      }
    };

    window.addEventListener('resize', checkKeyboard);
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        initialViewportHeight = window.innerHeight;
        checkKeyboard();
      }, 500);
    });
  };

  preventZoom();
  handleSafeArea();
  improveScrolling();
  handleKeyboard();
};

// Enhanced Android-specific optimizations
export const setupAndroidOptimizations = () => {
  if (!isAndroid()) return;

  console.log('PWA: Setting up Android optimizations');

  // Improve Android touch feedback
  const improveTouchFeedback = () => {
    const style = document.createElement('style');
    style.textContent = `
      .MuiButton-root:active,
      .MuiIconButton-root:active,
      .MuiFab-root:active {
        transform: scale(0.98);
        transition: transform 0.1s ease;
      }
      
      .MuiTouchRipple-root {
        color: rgba(123,198,120,0.3) !important;
      }
    `;
    document.head.appendChild(style);
  };

  // Handle Android navigation bar
  const handleNavigationBar = () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#7BC678';
    document.head.appendChild(meta);

    // Handle navigation bar color changes based on scroll
    let ticking = false;
    const updateThemeColor = () => {
      const scrolled = window.scrollY > 0;
      const existingMeta = document.querySelector('meta[name="theme-color"]');
      if (existingMeta) {
        existingMeta.content = scrolled ? '#4F9B4E' : '#7BC678';
      }
      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateThemeColor);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestTick, { passive: true });
  };

  // Optimize Android performance
  const optimizePerformance = () => {
    // Enable hardware acceleration for smoother animations
    const style = document.createElement('style');
    style.textContent = `
      .MuiCard-root,
      .MuiPaper-root,
      .MuiFab-root {
        will-change: transform;
        transform: translateZ(0);
      }
    `;
    document.head.appendChild(style);
  };

  improveTouchFeedback();
  handleNavigationBar();
  optimizePerformance();
};

// Handle PWA app visibility changes
export const setupPWAVisibilityHandlers = () => {
  if (!isPWA()) return;

  // Handle page visibility changes for PWA
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('PWA: App became visible');
      // Trigger auth state check when app becomes visible
      window.dispatchEvent(new CustomEvent('pwa-app-visible'));
      
      // Refresh theme color for Android
      if (isAndroid()) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
          meta.content = '#7BC678';
        }
      }
    } else {
      console.log('PWA: App became hidden');
      // Clean up any pending auth operations
      window.dispatchEvent(new CustomEvent('pwa-app-hidden'));
    }
  });

  // Handle focus/blur for better state management
  window.addEventListener('focus', () => {
    console.log('PWA: App gained focus');
    window.dispatchEvent(new CustomEvent('pwa-app-focus'));
  });

  window.addEventListener('blur', () => {
    console.log('PWA: App lost focus');
    window.dispatchEvent(new CustomEvent('pwa-app-blur'));
  });

  // Handle beforeunload for PWA
  window.addEventListener('beforeunload', (event) => {
    if (isPWA()) {
      console.log('PWA: App is being unloaded');
      // Clear any auth cache that might cause issues
      if ('caches' in window) {
        caches.open('talc-cache-v1').then(cache => {
          // Signal service worker to clear auth cache
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'CLEAR_AUTH_CACHE'
            });
          }
        }).catch(() => {});
      }
    }
  });
};

// Enhanced mobile performance optimizations
export const optimizeMobilePerformance = () => {
  // Optimize font loading
  const optimizeFonts = () => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://fonts.googleapis.com';
    document.head.appendChild(link);

    const link2 = document.createElement('link');
    link2.rel = 'preconnect';
    link2.href = 'https://fonts.gstatic.com';
    link2.crossOrigin = 'anonymous';
    document.head.appendChild(link2);
  };

  // Optimize image loading
  const optimizeImages = () => {
    // Add intersection observer for lazy loading
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              observer.unobserve(img);
            }
          }
        });
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  };

  // Optimize animations for mobile
  const optimizeAnimations = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (prefersReducedMotion.matches) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  };

  optimizeFonts();
  optimizeImages();
  optimizeAnimations();
};

// Refresh auth state for PWA
export const refreshPWAAuthState = () => {
  if (!isPWA()) return;
  
  console.log('PWA: Refreshing auth state');
  
  // Clear localStorage auth cache that might be stale
  try {
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('firebase:authUser') || 
      key.includes('firebase:host')
    );
    
    // Don't clear all auth data, just refresh it
    console.log('PWA: Found auth keys in localStorage:', authKeys);
  } catch (e) {
    console.warn('PWA: Could not access localStorage:', e);
  }
};

// Setup PWA-specific error handlers
export const setupPWAErrorHandlers = () => {
  if (!isPWA()) return;

  window.addEventListener('error', (event) => {
    console.error('PWA: Global error:', event.error);
    
    // Handle specific auth-related errors in PWA mode
    if (event.error?.message?.includes('auth') || 
        event.error?.message?.includes('firebase')) {
      console.warn('PWA: Auth-related error detected, may need refresh');
      
      // Dispatch custom event for auth error handling
      window.dispatchEvent(new CustomEvent('pwa-auth-error', {
        detail: { error: event.error }
      }));
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('PWA: Unhandled promise rejection:', event.reason);
    
    // Handle Firebase auth promise rejections
    if (event.reason?.code?.startsWith?.('auth/')) {
      console.warn('PWA: Firebase auth promise rejection:', event.reason.code);
      
      window.dispatchEvent(new CustomEvent('pwa-auth-promise-error', {
        detail: { error: event.reason }
      }));
    }
  });
};

// Initialize all PWA handlers with mobile optimizations
export const initializePWAHandlers = () => {
  const deviceInfo = getDeviceInfo();
  
  console.log('PWA: Initializing handlers with device info:', deviceInfo);
  
  if (!isPWA()) {
    console.log('App is running in browser mode');
    // Still apply mobile optimizations for browser usage
    if (deviceInfo.isIOS) setupIOSOptimizations();
    if (deviceInfo.isAndroid) setupAndroidOptimizations();
    optimizeMobilePerformance();
    return;
  }

  console.log('PWA: Initializing PWA handlers');
  setupPWAVisibilityHandlers();
  setupPWAErrorHandlers();
  optimizeMobilePerformance();
  
  // Platform-specific optimizations
  if (deviceInfo.isIOS) {
    setupIOSOptimizations();
  }
  
  if (deviceInfo.isAndroid) {
    setupAndroidOptimizations();
  }
  
  // Log comprehensive environment info
  console.log('PWA Environment:', {
    ...deviceInfo,
    url: window.location.href,
    referrer: document.referrer,
    displayMode: getComputedStyle(document.documentElement).getPropertyValue('--display-mode') || 'browser'
  });
};