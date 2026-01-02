// Helper: Detect if a token is a web token (FCM web tokens are usually longer, start with 'd' or 'e', and contain a colon)
function isWebToken(token) {
  // Heuristic: Web tokens are usually >150 chars and contain a colon
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

// Absolute URLs for WebPush assets
const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
const absIcon = `${baseUrl}/favicon.ico`;
const absBadge = `${baseUrl}/favicon.ico`;

/**
 * Check if notification was already sent recently (within last 60 seconds)
 * Prevents duplicate notifications from being sent to the same user for the same event
 */
async function wasNotificationRecentlySent(userId, eventId, notificationType) {
  const notificationKey = `${userId}-${eventId}-${notificationType}`;
  const sentRef = db.collection('_notificationLog').doc(notificationKey);
  
  try {
    const doc = await sentRef.get();
    if (doc.exists()) {
      const data = doc.data();
      const sentAt = data.sentAt.toDate ? data.sentAt.toDate() : new Date(data.sentAt);
      const now = new Date();
      const diffSeconds = (now - sentAt) / 1000;
      
      // If sent within last 60 seconds, consider it a duplicate
      if (diffSeconds < 60) {
        console.log(`⏭️  Skipping duplicate: ${notificationKey} (sent ${Math.round(diffSeconds)}s ago)`);
        return true;
      }
    }
    
    // Record this notification send
    await sentRef.set({
      userId,
      eventId,
      notificationType,
      sentAt: new Date()
    }, { merge: true });
    
    return false;
  } catch (error) {
    console.error('Error checking notification log:', error);
    // On error, allow notification (fail open)
    return false;
  }
}

// Helper: Safely convert Firestore Timestamp to JavaScript Date
function timestampToDate(timestamp) {
  if (!timestamp) return null;
  
  try {
    // Firestore Timestamp with toDate() method
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    // Already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    // Raw Timestamp with seconds property
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
  } catch (error) {
    console.error('Error converting timestamp:', error);
  }
  
  return null;
}

// Helper: Safely format timestamp to locale string
function formatTimestamp(timestamp, defaultValue = 'Unknown date') {
  const date = timestampToDate(timestamp);
  return date ? date.toLocaleString() : defaultValue;
}

// Helper: Safely format timestamp to locale time string
function formatTimestampTime(timestamp, defaultValue = 'Unknown time') {
  const date = timestampToDate(timestamp);
  return date ? date.toLocaleTimeString() : defaultValue;
}

// Helper: Create Android-compatible notification config
// Android requires explicit title and body in the notification object
function createAndroidNotification(title, body, priority = 'high', channelId = 'default') {
  return {
    priority,
    notification: {
      title,
      body,
      icon: '/favicon.ico',
      color: '#1976d2',
      sound: 'default',
      channelId
    }
  };
}

// Helper: Create iOS-compatible notification config (APNS)
// iOS requires proper aps.alert structure
function createIOSNotification(title, body, priority = '10', badge = 1) {
  return {
    headers: {
      'apns-priority': priority
    },
    payload: {
      aps: {
        alert: {
          title,
          body
        },
        sound: 'default',
        badge
      }
    }
  };
}

// Helper: Handle Firestore index-required errors for scheduled functions
async function handleMissingIndex(funcName, error) {
  const isIndexError = error && (error.code === 9 || (error.message && error.message.includes('requires an index')));
  if (!isIndexError) return false;
  console.warn(`Firestore index missing for ${funcName}. Skipping this scheduled run: ${error.message}`);
  try {
    await db.collection('_alerts').doc('missing_indexes').set({
      lastSeen: new Date(),
      [funcName]: { lastSeen: new Date(), message: String(error) }
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to write missing_indexes alert doc', e);
  }
  return true;
}

// Helper: Mark missing index resolved for scheduled functions
async function resolveMissingIndex(funcName) {
  try {
    await db.collection('_alerts').doc('missing_indexes').set({
      lastResolved: new Date(),
      [funcName]: { resolvedAt: new Date(), resolved: true }
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to mark missing index resolved', e);
  }
} 

// Helper: fetch all device tokens for a user (main fcmToken + devices subcollection)
async function getAllUserTokens(userId) {
  const tokens = new Set();
  let hasDevices = false;
  
  // First, try to get tokens from devices subcollection
  try {
    const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
    devicesSnap.forEach((d) => {
      const token = d.id;
      const enabled = d.data()?.enabled !== false; // default true
      if (token && enabled) {
        tokens.add(token);
        hasDevices = true;
      }
    });
  } catch (e) {
    // subcollection may not exist
  }
  
  // Only fall back to main fcmToken if NO devices subcollection exists
  // This prevents duplicate notifications when the same token exists in both places
  if (!hasDevices) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      if (userData?.fcmToken) tokens.add(userData.fcmToken);
    } catch (e) {
      console.error(`getAllUserTokens: failed to read user ${userId}`, e);
    }
  }
  
  return Array.from(tokens);
}

// Helper: fetch all device tokens for all users
async function getAllTokensForAllUsers() {
  const tokens = new Set();
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      let hasDevices = false;
      
      // First, try to get tokens from devices subcollection
      try {
        const devicesSnap = await db.collection('users').doc(userDoc.id).collection('devices').get();
        devicesSnap.forEach((d) => {
          const token = d.id;
          const enabled = d.data()?.enabled !== false; // default true
          if (token && enabled) {
            tokens.add(token);
            hasDevices = true;
          }
        });
      } catch (e) {
        // subcollection may not exist
      }
      
      // Only fall back to main fcmToken if NO devices subcollection exists
      // This prevents duplicate notifications when the same token exists in both places
      if (!hasDevices) {
        const userData = userDoc.data();
        if (userData?.fcmToken) tokens.add(userData.fcmToken);
      }
    }
  } catch (e) {
    console.error('getAllTokensForAllUsers: failed to fetch tokens', e);
  }
  return Array.from(tokens);
}

// Helper: after sending, log FCM send failures (do not clear tokens)
async function handleSendResults(results, recipientsMeta) {
  const responses = results.responses || [];
  for (let i = 0; i < responses.length; i++) {
    const res = responses[i];
    if (res.success) continue;
    const meta = recipientsMeta[i];
    const code = res.error?.code || res.error?.errorInfo?.code;
    console.warn('FCM send failure', code, res.error?.message, meta);
    // No token removal
  }
}

// REMOVED: runOwnerEventReminders runner (moved to scheduled job only); keep scheduled `sendOwnerEventReminders` for now (may be removed later if desired)


// Owner reminders - one day before at 4 PM UTC
// REMOVED: scheduled owner event reminders (disabled/removed by request)

// REMOVED: quality-team same-day reminders and core runner (deleted per request)


// REMOVED: weekly overdue task reminders (deleted per request)


// REMOVED: sendCalendarEventNotifications - This function was redundant and caused double notifications
// It sent reminders to ALL users at 4 PM UTC, but sendOwnerEventReminders and sendQualityTeamEventReminders
// already handle targeted notifications to the appropriate recipients at the same time.
// Removed on: October 10, 2025

// Trigger notifications when a new event is created
exports.sendNotificationsOnEventCreate = onDocumentCreated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const eventData = event.data.data();
    const eventId = event.params.eventId;

    const notifications = [];
    const recipientsMeta = [];

    // Assignee notifications for newly created events are disabled per configuration
    const assigneeIds = eventData.assignees || [];
    console.log(`Assignee notifications (event_assigned) disabled for event ${eventId}; ${assigneeIds.length} assignee(s) ignored.`);

    // Notify ALL users (role-based filtering removed - assignees already notified above)
    const allUsersSnapshot = await db.collection('users').get();
    
    for (const docSnap of allUsersSnapshot.docs) {
      const userId = docSnap.id;
      // Skip if this user is already being notified as an assignee
      if (assigneeIds.includes(userId)) {
        continue;
      }
      
      // Check for duplicate notification
      if (await wasNotificationRecentlySent(userId, eventId, 'event_created')) {
        continue; // Skip - already sent recently
      }
      
      const tokens = await getAllUserTokens(userId);
      for (const token of tokens) {
        const isWeb = isWebToken(token);
        if (isWeb) {
          notifications.push({
            token,
            data: {
              type: 'event_created',
              eventId: eventId,
              url: `/calendar`,
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: {
                title: `New Event Created: ${eventData.title}`,
                body: `A new event has been created in the system`,
                icon: absIcon,
                badge: absBadge
              }
            }
          });
        } else {
          notifications.push({
            token,
            notification: {
              title: `New Event Created: ${eventData.title}`,
              body: `A new event has been created in the system`,
            },
            data: {
              type: 'event_created',
              eventId: eventId,
              url: `/calendar`,
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: { icon: absIcon, badge: absBadge }
            }
          });
        }
        recipientsMeta.push({ userId, token });
      }
    }

    // Send notifications in batches
    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const metaBatch = recipientsMeta.slice(i, i + batchSize);
      if (batch.length > 0) {
        const results = await messaging.sendEach(batch);
        await handleSendResults(results, metaBatch);
      }
    }

    console.log(`Sent ${notifications.length} notifications for event creation`);
    try { await resolveMissingIndex('sendNotificationsOnEventCreate'); } catch (e) { console.warn('resolveMissingIndex error', e); }
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending notifications for event creation:', error);
    throw error;
  }
});