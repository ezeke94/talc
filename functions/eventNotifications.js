// Helper: Detect if a token is a web token (FCM web tokens are usually longer, start with 'd' or 'e', and contain a colon)
function isWebToken(token) {
  // Heuristic: Web tokens are usually >150 chars and contain a colon
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require('firebase-functions/logger');
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
 * This is a READ-ONLY check and will not create log entries.
 */
async function wasNotificationRecentlySent(userId, eventId, notificationType) {
  const notificationKey = `${userId}-${eventId}-${notificationType}`;
  const sentRef = db.collection('_notificationLog').doc(notificationKey);
  
  try {
    const doc = await sentRef.get();
    if (doc.exists()) {
      const data = doc.data();
      const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : (data.sentAt ? new Date(data.sentAt) : null);
      const now = new Date();
      if (sentAt) {
        const diffSeconds = (now - sentAt) / 1000;
        // If sent within last 60 seconds, consider it a duplicate
        if (diffSeconds < 60) {
          logger.info(`⏭️  Skipping duplicate: ${notificationKey} (sent ${Math.round(diffSeconds)}s ago)`);
          return true;
        }
        return false;
      } else {
        // If stored entry has no timestamp, treat conservatively as "recent"
        return true;
      }
    }
    // Do not write here; writing occurs only after a successful send
    return false;
  } catch (error) {
    logger.error('Error checking notification log:', error);
    // On error, allow notification (fail open)
    return false;
  }
}

// Record that a notification was actually sent
async function recordNotificationSent(userId, eventId, notificationType, meta = {}) {
  try {
    const notificationKey = `${userId}-${eventId}-${notificationType}`;
    const sentRef = db.collection('_notificationLog').doc(notificationKey);
    await sentRef.set({ userId, eventId, notificationType, sentAt: new Date(), meta }, { merge: true });
  } catch (e) {
    logger.error('recordNotificationSent error', e);
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
    logger.error('Error converting timestamp:', error);
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
  logger.warn(`Firestore index missing for ${funcName}. Skipping this scheduled run: ${error.message}`);
  try {
    await db.collection('_alerts').doc('missing_indexes').set({
      lastSeen: new Date(),
      [funcName]: { lastSeen: new Date(), message: String(error) }
    }, { merge: true });
  } catch (e) {
    logger.warn('Failed to write missing_indexes alert doc', e);
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
    logger.warn('Failed to mark missing index resolved', e);
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
      logger.error(`getAllUserTokens: failed to read user ${userId}`, e);
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
    logger.error('getAllTokensForAllUsers: failed to fetch tokens', e);
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
    logger.warn('FCM send failure', code, res.error?.message, meta);
    // No token removal
  }
}

// Owner reminders - one day before at 4 PM UTC
exports.sendOwnerEventReminders = onSchedule({
  schedule: '0 16 * * *', // Every day at 16:00 UTC
  timeZone: 'UTC',
  region: 'us-central1',
  memory: '256MiB'
}, async (event) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    // Start and end of the next day in UTC
    const startOfTomorrow = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0));
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);

    // Find events starting tomorrow
    const eventsSnap = await db.collection('events')
      .where('startDateTime', '>=', startOfTomorrow)
      .where('startDateTime', '<', endOfTomorrow)
      .get();

    if (eventsSnap.empty) {
      logger.info('No owner reminders to send: no events starting tomorrow');
      try { await resolveMissingIndex('sendOwnerEventReminders'); } catch(e) { /* ignore */ }
      return { success: true, count: 0 };
    }

    const notifications = [];
    const recipientsMeta = [];
    // Track which owners we successfully built notifications for so we can record dedupe entries later
    const ownerIdsToRecord = new Set();

    for (const doc of eventsSnap.docs) {
      const ev = doc.data();
      const eventId = doc.id;
      const ownerId = ev.ownerId || ev.owner?.userId;
      if (!ownerId) continue; // no owner to notify

      // Dedupe: ensure we don't re-notify owner for same event within 24h
      if (await wasNotificationRecentlySent(ownerId, eventId, 'owner_reminder')) continue;

      const tokens = await getAllUserTokens(ownerId);
      if (!tokens.length) continue; // owner has no devices

      const title = `Reminder: ${ev.title} is tomorrow`;
      const timeStr = formatTimestampTime(ev.startDateTime, 'tomorrow');
      const body = `Your event "${ev.title}" starts at ${timeStr} tomorrow.`;

      for (const token of tokens) {
        const web = isWebToken(token);
        if (web) {
          notifications.push({
            token,
            data: { type: 'owner_reminder', eventId, url: `/calendar` },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: { title, body, icon: absIcon, badge: absBadge }
            }
          });
        } else {
          notifications.push({
            token,
            notification: { title, body },
            data: { type: 'owner_reminder', eventId, url: `/calendar` },
            webpush: { fcmOptions: { link: `${baseUrl}/calendar` }, notification: { icon: absIcon, badge: absBadge } }
          });
        }
        recipientsMeta.push({ userId: ownerId, token });
      }

      // Mark event as having been notified (lastNotificationAt) - do not overwrite other fields
      try {
        await db.collection('events').doc(eventId).set({ lastNotificationAt: new Date() }, { merge: true });
      } catch (e) {
        logger.warn('Failed to update lastNotificationAt for event', eventId, e);
      }

      // remember this owner+event to record dedupe after successful sends
      ownerIdsToRecord.add(`${ownerId}-${eventId}`);
    }

    // Send notifications in batches
    const batchSize = 500;
    let totalSent = 0;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const metaBatch = recipientsMeta.slice(i, i + batchSize);
      if (batch.length > 0) {
        const results = await messaging.sendEach(batch);
        await handleSendResults(results, metaBatch);
        totalSent += batch.length;
      }
    }

    // Record dedupe entries for owners we notified
    try {
      if (ownerIdsToRecord.size) {
        const pairs = Array.from(ownerIdsToRecord).map(k => k.split('-'));
        await Promise.all(pairs.map(([uid, ...rest]) => {
          const evt = rest.join('-');
          return recordNotificationSent(uid, evt, 'owner_reminder');
        }));
      }
    } catch (e) {
      logger.warn('Failed to record owner reminder dedupe entries', e);
    }

    logger.info(`Sent ${totalSent} owner reminder notifications for ${eventsSnap.size} event(s) starting tomorrow`);
    try { await resolveMissingIndex('sendOwnerEventReminders'); } catch(e) { /* ignore */ }
    return { success: true, sent: totalSent, events: eventsSnap.size };

  } catch (error) {
    if (await handleMissingIndex('sendOwnerEventReminders', error)) {
      return { success: true, sent: 0, events: 0, note: 'missing_index' };
    }
    logger.error('Error in sendOwnerEventReminders:', error);
    throw error;
  }
});

// REMOVED: quality-team same-day reminders and core runner (deleted per request)

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
    // track userIds we built notifications for so we can record dedupe entries
    const eventCreatedRecipients = new Set();

    // Assignee notifications for newly created events are disabled per configuration
    const assigneeIds = eventData.assignees || [];
    logger.info(`Assignee notifications (event_assigned) disabled for event ${eventId}; ${assigneeIds.length} assignee(s) ignored.`);

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
        eventCreatedRecipients.add(userId);
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

    logger.info(`Sent ${notifications.length} notifications for event creation`);
    // Record dedupe entries for users we notified for this event
    try {
      if (eventCreatedRecipients.size) {
        await Promise.all(Array.from(eventCreatedRecipients).map(uid => recordNotificationSent(uid, eventId, 'event_created')));
      }
    } catch (e) {
      logger.warn('Failed to record event_created dedupe entries', e);
    }
    try { await resolveMissingIndex('sendNotificationsOnEventCreate'); } catch (e) { logger.warn('resolveMissingIndex error', e); }
    return { success: true, count: notifications.length };

  } catch (error) {
    logger.error('Error sending notifications for event creation:', error);
    throw error;
  }
});