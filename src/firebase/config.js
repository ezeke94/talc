import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, indexedDBLocalPersistence, useDeviceLanguage } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services for use throughout the app
export const auth = getAuth(app);

// CRITICAL: Set the app verification disabled for testing in PWA mode
// This helps debug auth issues in standalone mode
if (import.meta.env?.DEV) {
  console.log('Firebase Config:', {
    authDomain: firebaseConfig.authDomain,
    apiKey: firebaseConfig.apiKey ? '***' : 'MISSING',
    projectId: firebaseConfig.projectId
  });
}

// Use the device/browser language for OAuth flows
try { useDeviceLanguage(auth); } catch { /* noop */ }

// Enhanced auth persistence setup for PWAs with better error handling
export const persistencePromise = (async () => {
  try {
    // iOS PWA-specific: Check if we're in standalone mode
    const isIOSPWA = () => {
      try {
        return /iPhone|iPad/.test(navigator.userAgent) && 
               (!!window.navigator?.standalone || 
                window.matchMedia?.('(display-mode: standalone)')?.matches);
      } catch {
        return false;
      }
    };

    // First, test if localStorage is available and working
    try {
      const testKey = 'firebase-test-' + Date.now();
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      // Verify the value was actually stored (iOS PWA quirk)
      if (value === 'test') {
        // localStorage is working, use it
        await setPersistence(auth, browserLocalPersistence);
        console.debug('Firebase: LocalStorage persistence configured successfully', isIOSPWA() ? '(iOS PWA)' : '');
        return 'localstorage';
      } else {
        throw new Error('LocalStorage write verification failed');
      }
    } catch (localStorageError) {
      console.warn('Firebase: LocalStorage test failed, trying IndexedDB:', localStorageError?.message);
    }
    
    // Fall back to IndexedDB
    if (typeof indexedDB !== 'undefined') {
      try {
        const testRequest = indexedDB.open('firebase-test', 1);
        await new Promise((resolve, reject) => {
          testRequest.onsuccess = () => {
            testRequest.result.close();
            indexedDB.deleteDatabase('firebase-test');
            resolve();
          };
          testRequest.onerror = () => reject(testRequest.error);
          testRequest.onblocked = () => reject(new Error('IndexedDB blocked'));
          setTimeout(() => reject(new Error('IndexedDB timeout')), 5000);
        });
        
        // IndexedDB is working, use it
        await setPersistence(auth, indexedDBLocalPersistence);
        console.debug('Firebase: IndexedDB persistence configured successfully', isIOSPWA() ? '(iOS PWA)' : '');
        return 'indexeddb';
      } catch (indexedDBError) {
        console.warn('Firebase: IndexedDB test failed:', indexedDBError?.message);
      }
    }
    
    console.warn('Firebase: All auth persistence mechanisms failed, using session persistence', isIOSPWA() ? '(iOS PWA)' : '');
    return 'none';
    
  } catch (error) {
    console.error('Firebase: Auth persistence setup failed:', error);
    // Don't throw - let the app continue without persistence
    return 'none';
  }
})();
export const googleProvider = new GoogleAuthProvider();
// Encourage account chooser to avoid silent account reuse issues
try { googleProvider.setCustomParameters({ prompt: 'select_account' }); } catch { /* noop */ }

// CRITICAL FIX for PWA: Add custom parameters to help with redirect flow
// This ensures the OAuth flow works correctly in installed PWA mode
try {
  // For PWAs, we need to explicitly set the redirect parameter
  const isPWAMode = () => {
    try {
      return window.navigator.standalone || 
             window.matchMedia('(display-mode: standalone)').matches ||
             window.matchMedia('(display-mode: window-controls-overlay)').matches;
    } catch {
      return false;
    }
  };
  
  if (isPWAMode()) {
    console.log('Firebase: Configuring auth for PWA mode');
    // Set additional parameters for better PWA compatibility
    googleProvider.setCustomParameters({
      prompt: 'select_account',
      // Ensure redirect works properly in PWA
      display: 'page' // Use full page instead of popup for better PWA support
    });
  }
} catch (e) {
  console.warn('Firebase: Could not configure PWA-specific auth parameters:', e);
}
// Use long polling to avoid QUIC/HTTP3 issues on some networks and hosts.
// Only one of these options may be used at a time; prefer force in production for stability.
const firestoreSettings = import.meta.env?.PROD
  ? { experimentalForceLongPolling: true, useFetchStreams: false }
  : { experimentalAutoDetectLongPolling: true };

export const db = initializeFirestore(app, firestoreSettings);

// Initialize Firebase Messaging for notifications
let messaging = null;
try {
  // Only initialize messaging in supported environments
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase Messaging not supported in this environment:', error);
}

export { messaging };
export default app;
