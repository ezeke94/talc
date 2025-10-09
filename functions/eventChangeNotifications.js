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
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (userData?.fcmToken) {
          const oldDateStr = oldDateTime.toDate().toLocaleString();
          const newDateStr = newDateTime.toDate().toLocaleString();
          
          notifications.push({
            token: userData.fcmToken,
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
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (userData?.fcmToken) {
          const eventDateStr = afterData.startDateTime?.toDate().toLocaleString() || 'Unknown time';
          
          notifications.push({
            token: userData.fcmToken,
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
      .where('fcmToken', '!=', null)
      .get();

    const notifications = [];
    
    supervisorsSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        notifications.push({
          token: userData.fcmToken,
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
    });

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
    if (typeof val?.toDate === 'function') {
      return val.toDate().toLocaleString();
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  } catch {}
  return 'Unknown time';
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

    // Build recipient list: assignees + owner + creator
    const recipients = new Set();
    (deletedData.assignees || []).forEach((id) => id && recipients.add(id));
    if (deletedData.ownerId) recipients.add(deletedData.ownerId);
    if (deletedData.createdBy?.userId) recipients.add(deletedData.createdBy.userId);

    const messages = [];
    const recipientIds = []; // parallel array for error mapping
    const eventDateStr = formatEventDate(deletedData.startDateTime);

    // Notify direct recipients
    for (const userId of recipients) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (userData?.fcmToken) {
          messages.push({
            token: userData.fcmToken,
            notification: {
              title: `Event Deleted: ${eventTitle}`,
              body: `Event scheduled for ${eventDateStr} has been removed`,
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
          });
          recipientIds.push(userId);
        }
      } catch (userError) {
        console.error(`Error getting user ${userId}:`, userError);
      }
    }

    // Also notify supervisors (Admin/Quality roles) - query by role only, filter fcmToken in memory
    const supervisorRoles = ['Admin', 'Quality', 'admin', 'quality'];
    const supervisorsSnapshot = await db
      .collection('users')
      .where('role', 'in', supervisorRoles)
      .get();

    supervisorsSnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      // Filter for valid FCM tokens in memory to avoid composite index requirement
      if (userData.fcmToken) {
        messages.push({
          token: userData.fcmToken,
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
        });
        recipientIds.push(docSnap.id);
      }
    });

    if (messages.length > 0) {
      const results = await messaging.sendEach(messages);
      console.log(`Sent ${results.successCount}/${messages.length} deletion notifications for event ${eventId}`);
      // Clean up invalid tokens
      results.responses.forEach(async (res, idx) => {
        if (!res.success) {
          const code = res.error?.code || res.error?.errorInfo?.code;
          const recipientId = recipientIds[idx];
          console.warn(`Notification send failed for user ${recipientId}:`, code, res.error?.message);
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
            try {
              await db.collection('users').doc(recipientId).update({ fcmToken: null, notificationsEnabled: false });
              console.log(`Cleared invalid FCM token for user ${recipientId}`);
            } catch (clearErr) {
              console.error(`Failed to clear FCM token for user ${recipientId}:`, clearErr);
            }
          }
        }
      });
    }

    return { success: true, notificationsSent: messages.length };

  } catch (error) {
    console.error('Error sending deletion notifications:', error);
    return { success: false, error: error.message };
  }
});