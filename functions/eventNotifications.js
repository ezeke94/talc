const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

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
    const ownerTokens = new Map();

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
        // Cache user tokens and verify they exist as users
        if (!ownerTokens.has(userId)) {
          const userDoc = await db.collection('users').doc(userId).get();
          const userData = userDoc.data();
          if (userData?.fcmToken) {
            ownerTokens.set(userId, userData.fcmToken);
          }
        }

        const fcmToken = ownerTokens.get(userId);
        if (fcmToken) {
          notifications.push({
            token: fcmToken,
            notification: {
              title: `Event Tomorrow: ${event.title}`,
              body: `Due tomorrow at ${new Date(event.startDateTime.toDate()).toLocaleTimeString()}`,
              icon: '/favicon.ico'
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
              }
            }
          });
        }
      }
    }

    // Send notifications in batches
    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      if (batch.length > 0) {
        await messaging.sendEach(batch);
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
    const qualityUserTokens = new Map();

    // Get all Quality team members
    const qualityUsersSnapshot = await db.collection('users')
      .where('role', '==', 'Quality')
      .where('fcmToken', '!=', null)
      .get();

    // Cache quality team tokens
    qualityUsersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        qualityUserTokens.set(doc.id, {
          token: userData.fcmToken,
          centers: userData.assignedCenters || []
        });
      }
    });

    // Process events for same-day reminders
    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      const eventTime = event.startDateTime.toDate();
      
      // Skip if event is in the past (already started today)
      if (eventTime < new Date()) {
        continue;
      }

      // Notify Quality team members
      for (const [userId, userData] of qualityUserTokens) {
        // Check if quality member should be notified (center assignment)
        const shouldNotify = userData.centers.length === 0 || 
          (event.center && userData.centers.includes(event.center)) ||
          (event.assignedCenters && event.assignedCenters.some(center => userData.centers.includes(center)));

        if (shouldNotify) {
          notifications.push({
            token: userData.token,
            notification: {
              title: `Event Today: ${event.title}`,
              body: `Due today at ${eventTime.toLocaleTimeString()}`,
              icon: '/favicon.ico'
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
              }
            }
          });
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
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (userData?.fcmToken) {
          notifications.push({
            token: userData.fcmToken,
            notification: {
              title: `Event Today: ${event.title}`,
              body: `Due today at ${eventTime.toLocaleTimeString()}`,
              icon: '/favicon.ico'
            },
            data: {
              type: 'event_reminder_owner_same_day',
              eventId: eventDoc.id,
              url: `/calendar`,
              timing: 'same_day'
            }
          });
        }
      }
    }

    // Send notifications in batches
    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      if (batch.length > 0) {
        await messaging.sendEach(batch);
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
    const userTokens = new Map();

    for (const eventDoc of overdueEventsSnapshot.docs) {
      const event = eventDoc.data();
      const assigneeIds = event.assignees || [];
      
      for (const userId of assigneeIds) {
        if (!userTokens.has(userId)) {
          const userDoc = await db.collection('users').doc(userId).get();
          const userData = userDoc.data();
          if (userData?.fcmToken) {
            userTokens.set(userId, userData.fcmToken);
          }
        }

        const fcmToken = userTokens.get(userId);
        if (fcmToken) {
          const daysOverdue = Math.ceil((now - event.startDateTime.toDate()) / (1000 * 60 * 60 * 24));
          notifications.push({
            token: fcmToken,
            notification: {
              title: `Overdue Task: ${event.title}`,
              body: `This task is ${daysOverdue} days overdue`,
              icon: '/favicon.ico'
            },
            data: {
              type: 'task_overdue',
              eventId: eventDoc.id,
              daysOverdue: daysOverdue.toString(),
              url: '/calendar'
            }
          });
        }
      }
    }

    const batchSize = 500;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      if (batch.length > 0) {
        await messaging.sendEach(batch);
      }
    }

    console.log(`Sent ${notifications.length} overdue task notifications`);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error sending overdue reminders:', error);
    throw error;
  }
});