// Firebase messaging service worker for TALC Management Application
// This handles background push notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
importScripts('/firebase-config.js'); // Auto-generated config

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Notification deduplication tracking
// Store notification IDs with timestamps to prevent duplicates
const notificationHistory = new Map();
const DEDUP_WINDOW_MS = 10000; // 10 seconds window for deduplication

/**
 * Generate unique notification ID based on content
 * This ensures same notification content doesn't show twice
 */
function generateNotificationId(payload) {
  const { type, eventId, url } = payload.data || {};
  const { title, body } = payload.notification || {};
  
  // Create unique ID from notification characteristics
  const idParts = [
    type || 'general',
    eventId || '',
    title || '',
    body || ''
  ].filter(Boolean);
  
  const id = idParts.join('-');
  
  console.log('[SW] Generated notification ID:', {
    id: id.substring(0, 100),
    type,
    eventId,
    title: (title || '').substring(0, 50),
    body: (body || '').substring(0, 50)
  });
  
  return id;
}

/**
 * Check if notification was already shown recently
 * Returns true if duplicate, false if should be shown
 */
function isDuplicateNotification(notificationId) {
  const now = Date.now();
  
  console.log('[SW] Checking for duplicate:', {
    notificationId: notificationId.substring(0, 100),
    currentMapSize: notificationHistory.size
  });
  
  // Clean up old entries (older than dedup window)
  for (const [id, timestamp] of notificationHistory.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      console.log(`[SW] Cleaning up old entry: ${id.substring(0, 50)}... (${now - timestamp}ms old)`);
      notificationHistory.delete(id);
    }
  }
  
  // Check if this notification was already shown
  if (notificationHistory.has(notificationId)) {
    const lastShown = notificationHistory.get(notificationId);
    const timeSinceLastShown = now - lastShown;
    
    if (timeSinceLastShown < DEDUP_WINDOW_MS) {
      console.warn('[SW] ⚠️ DUPLICATE DETECTED in service worker!', {
        notificationId: notificationId.substring(0, 100),
        timeSinceLastShown: `${timeSinceLastShown}ms`,
        windowLimit: `${DEDUP_WINDOW_MS}ms`
      });
      return true; // It's a duplicate
    }
  }
  
  // Record this notification
  notificationHistory.set(notificationId, now);
  
  console.log('[SW] ✅ NEW notification recorded in service worker:', {
    notificationId: notificationId.substring(0, 100),
    timestamp: new Date(now).toISOString(),
    mapSize: notificationHistory.size
  });
  
  // Also save to IndexedDB for persistence and history
  saveNotificationToHistory(notificationId, now);
  
  return false; // Not a duplicate
}

/**
 * Save notification to IndexedDB for history tracking
 */
