import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

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

// Enhanced auth persistence setup for PWAs with better error handling
export const persistencePromise = (async () => {
  try {
    // First, test if IndexedDB is available and working
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
        console.debug('Firebase: IndexedDB persistence configured successfully');
        return 'indexeddb';
      } catch (indexedDBError) {
        console.warn('Firebase: IndexedDB test failed, falling back to localStorage:', indexedDBError);
      }
    }
    
    // Fall back to localStorage
    await setPersistence(auth, browserLocalPersistence);
    console.debug('Firebase: LocalStorage persistence configured successfully');
    return 'localstorage';
    
  } catch (error) {
    console.error('Firebase: All auth persistence mechanisms failed:', error);
    // Don't throw - let the app continue without persistence
    return 'none';
  }
})();
export const googleProvider = new GoogleAuthProvider();
// Use long polling to avoid QUIC/HTTP3 issues on some networks and hosts.
// Only one of these options may be used at a time; prefer force in production for stability.
const firestoreSettings = import.meta.env?.PROD
  ? { experimentalForceLongPolling: true, useFetchStreams: false }
  : { experimentalAutoDetectLongPolling: true };

export const db = initializeFirestore(app, firestoreSettings);

export default app;
