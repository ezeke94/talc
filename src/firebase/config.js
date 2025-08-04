import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdCtN1WsoNtMFAwEUDv34pJy4lT6a3I38",
  authDomain: "kpi-talc.firebaseapp.com",
  projectId: "kpi-talc",
  storageBucket: "kpi-talc.firebasestorage.app",
  messagingSenderId: "67217863373",
  appId: "1:67217863373:web:d014a8576b8bd7cfdd6f84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services for use throughout the app
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export default app;