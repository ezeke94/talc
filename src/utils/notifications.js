import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '../firebase/config';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// Request notification permission and save FCM token to user document
export async function setupNotifications(currentUser) {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported in this browser; web push unavailable.');
      return null;
    }

    // Register or get existing service worker for FCM
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const messaging = getMessaging();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (token && currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          notificationTokens: arrayUnion(token)
        });

        // foreground messages: show a simple notification if desired
        onMessage(messaging, (payload) => {
          try {
            if (payload && payload.notification && Notification.permission === 'granted') {
              const { title, body } = payload.notification;
              // Show a notification via the ServiceWorker registration for better behavior
              registration.showNotification(title, { body });
            }
          } catch (e) {
            console.warn('Failed to display foreground notification', e);
          }
        });

        return token;
      }
    }
  } catch (err) {
    console.error('Notification setup failed:', err);
  }
  return null;
}
