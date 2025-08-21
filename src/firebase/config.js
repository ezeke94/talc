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
// Ensure auth state persists across tabs and reloads.
// Prefer IndexedDB-backed persistence in regular browsers but fall back to
// browserLocalPersistence (localStorage) when running as an installed PWA or
// in iOS standalone mode where IndexedDB/storage may be restricted.
// Export a promise so callers can await persistence being configured.
const detectStandalone = () => {
  try {
    if (typeof window === 'undefined') return false;
    // iOS older standalone flag or modern display-mode
    if (window.navigator && window.navigator.standalone) return true;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    return false;
  } catch (e) {
    return false;
  }
};

const preferredPersistence = detectStandalone() ? browserLocalPersistence : indexedDBLocalPersistence;

export const persistencePromise = setPersistence(auth, preferredPersistence).catch((e) => {
  console.warn('Preferred auth persistence failed, attempting fallbacks:', e);
  // Try the other persistence option next
  const fallback = preferredPersistence === indexedDBLocalPersistence ? browserLocalPersistence : indexedDBLocalPersistence;
  return setPersistence(auth, fallback).catch((e2) => {
    console.warn('Fallback auth persistence failed, proceeding without explicit persistence:', e2);
    return undefined;
  });
});
export const googleProvider = new GoogleAuthProvider();
// Use long polling to avoid QUIC/HTTP3 issues on some networks and hosts.
// Only one of these options may be used at a time; prefer force in production for stability.
const firestoreSettings = import.meta.env?.PROD
  ? { experimentalForceLongPolling: true, useFetchStreams: false }
  : { experimentalAutoDetectLongPolling: true };

export const db = initializeFirestore(app, firestoreSettings);

export default app;
