// Enhanced notification utilities for TALC Management Application
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isIOS, isPWA } from './pwaUtils';
import { 
  generateNotificationId, 
  isDuplicateNotification, 
  saveNotificationToHistory,
  cleanupDedupData 
} from './notificationHistory';

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
export async function setupNotifications(currentUser, deviceName = null) {
  if (!currentUser) {
    console.log('No user provided to setup notifications');
    return null;
  }

  if (isIOS() && !isPWA()) {
    console.warn('iOS system notifications require the app to be installed as a PWA (Add to Home Screen).');
    showCustomNotification(
      'Enable Notifications on iPhone',
      'Add TALC to your Home Screen, then reopen it to enable system notifications.',
      '/favicon.ico'
    );
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

    // Ensure the messaging service worker is registered at the root scope
    let swReg = null;
    try {
      console.log('Checking for existing service worker registrations...');
      // First check all registrations to find firebase messaging SW
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('Found service worker registrations:', registrations.length);
      swReg = registrations.find(reg => {
        const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
        const isFirebaseSW = scriptUrl && scriptUrl.includes('firebase-messaging-sw.js');
        console.log('Checking SW:', scriptUrl, 'isFirebase:', isFirebaseSW);
        return isFirebaseSW;
      });

      if (!swReg) {
        console.log('No firebase messaging SW found, registering new one...');
        // Register it if not found, with explicit root scope
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        console.log('Registered firebase-messaging-sw.js with scope:', swReg.scope);
        // Wait for it to be ready
        await navigator.serviceWorker.ready;
        console.log('Service worker is ready');
      } else {
        console.log('Found existing firebase-messaging-sw.js registration:', swReg.scope);
      }
    } catch (swErr) {
      console.warn('Service worker registration failed or unavailable:', swErr);
    }

    const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: swReg || undefined });
    if (!token) {
      console.warn('No FCM token received - this could be due to service worker issues or VAPID key problems');
      return null;
    }

    console.log('FCM registration token obtained:', token ? 'token_received' : 'no_token');

    // Store token in localStorage for device identification
    localStorage.setItem('fcmToken', token);

    // Record this device token in the devices subcollection (this is the source of truth)
    try {
      const deviceRef = doc(db, 'users', currentUser.uid, 'devices', token);
      
      // Check if this device already exists to preserve createdAt
      const existingDevice = await getDoc(deviceRef);
      
      if (existingDevice.exists()) {
        // Device exists - update it (re-enabling)
        console.log('Device already registered, updating...');
        await setDoc(deviceRef, {
          token,
          name: deviceName || existingDevice.data().name || null,
          platform: navigator?.platform || 'web',
          userAgent: navigator?.userAgent || '',
          lastSeenAt: serverTimestamp(),
          enabled: true
        }, { merge: true });
      } else {
        // New device - create it
        console.log('Registering new device...');
        await setDoc(deviceRef, {
          token,
          name: deviceName || null,
          platform: navigator?.platform || 'web',
          userAgent: navigator?.userAgent || '',
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          enabled: true
        });
      }
      
      console.log('Device token successfully saved to subcollection');
    } catch (e) {
      console.error('Failed to record device token to subcollection:', e);
      return null;
    }

    // Update main user document with notification status (but NOT the token)
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        notificationsEnabled: true,
        lastTokenUpdate: new Date()
      }, { merge: true });
      console.log('User notification status updated');
    } catch (firestoreError) {
      console.warn('Failed to update user notification status (non-fatal):', firestoreError);
    }

    // Setup foreground message handler with deduplication
    // NOTE: On Android, we want the service worker to handle notifications even when the app is open
    // so they appear as system notifications. Only show custom in-app UI for iOS in certain cases.
    onMessage(msg, (payload) => {
      console.log('[Foreground] Message received');
      
      // Check if document is actually visible (not in background tab)
      if (document.hidden || document.visibilityState !== 'visible') {
        console.log('[Foreground] Document not visible, letting service worker handle it');
        return; // Let service worker handle it
      }
      
      console.log('[Foreground] Document is visible, handling notification in foreground');
      
      // Generate notification ID
      const notificationId = generateNotificationId(payload);
      
      // Check for duplicates
      if (isDuplicateNotification(notificationId, 'foreground', payload)) {
        console.log('[Foreground] Duplicate blocked');
        return; // Don't show duplicate
      }
      
      // Save to history
      saveNotificationToHistory({
        ...payload,
        id: notificationId,
        source: 'foreground'
      });
      
      // Let service worker handle it for system notifications on Android
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        // Forward to service worker to display as system notification
        navigator.serviceWorker.controller.postMessage({
          type: 'NOTIFICATION_RECEIVED',
          payload: payload,
          notificationId: notificationId
        });
      } else {
        // Fallback: show custom notification if no service worker
        const { title, body, icon } = payload.notification || {};
        if (title) {
          showCustomNotification(title, body, icon, payload.data);
        }
      }
    });
    
    // Listen for service worker messages about notifications
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NOTIFICATION_RECEIVED') {
          const { notificationId, timestamp, source } = event.data;
          
          // Service worker received a notification, mark it in our dedup system
          if (notificationId && !isDuplicateNotification(notificationId, source)) {
            console.log(`[App] Notification received by ${source}:`, notificationId);
          }
        }
      });
    }
    
    // Cleanup old dedup data periodically
    setInterval(() => {
      cleanupDedupData();
    }, 60000); // Every minute

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
    // Get current token from localStorage
    const currentToken = localStorage.getItem('fcmToken');
    
    // Remove token from localStorage
    localStorage.removeItem('fcmToken');
    
    // Update main user document status (remove fcmToken if it exists)
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, {
      fcmToken: null, // Explicitly remove the old fcmToken field
      notificationsEnabled: false,
      lastTokenUpdate: new Date()
    }, { merge: true });

    // Also disable the device in the devices subcollection instead of removing it
    if (currentToken) {
      try {
        const deviceRef = doc(db, 'users', currentUser.uid, 'devices', currentToken);
        await setDoc(deviceRef, {
          enabled: false,
          lastSeenAt: serverTimestamp()
        }, { merge: true });
        console.log('Device disabled in subcollection');
      } catch (deviceError) {
        console.warn('Failed to disable device in subcollection:', deviceError);
      }
    }

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
