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

// Owner reminders - one day before at 4 PM UTC
exports.sendOwnerEventReminders = onSchedule({
  schedule: "0 16 * * *", // Daily at 4 PM UTC
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Get events due tomorrow
    const eventsSnapshot = await db.collection('events')
      .where('startDateTime', '>=', tomorrow)
      .where('startDateTime', '<', dayAfter)
      .where('status', 'in', ['pending', 'in_progress'])
      .get();

  const notifications = [];
  const recipientsMeta = [];

    // Process events and notify owners
    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      
      // Skip events that were recently modified (within last 24 hours) to avoid double notifications
      // with real-time update notifications
      if (event.lastModifiedAt) {
        const lastModified = timestampToDate(event.lastModifiedAt);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        if (lastModified && lastModified > oneDayAgo) {
          console.log(`Skipping reminder for recently modified event: ${event.title}`);
          continue;
        }
      }
      
      // Get event owners (assignees who created or own the event)
      const ownerIds = [];
      
      // Add event creator as owner if they're a user
      if (event.createdBy?.userId) {
        ownerIds.push(event.createdBy.userId);
      }
      
      // Add assignees who are owners/creators
      const assigneeIds = event.assignees || [];
      ownerIds.push(...assigneeIds);
      
      // Remove duplicates
      const uniqueOwnerIds = [...new Set(ownerIds)];
      
      for (const userId of uniqueOwnerIds) {
        const tokens = await getAllUserTokens(userId);
        for (const token of tokens) {
          const isWeb = isWebToken(token);
          if (isWeb) {
            notifications.push({
              token,
              data: {
                type: 'event_reminder_owner',
                eventId: eventDoc.id,
                url: `/calendar`,
                timing: 'day_before'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/calendar` },
                notification: {
                  title: `Event Tomorrow: ${event.title}`,
                  body: `Due tomorrow at ${formatTimestampTime(event.startDateTime)}`,
                  icon: absIcon,
                  badge: absBadge
                }
              }
            });
          } else {
            notifications.push({
              token,
              notification: {
                title: `Event Tomorrow: ${event.title}`,
                body: `Due tomorrow at ${formatTimestampTime(event.startDateTime)}`,
              },
              data: {
                type: 'event_reminder_owner',
                eventId: eventDoc.id,
                url: `/calendar`,
                timing: 'day_before'
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

    console.log(`Sent ${notifications.length} owner event reminder notifications`);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending owner event reminders:', error);
    throw error;
  }
});

// Quality team and owner reminders - same day at 8 AM UTC
exports.sendQualityTeamEventReminders = onSchedule({
  schedule: "0 8 * * *", // Daily at 8 AM UTC (changed from 4 PM to avoid overlap with owner reminders)
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get events due today
    const eventsSnapshot = await db.collection('events')
      .where('startDateTime', '>=', today)
      .where('startDateTime', '<', tomorrow)
      .where('status', 'in', ['pending', 'in_progress'])
      .get();

  const notifications = [];
  const recipientsMeta = [];

    // Get ALL users (role-based filtering removed)
    const allUsersSnapshot = await db.collection('users').get();

    // Build all users with centers and tokens (multi-device)
    const allMembers = [];
    for (const docSnap of allUsersSnapshot.docs) {
      const data = docSnap.data();
      const centers = data.assignedCenters || [];
      const tokens = await getAllUserTokens(docSnap.id);
      if (tokens.length) {
        allMembers.push({ userId: docSnap.id, centers, tokens });
      }
    }

    // Process events for same-day reminders
    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      const eventTime = timestampToDate(event.startDateTime);
      
      // Skip events that were recently modified (within last 24 hours) to avoid double notifications
      // with real-time update notifications
      if (event.lastModifiedAt) {
        const lastModified = timestampToDate(event.lastModifiedAt);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        if (lastModified && lastModified > oneDayAgo) {
          console.log(`Skipping same-day reminder for recently modified event: ${event.title}`);
          continue;
        }
      }
      
      // Skip if event is in the past (already started today)
      if (eventTime && eventTime < new Date()) {
        continue;
      }

      // Notify ALL users (role-based filtering removed)
      for (const member of allMembers) {
        const shouldNotify = member.centers.length === 0 ||
          (event.center && member.centers.includes(event.center)) ||
          (event.assignedCenters && event.assignedCenters.some(center => member.centers.includes(center)));
        if (!shouldNotify) continue;
        for (const token of member.tokens) {
          const isWeb = isWebToken(token);
          if (isWeb) {
            notifications.push({
              token,
              data: {
                type: 'event_reminder',
                eventId: eventDoc.id,
                url: `/calendar`,
                timing: 'same_day'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/calendar` },
                notification: {
                  title: `Event Today: ${event.title}`,
                  body: `Due today at ${eventTime.toLocaleTimeString()}`,
                  icon: absIcon,
                  badge: absBadge
                }
              }
            });
          } else {
            notifications.push({
              token,
              notification: {
                title: `Event Today: ${event.title}`,
                body: `Due today at ${eventTime.toLocaleTimeString()}`,
              },
              data: {
                type: 'event_reminder',
                eventId: eventDoc.id,
                url: `/calendar`,
                timing: 'same_day'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/calendar` },
                notification: { icon: absIcon, badge: absBadge }
              }
            });
          }
          recipientsMeta.push({ userId: member.userId, token });
        }
      }

      // REMOVED: Duplicate notification to owners/assignees - Quality team members are the primary recipients for same-day reminders
      // Owners/assignees get notified about tomorrow's events by sendOwnerEventReminders
      // This prevents double notifications for users who are both quality team members and event assignees
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

    console.log(`Sent ${notifications.length} same-day event reminder notifications`);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending same-day event reminders:', error);
    throw error;
  }
});

// Function for overdue task notifications (weekly to reduce costs)
exports.sendWeeklyOverdueTaskReminders = onSchedule({
  schedule: "0 9 * * 1", // Every Monday at 9 AM
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const now = new Date();
    
    // Get overdue events
    const overdueEventsSnapshot = await db.collection('events')
      .where('startDateTime', '<', now)
      .where('status', 'in', ['pending', 'in_progress'])
      .get();

  const notifications = [];
  const recipientsMeta = [];

    for (const eventDoc of overdueEventsSnapshot.docs) {
      const event = eventDoc.data();
      const assigneeIds = event.assignees || [];
      
      for (const userId of assigneeIds) {
        const tokens = await getAllUserTokens(userId);
        for (const token of tokens) {
          const eventDate = timestampToDate(event.startDateTime);
          const daysOverdue = eventDate ? Math.ceil((now - eventDate) / (1000 * 60 * 60 * 24)) : 0;
          const isWeb = isWebToken(token);
          if (isWeb) {
            notifications.push({
              token,
              data: {
                type: 'task_overdue',
                eventId: eventDoc.id,
                daysOverdue: daysOverdue.toString(),
                url: '/calendar'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/calendar` },
                notification: {
                  title: `Overdue Task: ${event.title}`,
                  body: `This task is ${daysOverdue} days overdue`,
                  icon: absIcon,
                  badge: absBadge
                }
              }
            });
          } else {
            notifications.push({
              token,
              notification: {
                title: `Overdue Task: ${event.title}`,
                body: `This task is ${daysOverdue} days overdue`,
              },
              data: {
                type: 'task_overdue',
                eventId: eventDoc.id,
                daysOverdue: daysOverdue.toString(),
                url: '/calendar'
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
    }

    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const metaBatch = recipientsMeta.slice(i, i + batchSize);
      if (batch.length > 0) {
        const results = await messaging.sendEach(batch);
        await handleSendResults(results, metaBatch);
      }
    }

    console.log(`Sent ${notifications.length} overdue task notifications`);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending overdue reminders:', error);
    throw error;
  }
});

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

    // Notify event assignees
    const assigneeIds = eventData.assignees || [];
    for (const userId of assigneeIds) {
      // Check for duplicate notification
      if (await wasNotificationRecentlySent(userId, eventId, 'event_assigned')) {
        continue; // Skip - already sent recently
      }
      
      const tokens = await getAllUserTokens(userId);
      for (const token of tokens) {
        const isWeb = isWebToken(token);
        if (isWeb) {
          notifications.push({
            token,
            data: {
              type: 'event_assigned',
              eventId: eventId,
              url: `/calendar`,
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: {
                title: `New Event Assigned: ${eventData.title}`,
                body: `You have been assigned to this event`,
                icon: absIcon,
                badge: absBadge
              }
            }
          });
        } else {
          notifications.push({
            token,
            notification: {
              title: `New Event Assigned: ${eventData.title}`,
              body: `You have been assigned to this event`,
            },
            data: {
              type: 'event_assigned',
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
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending notifications for event creation:', error);
    throw error;
  }
});