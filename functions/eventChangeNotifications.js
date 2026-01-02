const { onDocumentUpdated, onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

// Heuristic to detect Web FCM tokens
function isWebToken(token) {
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}

// Absolute asset URLs for WebPush
const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
const absIcon = `${baseUrl}/favicon.ico`;
const absBadge = `${baseUrl}/favicon.ico`;

/**
 * Check if notification was already sent recently (within last 60 seconds)
 * Prevents duplicate notifications from being sent to the same user for the same event
 * Read-only check (does not write). Writing happens after successful send.
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
          console.log(`⏭️  Skipping duplicate: ${notificationKey} (sent ${Math.round(diffSeconds)}s ago)`);
          return true;
        }
        return false;
      } else {
        return true;
      }
    }
    // Do not write here; recording should happen only after successful sends
    return false;
  } catch (error) {
    console.error('Error checking notification log:', error);
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
    console.error('recordNotificationSent error', e);
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

// Helper: Get all tokens for all users (with deduplication)
async function getAllTokensForAllUsers() {
  const tokens = new Set();
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      let hasDevices = false;
      
      // Get all enabled devices from devices subcollection
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

// Real-time event reschedule notifications
exports.notifyEventReschedule = onDocumentUpdated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    // Check if this is a reschedule (startDateTime changed)
    const oldDateTime = beforeData.startDateTime;
    const newDateTime = afterData.startDateTime;
    
    // Normalize and compare safely (supports Firestore Timestamps and JS Dates)
    const oldDt = timestampToDate(oldDateTime);
    const newDt = timestampToDate(newDateTime);
    if (!oldDt || !newDt || oldDt.getTime() === newDt.getTime()) {
      return null; // No reschedule occurred
    }

    const eventId = event.params.eventId;
    const eventTitle = afterData.title || 'Unnamed Event';
    const assigneeIds = afterData.assignees || [];

    // Get FCM tokens for assignees
    const notifications = [];
    
    for (const userId of assigneeIds) {
      try {
        // Get all tokens for this user from devices subcollection
        const userTokens = await getUserTokens(userId);
        
        if (userTokens.length > 0) {
          const oldDateStr = formatTimestamp(oldDateTime);
          const newDateStr = formatTimestamp(newDateTime);
          
          // Create notification for each device token
          for (const token of userTokens) {
            const title = `Event Rescheduled: ${eventTitle}`;
            const body = `Moved from ${oldDateStr} to ${newDateStr}`;
            const web = isWebToken(token);
            if (web) {
              notifications.push({
                token,
                data: {
                  type: 'event_reschedule',
                  eventId: eventId,
                  oldDateTime: oldDateStr,
                  newDateTime: newDateStr,
                  url: '/calendar'
                },
                webpush: {
                  fcmOptions: { link: `${baseUrl}/calendar` },
                  notification: { title, body, icon: absIcon, badge: absBadge }
                }
              });
            } else {
              notifications.push({
                token,
                notification: { title, body },
                data: {
                  type: 'event_reschedule',
                  eventId: eventId,
                  oldDateTime: oldDateStr,
                  newDateTime: newDateStr,
                  url: '/calendar'
                },
                webpush: {
                  fcmOptions: { link: `${baseUrl}/calendar` },
                  notification: { icon: absIcon, badge: absBadge }
                },
                android: createAndroidNotification(title, body, 'high'),
                apns: { headers: { 'apns-priority': '10' } }
              });
            }
          }
        }
      } catch (userError) {
        console.error(`Error getting user ${userId}:`, userError);
        // Continue with other users
      }
    }

    // Send notifications
    if (notifications.length > 0) {
      const results = await messaging.sendEach(notifications);
      console.log(`Sent ${results.successCount} reschedule notifications for event ${eventId}`);
    }

    return { success: true, notificationsSent: notifications.length };

  } catch (error) {
    console.error('Error sending reschedule notifications:', error);
    // Don't throw to avoid failing the document update
    return { success: false, error: error.message };
  }
});

// Notify all users when event details are updated (excluding reschedule which has its own handler)
exports.notifyEventUpdate = onDocumentUpdated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    // Skip if this is a reschedule (handled by notifyEventReschedule)
    const oldDateTime = beforeData.startDateTime;
    const newDateTime = afterData.startDateTime;
    const oldDt = timestampToDate(oldDateTime);
    const newDt = timestampToDate(newDateTime);
    if (oldDt && newDt && oldDt.getTime() !== newDt.getTime()) {
      return null; // Reschedule is handled by separate function
    }

    // Skip if status changed to cancelled or completed (handled by other functions)
    if (afterData.status === 'cancelled' && beforeData.status !== 'cancelled') {
      return null;
    }
    if (afterData.status === 'completed' && beforeData.status !== 'completed') {
      return null;
    }

    // Check if significant fields changed (title, description, centers, assignees, todos)
    const titleChanged = beforeData.title !== afterData.title;
    const descriptionChanged = beforeData.description !== afterData.description;
    const centersChanged = JSON.stringify(beforeData.centers) !== JSON.stringify(afterData.centers);
    const assigneesChanged = JSON.stringify(beforeData.assignees) !== JSON.stringify(afterData.assignees);
    const todosChanged = JSON.stringify(beforeData.todos) !== JSON.stringify(afterData.todos);

    // If nothing significant changed, skip notification
    if (!titleChanged && !descriptionChanged && !centersChanged && !assigneesChanged && !todosChanged) {
      return null;
    }

    const eventId = event.params.eventId;
    const eventTitle = afterData.title || 'Unnamed Event';
    
    // Build change summary
    const changes = [];
    if (titleChanged) changes.push('title');
    if (descriptionChanged) changes.push('description');
    if (centersChanged) changes.push('centers');
    if (assigneesChanged) changes.push('assignees');
    if (todosChanged) changes.push('tasks');
    
    const changesSummary = changes.join(', ');

    // Get all user tokens to notify everyone
    const tokens = await getAllTokensForAllUsers();
    
    if (tokens.length === 0) {
      console.log('No tokens available for event update notification');
      return { success: true, notificationsSent: 0 };
    }

    const title = `Event Updated: ${eventTitle}`;
    const body = `Changes: ${changesSummary}`;

    const notifications = tokens.map(token => {
      const web = isWebToken(token);
      if (web) {
        return {
          token,
          data: {
            type: 'event_update',
            eventId: eventId,
            changes: changesSummary,
            url: '/calendar'
          },
          webpush: {
            fcmOptions: { link: `${baseUrl}/calendar` },
            notification: { title, body, icon: absIcon, badge: absBadge }
          }
        };
      }
      return {
        token,
        notification: { title, body },
        data: {
          type: 'event_update',
          eventId: eventId,
          changes: changesSummary,
          url: '/calendar'
        },
        webpush: {
          fcmOptions: { link: `${baseUrl}/calendar` },
          notification: { icon: absIcon, badge: absBadge }
        },
        android: createAndroidNotification(title, body, 'high'),
        apns: createIOSNotification(title, body, '10', 1)
      };
    });

    // Send notifications
    if (notifications.length > 0) {
      const results = await messaging.sendEach(notifications);
      console.log(`Sent ${results.successCount} update notifications for event ${eventId}`);
    }

    return { success: true, notificationsSent: notifications.length };

  } catch (error) {
    console.error('Error sending event update notifications:', error);
    return { success: false, error: error.message };
  }
});

// Notify when events are cancelled (status changed to 'cancelled')
exports.notifyEventCancellation = onDocumentUpdated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    // Check if event was cancelled
    const wasCancelled = beforeData.status !== 'cancelled' && afterData.status === 'cancelled';
    
    if (!wasCancelled) {
      return null;
    }

    const eventId = event.params.eventId;
    const eventTitle = afterData.title || 'Unnamed Event';
    const assigneeIds = afterData.assignees || [];

    const notifications = [];
    
    for (const userId of assigneeIds) {
      try {
        // Get all tokens for this user from devices subcollection
        const userTokens = await getUserTokens(userId);
        
        if (userTokens.length > 0) {
          const eventDateStr = formatTimestamp(afterData.startDateTime, 'Unknown time');
          
          const title = `Event Cancelled: ${eventTitle}`;
          const body = `Scheduled for ${eventDateStr} has been cancelled`;
          
          // Create notification for each device token
          for (const token of userTokens) {
            const web = isWebToken(token);
            if (web) {
              notifications.push({
                token,
                data: {
                  type: 'event_cancellation',
                  eventId: eventId,
                  url: '/calendar'
                },
                webpush: {
                  fcmOptions: { link: `${baseUrl}/calendar` },
                  notification: { title, body, icon: absIcon, badge: absBadge }
                }
              });
            } else {
              notifications.push({
                token,
                notification: { title, body },
                data: {
                  type: 'event_cancellation',
                  eventId: eventId,
                  url: '/calendar'
                },
                webpush: {
                  fcmOptions: { link: `${baseUrl}/calendar` },
                  notification: { icon: absIcon, badge: absBadge }
                },
                android: createAndroidNotification(title, body, 'high'),
                apns: { headers: { 'apns-priority': '10' } }
              });
            }
          }
        }
      } catch (userError) {
        console.error(`Error getting user ${userId}:`, userError);
      }
    }

    if (notifications.length > 0) {
      const results = await messaging.sendEach(notifications);
      console.log(`Sent ${results.successCount} cancellation notifications for event ${eventId}`);
    }

    return { success: true, notificationsSent: notifications.length };

  } catch (error) {
    console.error('Error sending cancellation notifications:', error);
    return { success: false, error: error.message };
  }
});

// Notify supervisors when events are completed
exports.notifyEventCompletion = onDocumentUpdated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    // Check if event was just completed
    const wasCompleted = beforeData.status !== 'completed' && afterData.status === 'completed';
    
    if (!wasCompleted) {
      return null;
    }

    const eventTitle = afterData.title || 'Unnamed Event';
    
    // Notify ALL users (role-based filtering removed)
    const allUsersSnapshot = await db.collection('users').get();

    const notifications = [];
    
    for (const doc of allUsersSnapshot.docs) {
      const userId = doc.id;
      try {
        // Get all tokens for this user from devices subcollection
        const userTokens = await getUserTokens(userId);
        
        const title = `Event Completed: ${eventTitle}`;
        const body = `All tasks have been marked as complete`;
        
        // Create notification for each device token
        for (const token of userTokens) {
          const web = isWebToken(token);
          if (web) {
            notifications.push({
              token,
              data: {
                type: 'event_completion',
                eventId: event.params.eventId,
                url: '/operational-dashboard'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/operational-dashboard` },
                notification: { title, body, icon: absIcon, badge: absBadge }
              }
            });
          } else {
            notifications.push({
              token,
              notification: { title, body },
              data: {
                type: 'event_completion',
                eventId: event.params.eventId,
                url: '/operational-dashboard'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/operational-dashboard` },
                notification: { icon: absIcon, badge: absBadge }
              },
              android: createAndroidNotification(title, body, 'default'),
              apns: createIOSNotification(title, body, '5', 1)
            });
          }
        }
      } catch (userError) {
        console.error(`Error getting tokens for supervisor ${userId}:`, userError);
      }
    }

    if (notifications.length > 0) {
      const results = await messaging.sendEach(notifications);
      console.log(`Sent ${results.successCount} completion notifications for event ${event.params.eventId}`);
    }

    return { success: true, notificationsSent: notifications.length };

  } catch (error) {
    console.error('Error sending completion notifications:', error);
    return { success: false, error: error.message };
  }
});

// Helper: safe date formatting for Firestore Timestamp, string, or Date
function formatEventDate(val) {
  try {
    if (!val) return 'Unknown time';
    
    // Use our safer timestamp conversion
    const date = timestampToDate(val);
    if (date) return date.toLocaleString();
    
    // Try parsing as string/number
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  } catch (error) {
    console.error('Error formatting event date:', error);
  }
  return 'Unknown time';
}

// Helper: fetch all device tokens for a specific user (avoiding duplicates)
async function getUserTokens(userId) {
  const tokenSet = new Set();
  try {
    // First, try to get tokens from devices subcollection
    const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
    let hasDevices = false;
    
    devicesSnap.forEach((deviceDoc) => {
      const deviceData = deviceDoc.data();
      const token = deviceDoc.id; // token is the document ID
      const enabled = deviceData?.enabled !== false; // default true
      if (token && enabled) {
        tokenSet.add(token);
        hasDevices = true;
      }
    });
    
    // Only fall back to main fcmToken if NO devices subcollection exists
    // This prevents duplicate notifications when the same token exists in both places
    if (!hasDevices) {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      if (userData?.fcmToken) {
        tokenSet.add(userData.fcmToken);
      }
    }
  } catch (error) {
    console.error(`Error fetching tokens for user ${userId}:`, error);
  }
  return Array.from(tokenSet);
}

// Helper: fetch all device tokens for all users (avoiding duplicates)
async function getAllUserTokens() {
  const tokenSet = new Set();
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      // Get tokens from devices subcollection
      let hasDevices = false;
      try {
        const devicesSnap = await db.collection('users').doc(userDoc.id).collection('devices').get();
        devicesSnap.forEach((deviceDoc) => {
          const deviceData = deviceDoc.data();
          const token = deviceDoc.id; // token is the document ID
          const enabled = deviceData?.enabled !== false; // default true
          if (token && enabled) {
            tokenSet.add(token);
            hasDevices = true;
          }
        });
      } catch (e) {
        // Subcollection might not exist
      }
      
      // Only fall back to main fcmToken if NO devices subcollection exists
      // This prevents duplicate notifications when the same token exists in both places
      if (!hasDevices) {
        const userData = userDoc.data();
        if (userData?.fcmToken) {
          tokenSet.add(userData.fcmToken);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching user tokens:', error);
  }
  return Array.from(tokenSet);
}

// Notify when events are deleted
exports.notifyEventDelete = onDocumentDeleted({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const deletedData = event.data.data();
    const eventId = event.params.eventId;
    const eventTitle = deletedData.title || 'Unnamed Event';

    const notifications = [];
    const recipientsMeta = [];
    // track userIds per notification type so we can record dedupe entries after successful sends
    const assigneeRecipients = new Set();
    const allUserRecipients = new Set();

    // Notify assignees (primary stakeholders)
    const assigneeIds = deletedData.assignees || [];
    const title1 = `Event Deleted: ${eventTitle}`;
    const body1 = `An event you were assigned to has been deleted`;
    
    for (const userId of assigneeIds) {
      // Check for duplicate notification
      if (await wasNotificationRecentlySent(userId, eventId, 'event_delete_assignee')) {
        continue; // Skip - already sent recently
      }
      
      const tokens = await getUserTokens(userId);
      for (const token of tokens) {
        const web = isWebToken(token);
        if (web) {
          notifications.push({
            token,
            data: {
              type: 'event_delete',
              eventId,
              url: '/calendar',
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: { title: title1, body: body1, icon: absIcon, badge: absBadge },
            }
          });
        } else {
          notifications.push({
            token,
            notification: { title: title1, body: body1 },
            data: {
              type: 'event_delete',
              eventId,
              url: '/calendar',
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: { icon: absIcon, badge: absBadge },
            },
            android: createAndroidNotification(title1, body1, 'high'),
            apns: createIOSNotification(title1, body1, '10', 1),
          });
        }
        recipientsMeta.push({ userId, token });
      }
      // remember assignee to record dedupe after sends
      assigneeRecipients.add(userId);
    }

    // Notify ALL users (role-based filtering removed - assignees already notified above)
    const allUsersSnapshot = await db.collection('users').get();
    const title2 = `Event Deleted: ${eventTitle}`;
    const body2 = `An event has been deleted from the system`;

    for (const doc of allUsersSnapshot.docs) {
      const userId = doc.id;
      // Skip if already notified as assignee
      if (assigneeIds.includes(userId)) {
        continue;
      }
      
      // Check for duplicate notification
      if (await wasNotificationRecentlySent(userId, eventId, 'event_delete')) {
        continue; // Skip - already sent recently
      }
      
      const tokens = await getUserTokens(userId);
      for (const token of tokens) {
        const web = isWebToken(token);
        if (web) {
          notifications.push({
            token,
            data: {
              type: 'event_delete',
              eventId,
              url: '/calendar',
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: { title: title2, body: body2, icon: absIcon, badge: absBadge },
            },
          });
        } else {
          notifications.push({
            token,
            notification: { title: title2, body: body2 },
            data: {
              type: 'event_delete',
              eventId,
              url: '/calendar',
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/calendar` },
              notification: { icon: absIcon, badge: absBadge },
            },
            android: createAndroidNotification(title2, body2, 'high'),
            apns: createIOSNotification(title2, body2, '10', 1),
          });
        }
        recipientsMeta.push({ userId, token });
      }
      // remember user to record dedupe after sends
      allUserRecipients.add(userId);
    }

    if (notifications.length > 0) {
      const results = await messaging.sendEach(notifications);
      console.log(`Sent ${results.successCount}/${notifications.length} deletion notifications for event ${eventId}`);
      
      // Log any failures
      results.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error?.code || res.error?.errorInfo?.code;
          console.warn(`Notification send failed for token ${idx}:`, code, res.error?.message);
        }
      });

      // After successful sends, record dedupe entries for recipients
      try {
        if (assigneeRecipients.size) {
          await Promise.all(Array.from(assigneeRecipients).map(uid => recordNotificationSent(uid, eventId, 'event_delete_assignee')));
        }
        if (allUserRecipients.size) {
          await Promise.all(Array.from(allUserRecipients).map(uid => recordNotificationSent(uid, eventId, 'event_delete')));
        }
      } catch (e) {
        console.warn('Failed to record deletion dedupe entries', e);
      }
    }

    return { success: true, notificationsSent: notifications.length };

  } catch (error) {
    console.error('Error sending deletion notifications:', error);
    return { success: false, error: error.message };
  }
});