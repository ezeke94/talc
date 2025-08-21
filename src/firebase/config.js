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
// Set auth persistence. Start with the most robust (IndexedDB), and fall back
// to localStorage. This is crucial for PWAs/standalone apps where session
// storage is unreliable.
export const persistencePromise = setPersistence(auth, indexedDBLocalPersistence)
  .catch((error) => {
    console.warn(
      "Firebase: IndexedDB persistence failed. Falling back to local storage.",
      error
    );
    return setPersistence(auth, browserLocalPersistence);
  })
  .catch((error) => {
    console.error("Firebase: All auth persistence mechanisms failed.", error);
  });
export const googleProvider = new GoogleAuthProvider();
// Use long polling to avoid QUIC/HTTP3 issues on some networks and hosts.
// Only one of these options may be used at a time; prefer force in production for stability.
const firestoreSettings = import.meta.env?.PROD
  ? { experimentalForceLongPolling: true, useFetchStreams: false }
  : { experimentalAutoDetectLongPolling: true };

export const db = initializeFirestore(app, firestoreSettings);

export default app;
