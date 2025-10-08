// Firebase messaging service worker for TALC Management Application
// This handles background push notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
importScripts('/firebase-config.js'); // Auto-generated config

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const { title, body, icon } = payload.notification || {};
  const { type, url } = payload.data || {};

  // Customize notification based on type
  let notificationTitle = title || 'TALC Notification';
  let notificationOptions = {
    body: body || 'You have a new notification',
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: type || 'general', // Prevents duplicate notifications of same type
    data: {
      url: url || '/',
      type: type,
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