function saveNotificationToHistory(notificationId, timestamp) {
  // We'll use a simple approach with postMessage to main app
  // The main app will handle localStorage storage
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_RECEIVED',
        notificationId,
        timestamp,
        source: 'background'
      });
    });
  });
}

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[SW] 📨 BACKGROUND MESSAGE RECEIVED');
  console.log('[SW] Payload:', JSON.stringify(payload, null, 2));
  console.log('[SW] Timestamp:', new Date().toISOString());
  console.log('[SW] App is in background or closed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Generate unique ID for this notification
  const notificationId = generateNotificationId(payload);
  console.log('[SW] Generated ID:', notificationId.substring(0, 100));
  
  // Check for duplicates
  if (isDuplicateNotification(notificationId)) {
    console.warn('[SW] ❌ Duplicate notification BLOCKED');
    console.warn('[SW] This notification was already shown within the last 10 seconds');
    return; // Don't show duplicate
  }
  
  console.log('[SW] ✅ New notification - proceeding to show');
  
  const { title, body, icon } = payload.notification || {};
  const { type, url, eventId } = payload.data || {};

  // Customize notification based on type
  let notificationTitle = title || 'TALC Notification';
  let notificationOptions = {
    body: body || 'You have a new notification',
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: `${type || 'general'}-${eventId || Date.now()}`, // Unique tag per notification
    data: {
      url: url || '/',
      type: type,
      eventId: eventId,
      notificationId: notificationId, // Store for tracking
      timestamp: Date.now()
    },
    requireInteraction: false, // Don't require user interaction for most notifications
    silent: false
  };

  // Customize based on notification type
  switch (type) {
    case 'event_reminder':
    case 'event_reminder_owner':
    case 'event_reminder_quality':
    case 'event_reminder_owner_same_day':
      notificationOptions.requireInteraction = true; // Important events need attention
      notificationOptions.actions = [
        { action: 'view', title: 'View Event', icon: '/favicon.ico' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
      // Customize message based on timing
      if (type === 'event_reminder_owner') {
        notificationOptions.tag = 'event_reminder_tomorrow';
      } else if (type.includes('same_day')) {
        notificationOptions.tag = 'event_reminder_today';
        notificationOptions.requireInteraction = true; // More urgent for same day
      }
      break;
      
    case 'event_reschedule':
    case 'event_cancellation':
      notificationOptions.requireInteraction = true;
      notificationOptions.tag = 'event_change'; // Group event changes
      break;
      
    case 'task_overdue':
      notificationOptions.requireInteraction = true;
      notificationOptions.actions = [
        { action: 'view', title: 'View Tasks', icon: '/favicon.ico' },
        { action: 'snooze', title: 'Remind Later' }
      ];
      break;
      
    case 'kpi_reminder':
      notificationOptions.actions = [
        { action: 'view', title: 'View Mentors', icon: '/favicon.ico' },
        { action: 'dismiss', title: 'Later' }
      ];
      break;
      
    case 'system_alert':
      notificationOptions.requireInteraction = true;
      notificationOptions.silent = false;
      notificationOptions.tag = 'critical_alert';
      break;
      
    case 'monthly_summary':
      notificationOptions.requireInteraction = false;
      notificationOptions.actions = [
        { action: 'view', title: 'View Dashboard', icon: '/favicon.ico' }
      ];
      break;
  }

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();
  
  const { url, type } = event.notification.data || {};
  const action = event.action;
  
  // Handle different actions
  if (action === 'dismiss' || action === 'snooze') {
    // For snooze, we could schedule a reminder, but for simplicity just dismiss
    return;
  }
  
  // Default action or 'view' action - open the app
  const targetUrl = url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      
      // Open new window if no existing window found
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close events (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event.notification.data?.type);
});

// Handle messages from the main app (for foreground notifications)
self.addEventListener('message', (event) => {
  console.log('[firebase-messaging-sw.js] Message received from app:', event.data);
  
  if (event.data && event.data.type === 'NOTIFICATION_RECEIVED') {
    const payload = event.data.payload;
    const { title, body, icon } = payload.notification || {};
    const { type, url } = payload.data || {};

    // Show notification using the same logic as background messages
    let notificationTitle = title || 'TALC Notification';
    let notificationOptions = {
      body: body || 'You have a new notification',
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: type || 'general',
      data: {
        url: url || '/',
        type: type,
        timestamp: Date.now()
      },
      requireInteraction: false,
      silent: false
    };

    // Customize based on notification type (same as background handler)
    switch (type) {
      case 'event_reminder':
      case 'event_reminder_owner':
      case 'event_reminder_quality':
      case 'event_reminder_owner_same_day':
        notificationOptions.requireInteraction = true;
        notificationOptions.actions = [
          { action: 'view', title: 'View Event', icon: '/favicon.ico' },
          { action: 'dismiss', title: 'Dismiss' }
        ];
        if (type === 'event_reminder_owner') {
          notificationOptions.tag = 'event_reminder_tomorrow';
        } else if (type.includes('same_day')) {
          notificationOptions.tag = 'event_reminder_today';
          notificationOptions.requireInteraction = true;
        }
        break;
        
      case 'event_reschedule':
      case 'event_cancellation':
        notificationOptions.requireInteraction = true;
        notificationOptions.tag = 'event_change';
        break;
        
      case 'task_overdue':
        notificationOptions.requireInteraction = true;
        notificationOptions.actions = [
          { action: 'view', title: 'View Tasks', icon: '/favicon.ico' },
          { action: 'snooze', title: 'Remind Later' }
        ];
        break;
        
      case 'kpi_reminder':
        notificationOptions.actions = [
          { action: 'view', title: 'View Mentors', icon: '/favicon.ico' },
          { action: 'dismiss', title: 'Later' }
        ];
        break;
        
      case 'system_alert':
        notificationOptions.requireInteraction = true;
        notificationOptions.silent = false;
        notificationOptions.tag = 'critical_alert';
        break;
        
      case 'monthly_summary':
        notificationOptions.requireInteraction = false;
        notificationOptions.actions = [
          { action: 'view', title: 'View Dashboard', icon: '/favicon.ico' }
        ];
        break;
    }

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});
