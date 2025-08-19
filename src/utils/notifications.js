import { getMessaging, getToken } from 'firebase/messaging';
import { db } from '../firebase/config';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// Request notification permission and save FCM token to user document
export async function setupNotifications(currentUser) {
  try {
    const messaging = getMessaging();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const token = await getToken(messaging, { vapidKey });
      if (token && currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          notificationTokens: arrayUnion(token)
        });
        return token;
      }
    }
  } catch (err) {
    console.error('Notification setup failed:', err);
  }
  return null;
}
