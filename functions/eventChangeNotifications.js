const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
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
              icon: '/favicon.ico'
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
              icon: '/favicon.ico'
            },
            data: {
              type: 'event_cancellation',
              eventId: eventId,
              url: '/calendar'
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
            icon: '/favicon.ico'
          },
          data: {
            type: 'event_completion',
            eventId: event.params.eventId,
            url: '/operational-dashboard'
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