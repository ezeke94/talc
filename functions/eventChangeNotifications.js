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

// Helper: Get all tokens for all users (with deduplication)
async function getAllTokensForAllUsers() {
  const tokens = new Set();
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      // Backwards compatibility with old fcmToken field
      if (userData?.fcmToken) tokens.add(userData.fcmToken);

      // Get all enabled devices from devices subcollection
      const devicesSnap = await db.collection('users').doc(userDoc.id).collection('devices').get();
      devicesSnap.forEach((d) => {
        const token = d.id;
        const enabled = d.data()?.enabled !== false; // default true
        if (token && enabled) tokens.add(token);
      });
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
    
    if (!oldDateTime || !newDateTime || oldDateTime.isEqual(newDateTime)) {
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
            notifications.push({
              token: token,
              notification: {
                title: `Event Rescheduled: ${eventTitle}`,
                body: `Moved from ${oldDateStr} to ${newDateStr}`,
              },
              data: {
                type: 'event_reschedule',
                eventId: eventId,
                oldDateTime: oldDateStr,
                newDateTime: newDateStr,
                url: '/calendar'
              },
              webpush: {
                fcmOptions: {
                  link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`
                },
                notification: {
                  icon: '/favicon.ico'
                }
              },
              android: {
                priority: 'high' // High priority for time-sensitive updates
              },
              apns: {
                headers: {
                  'apns-priority': '10'
                }
              }
            });
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
    if (oldDateTime && newDateTime && !oldDateTime.isEqual(newDateTime)) {
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

    const notifications = tokens.map(token => ({
      token,
      notification: {
        title: `Event Updated: ${eventTitle}`,
        body: `Changes: ${changesSummary}`,
      },
      data: {
        type: 'event_update',
        eventId: eventId,
        changes: changesSummary,
        url: '/calendar'
      },
      webpush: {
        fcmOptions: {
          link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`
        },
        notification: {
          icon: '/favicon.ico'
        }
      },
      android: {
        priority: 'high'
      },
      apns: {
        headers: {
          'apns-priority': '10'
        }
      }
    }));

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
          
          // Create notification for each device token
          for (const token of userTokens) {
            notifications.push({
              token: token,
              notification: {
                title: `Event Cancelled: ${eventTitle}`,
                body: `Scheduled for ${eventDateStr} has been cancelled`,
              },
              data: {
                type: 'event_cancellation',
                eventId: eventId,
                url: '/calendar'
              },
              webpush: {
                notification: {
                  icon: '/favicon.ico'
                }
              },
              android: {
                priority: 'high'
              },
              apns: {
                headers: {
                  'apns-priority': '10'
                }
              }
            });
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
    
    // Notify supervisors (Admin/Quality roles)
    const supervisorsSnapshot = await db.collection('users')
      .where('role', 'in', ['Admin', 'Quality'])
      .get();

    const notifications = [];
    
    for (const doc of supervisorsSnapshot.docs) {
      const userId = doc.id;
      try {
        // Get all tokens for this supervisor from devices subcollection
        const userTokens = await getUserTokens(userId);
        
        // Create notification for each device token
        for (const token of userTokens) {
          notifications.push({
            token: token,
            notification: {
              title: `Event Completed: ${eventTitle}`,
              body: `All tasks have been marked as complete`,
            },
            data: {
              type: 'event_completion',
              eventId: event.params.eventId,
              url: '/operational-dashboard'
            },
            webpush: {
              notification: {
                icon: '/favicon.ico'
              }
            }
          });
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
    // Get tokens from devices subcollection
    const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
    devicesSnap.forEach((deviceDoc) => {
      const deviceData = deviceDoc.data();
      const token = deviceDoc.id; // token is the document ID
      const enabled = deviceData?.enabled !== false; // default true
      if (token && enabled) {
        tokenSet.add(token);
      }
    });
    
    // If no devices found, fall back to main fcmToken (for backwards compatibility)
    if (tokenSet.size === 0) {
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
      try {
        const devicesSnap = await db.collection('users').doc(userDoc.id).collection('devices').get();
        devicesSnap.forEach((deviceDoc) => {
          const deviceData = deviceDoc.data();
          const token = deviceDoc.id; // token is the document ID
          const enabled = deviceData?.enabled !== false; // default true
          if (token && enabled) {
            tokenSet.add(token);
          }
        });
      } catch (e) {
        // If no devices subcollection, fall back to main fcmToken
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

    // Get all unique device tokens (no duplicates)
    const tokens = await getAllUserTokens();
    const eventDateStr = formatEventDate(deletedData.startDateTime);

    const messages = tokens.map(token => ({
      token,
      notification: {
        title: `Event Deleted: ${eventTitle}`,
        body: `Event scheduled for ${eventDateStr} was removed by ${deletedData.lastModifiedBy?.userName || 'a user'}`,
      },
      data: {
        type: 'event_delete',
        eventId,
        url: '/calendar',
      },
      webpush: {
        fcmOptions: {
          link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`,
        },
        notification: {
          icon: '/favicon.ico',
        },
      },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    }));

    if (messages.length > 0) {
      const results = await messaging.sendEach(messages);
      console.log(`Sent ${results.successCount}/${messages.length} deletion notifications for event ${eventId} to ${tokens.length} unique devices`);
      
      // Log any failures
      results.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error?.code || res.error?.errorInfo?.code;
          console.warn(`Notification send failed for token ${idx}:`, code, res.error?.message);
        }
      });
    }

    return { success: true, notificationsSent: messages.length, uniqueDevices: tokens.length };

  } catch (error) {
    console.error('Error sending deletion notifications:', error);
    return { success: false, error: error.message };
  }
});