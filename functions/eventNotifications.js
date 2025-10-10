const { onSchedule, onDocumentCreated } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

// Helper: fetch all device tokens for a user (main fcmToken + devices subcollection)
async function getAllUserTokens(userId) {
  const tokens = new Set();
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (userData?.fcmToken) tokens.add(userData.fcmToken);
  } catch (e) {
    console.error(`getAllUserTokens: failed to read user ${userId}`, e);
  }
  try {
    const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
    devicesSnap.forEach((d) => {
      const token = d.id;
      const enabled = d.data()?.enabled !== false; // default true
      if (token && enabled) tokens.add(token);
    });
  } catch (e) {
    // subcollection may not exist
  }
  return Array.from(tokens);
}

// Helper: fetch all device tokens for all users
async function getAllTokensForAllUsers() {
  const tokens = new Set();
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData?.fcmToken) tokens.add(userData.fcmToken);

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
          notifications.push({
            token,
            notification: {
              title: `Event Tomorrow: ${event.title}`,
              body: `Due tomorrow at ${new Date(event.startDateTime.toDate()).toLocaleTimeString()}`,
            },
            data: {
              type: 'event_reminder_owner',
              eventId: eventDoc.id,
              url: `/calendar`,
              timing: 'day_before'
            },
            webpush: {
              fcmOptions: {
                link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`
              },
              notification: {
                icon: '/favicon.ico'
              }
            }
          });
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

// Quality team and owner reminders - same day at 4 PM UTC
exports.sendQualityTeamEventReminders = onSchedule({
  schedule: "0 16 * * *", // Daily at 4 PM UTC
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

    // Get all Quality team members
    const qualityUsersSnapshot = await db.collection('users')
      .where('role', 'in', ['Quality', 'quality'])
      .get();

    // Build quality members with centers and tokens (multi-device)
    const qualityMembers = [];
    for (const docSnap of qualityUsersSnapshot.docs) {
      const data = docSnap.data();
      const centers = data.assignedCenters || [];
      const tokens = await getAllUserTokens(docSnap.id);
      if (tokens.length) {
        qualityMembers.push({ userId: docSnap.id, centers, tokens });
      }
    }

    // Process events for same-day reminders
    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      const eventTime = event.startDateTime.toDate();
      
      // Skip if event is in the past (already started today)
      if (eventTime < new Date()) {
        continue;
      }

      // Notify Quality team members
      for (const member of qualityMembers) {
        const shouldNotify = member.centers.length === 0 ||
          (event.center && member.centers.includes(event.center)) ||
          (event.assignedCenters && event.assignedCenters.some(center => member.centers.includes(center)));
        if (!shouldNotify) continue;
        for (const token of member.tokens) {
          notifications.push({
            token,
            notification: {
              title: `Event Today: ${event.title}`,
              body: `Due today at ${eventTime.toLocaleTimeString()}`,
            },
            data: {
              type: 'event_reminder_quality',
              eventId: eventDoc.id,
              url: `/calendar`,
              timing: 'same_day'
            },
            webpush: {
              fcmOptions: {
                link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`
              },
              notification: {
                icon: '/favicon.ico'
              }
            }
          });
          recipientsMeta.push({ userId: member.userId, token });
        }
      }

      // Also notify owners/assignees same day
      const ownerIds = [];
      if (event.createdBy?.userId) {
        ownerIds.push(event.createdBy.userId);
      }
      ownerIds.push(...(event.assignees || []));
      const uniqueOwnerIds = [...new Set(ownerIds)];

      for (const userId of uniqueOwnerIds) {
        const tokens = await getAllUserTokens(userId);
        for (const token of tokens) {
          notifications.push({
            token,
            notification: {
              title: `Event Today: ${event.title}`,
              body: `Due today at ${eventTime.toLocaleTimeString()}`,
            },
            data: {
              type: 'event_reminder_owner_same_day',
              eventId: eventDoc.id,
              url: `/calendar`,
              timing: 'same_day'
            },
            webpush: {
              notification: {
                icon: '/favicon.ico'
              }
            }
          });
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
          const daysOverdue = Math.ceil((now - event.startDateTime.toDate()) / (1000 * 60 * 60 * 24));
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
              notification: {
                icon: '/favicon.ico'
              }
            }
          });
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

// Notify all users about calendar events
exports.sendCalendarEventNotifications = onSchedule({
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

    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      const tokens = await getAllTokensForAllUsers();

      for (const token of tokens) {
        notifications.push({
          token,
          notification: {
            title: `Event Tomorrow: ${event.title}`,
            body: `Due tomorrow at ${new Date(event.startDateTime.toDate()).toLocaleTimeString()}`,
          },
          data: {
            type: 'event_reminder_all',
            eventId: eventDoc.id,
            url: `/calendar`,
            timing: 'day_before'
          },
          webpush: {
            fcmOptions: {
              link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`
            },
            notification: {
              icon: '/favicon.ico'
            }
          }
        });
      }
    }

    // Send notifications in batches
    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      if (batch.length > 0) {
        const results = await messaging.sendEach(batch);
        console.log(`Batch sent with ${batch.length} notifications`);
      }
    }

    console.log(`Sent ${notifications.length} calendar event notifications to all users`);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending calendar event notifications:', error);
    throw error;
  }
});

// Trigger notifications when a new event is created
exports.sendNotificationsOnEventCreate = onDocumentCreated({
  document: "events/{eventId}",
  region: "us-central1",
}, async (event) => {
  try {
    const eventData = event.data;
    const tokens = await getAllTokensForAllUsers();

    const notifications = tokens.map(token => ({
      token,
      notification: {
        title: `New Event Created: ${eventData.title}`,
        body: `Scheduled for ${new Date(eventData.startDateTime.toDate()).toLocaleString()}`,
      },
      data: {
        type: 'event_created',
        eventId: event.id,
        url: `/calendar`,
      },
      webpush: {
        fcmOptions: {
          link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/calendar`
        },
        notification: {
          icon: '/favicon.ico'
        }
      }
    }));

    // Send notifications in batches
    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      if (batch.length > 0) {
        const results = await messaging.sendEach(batch);
        console.log(`Batch sent with ${batch.length} notifications`);
      }
    }

    console.log(`Sent ${notifications.length} notifications for event creation`);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending notifications for event creation:', error);
    throw error;
  }
});