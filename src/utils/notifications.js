// Enhanced notification utilities for TALC Management Application
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

let messaging = null;

// Initialize Firebase Messaging
const initMessaging = () => {
  if (!messaging && 'serviceWorker' in navigator && 'PushManager' in window) {
    try {
      messaging = getMessaging();
      console.log('Firebase Messaging initialized');
    } catch (error) {
      console.warn('Firebase Messaging initialization failed:', error);
    }
  }
  return messaging;
};

// Request notification permission and setup FCM
export async function setupNotifications(currentUser) {
  if (!currentUser) {
    console.log('No user provided to setup notifications');
    return null;
  }

  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Initialize messaging
    const msg = initMessaging();
    if (!msg) {
      console.warn('Could not initialize Firebase Messaging');
      return null;
    }

    // Get FCM registration token
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VAPID key not configured');
      return null;
    }

    const token = await getToken(msg, { vapidKey });
    if (!token) {
      console.warn('No FCM token received');
      return null;
    }

    console.log('FCM registration token obtained:', token);

    // Save token to user document (merge ensures doc is created if missing)
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      fcmToken: token,
      notificationsEnabled: true,
      lastTokenUpdate: new Date()
    }, { merge: true });

    // Additionally, record this device token in a subcollection for multi-device support
    try {
      const deviceRef = doc(db, 'users', currentUser.uid, 'devices', token);
      await setDoc(deviceRef, {
        token,
        platform: navigator?.platform || 'web',
        userAgent: navigator?.userAgent || '',
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        enabled: true
      }, { merge: true });
    } catch (e) {
      console.warn('Failed to record device token subdoc (non-fatal):', e);
    }

    // Setup foreground message handler
    onMessage(msg, (payload) => {
      console.log('Foreground message received:', payload);
      
      // Show custom notification for foreground messages
      const { title, body, icon } = payload.notification || {};
      if (title) {
        showCustomNotification(title, body, icon, payload.data);
      }
    });

    return token;

  } catch (error) {
    console.error('Error setting up notifications:', error);
    return null;
  }
}

// Show custom in-app notification
function showCustomNotification(title, body, icon, data) {
  // Create custom notification UI (you can style this)
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      ${icon ? `<img src="${icon}" style="width: 24px; height: 24px; flex-shrink: 0;">` : ''}
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 4px; color: #333;">${title}</div>
        <div style="color: #666; font-size: 14px;">${body}</div>
        ${data?.url ? `<button onclick="window.location.href='${data.url}'" style="
          background: #1976d2; 
          color: white; 
          border: none; 
          padding: 6px 12px; 
          border-radius: 4px; 
          margin-top: 8px; 
          cursor: pointer;
          font-size: 12px;
        ">View</button>` : ''}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: none; 
        border: none; 
        font-size: 18px; 
        cursor: pointer; 
        color: #999;
        padding: 0;
        width: 20px;
        height: 20px;
      ">&times;</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 7 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 7000);

  // Click to navigate
  if (data?.url) {
    notification.style.cursor = 'pointer';
    notification.addEventListener('click', () => {
      window.location.href = data.url;
    });
  }
}

// Disable notifications for a user
export async function disableNotifications(currentUser) {
  if (!currentUser) return;

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      fcmToken: null,
      notificationsEnabled: false,
      lastTokenUpdate: new Date()
    }, { merge: true });

    console.log('Notifications disabled for user');
    return true;
  } catch (error) {
    console.error('Error disabling notifications:', error);
    return false;
  }
}

// Check if notifications are supported and enabled
export function getNotificationStatus() {
  return {
    supported: 'Notification' in window && 'serviceWorker' in navigator,
    permission: 'Notification' in window ? Notification.permission : 'default',
    messagingSupported: messaging !== null
  };
}
