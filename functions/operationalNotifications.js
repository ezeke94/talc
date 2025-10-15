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

// Heuristic: detect Web FCM tokens (long, includes colon). Adjust if storing platform separately.
function isWebToken(token) {
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}

// Absolute asset URLs for WebPush icons/badges
const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
const absIcon = `${baseUrl}/favicon.ico`;
const absBadge = `${baseUrl}/favicon.ico`;

// Firestore-based deduplication: log and skip if recently sent
async function wasNotificationRecentlySent(userId, dedupKey, ttlSeconds = 3600) {
  try {
    const key = `${userId}-${dedupKey}`;
    const ref = db.collection('_notificationLog').doc(key);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : (data.sentAt ? new Date(data.sentAt) : null);
      if (sentAt) {
        const ageSec = (Date.now() - sentAt.getTime()) / 1000;
        if (ageSec < ttlSeconds) {
          return true;
        }
      } else {
        // If no timestamp, treat as duplicate to be safe
        return true;
      }
    }
    await ref.set({ userId, dedupKey, sentAt: new Date() }, { merge: true });
    return false;
  } catch (e) {
    console.error('wasNotificationRecentlySent error', e);
    return false; // fail open
  }
}

// Helper: fetch all device tokens for a user (devices subcollection with fallback to fcmToken)
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

// Monthly operational summary (1st of each month at 8 AM)
exports.sendMonthlyOperationalSummary = onSchedule({
  schedule: "0 8 1 * *", // 1st day of every month at 8 AM
  timeZone: "UTC",
  region: "us-central1",
  memory: "512MiB", // Slightly more memory for data processing
}, async (event) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get operational metrics for last month
    const [eventsSnapshot, kpiSubmissionsSnapshot, auditLogsSnapshot] = await Promise.all([
      db.collection('events')
        .where('createdAt', '>=', lastMonth)
        .where('createdAt', '<', thisMonth)
        .get(),
      db.collection('kpiSubmissions')
        .where('createdAt', '>=', lastMonth)
        .where('createdAt', '<', thisMonth)
        .get(),
      db.collection('auditLogs')
        .where('timestamp', '>=', lastMonth)
        .where('timestamp', '<', thisMonth)
        .get()
    ]);

    // Calculate metrics
    const totalEvents = eventsSnapshot.size;
    const completedEvents = eventsSnapshot.docs.filter(doc => 
      doc.data().status === 'completed'
    ).length;
    const totalKpiSubmissions = kpiSubmissionsSnapshot.size;
    const totalAuditActions = auditLogsSnapshot.size;

    const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

    // Get overdue events (still pending/in_progress past their due date)
    const overdueEventsSnapshot = await db.collection('events')
      .where('startDateTime', '<', now)
      .where('status', 'in', ['pending', 'in_progress'])
      .get();
    
    const overdueCount = overdueEventsSnapshot.size;

    // Get ALL users (role-based filtering removed)
    const allUsersSnapshot = await db.collection('users').get();

    const notifications = [];
    
    for (const doc of allUsersSnapshot.docs) {
      const userData = doc.data();
      const tokens = await getAllUserTokens(doc.id);
      // Dedup key: monthly summary for lastMonth (YYYY-MM)
      const monthKey = `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, '0')}`;
      const dedupKey = `monthly_summary_${monthKey}`;
      if (await wasNotificationRecentlySent(doc.id, dedupKey, 7 * 24 * 3600)) {
        continue; // already sent this monthly summary to the user
      }
      
      for (const token of tokens) {
        const monthName = lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        const title = `Monthly Summary - ${monthName}`;
        const body = `${completedEvents}/${totalEvents} events completed (${completionRate}%). ${overdueCount} overdue.`;
        const web = isWebToken(token);

        if (web) {
          notifications.push({
            token,
            data: {
              type: 'monthly_summary',
              totalEvents: totalEvents.toString(),
              completedEvents: completedEvents.toString(),
              completionRate: completionRate.toString(),
              kpiSubmissions: totalKpiSubmissions.toString(),
              overdueEvents: overdueCount.toString(),
              auditActions: totalAuditActions.toString(),
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
              type: 'monthly_summary',
              totalEvents: totalEvents.toString(),
              completedEvents: completedEvents.toString(),
              completionRate: completionRate.toString(),
              kpiSubmissions: totalKpiSubmissions.toString(),
              overdueEvents: overdueCount.toString(),
              auditActions: totalAuditActions.toString(),
              url: '/operational-dashboard'
            },
            webpush: {
              fcmOptions: { link: `${baseUrl}/operational-dashboard` },
              notification: { icon: absIcon, badge: absBadge }
            }
          });
        }
      }
    }

    if (notifications.length > 0) {
      const results = await messaging.sendEach(notifications);
      console.log(`Sent ${results.successCount} monthly summary notifications`);
    }

    return { 
      success: true, 
      notificationsSent: notifications.length,
      metrics: {
        totalEvents,
        completedEvents,
        completionRate,
        kpiSubmissions: totalKpiSubmissions,
        overdueEvents: overdueCount,
        auditActions: totalAuditActions
      }
    };

  } catch (error) {
    console.error('Error sending monthly summary:', error);
    throw error;
  }
});

// Critical system alerts (when error rate is high)
exports.sendCriticalSystemAlert = onSchedule({
  schedule: "0 */6 * * *", // Every 6 hours
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    // Check for high error rate in audit logs
    const errorLogsSnapshot = await db.collection('auditLogs')
      .where('timestamp', '>=', sixHoursAgo)
      .where('action', '==', 'error')
      .get();

    const errorCount = errorLogsSnapshot.size;
    const ERROR_THRESHOLD = 10; // Adjust based on your needs

    if (errorCount >= ERROR_THRESHOLD) {
      // Get ALL users (role-based filtering removed)
      const allUsersSnapshot = await db.collection('users').get();

      const notifications = [];
      
      for (const doc of allUsersSnapshot.docs) {
        const userData = doc.data();
        const tokens = await getAllUserTokens(doc.id);
        
        // Dedup per 6-hour window (keyed by start hour)
        const windowKey = new Date(sixHoursAgo);
        windowKey.setUTCMinutes(0, 0, 0);
        const dedupKey = `system_alert_${windowKey.toISOString().slice(0,13)}`;
        if (await wasNotificationRecentlySent(doc.id, dedupKey, 6 * 3600)) {
          continue;
        }

        for (const token of tokens) {
          const title = `🚨 System Alert`;
          const body = `${errorCount} errors detected in the last 6 hours`;
          const web = isWebToken(token);
          if (web) {
            notifications.push({
              token,
              data: {
                type: 'system_alert',
                errorCount: errorCount.toString(),
                timeframe: '6_hours',
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
                type: 'system_alert',
                errorCount: errorCount.toString(),
                timeframe: '6_hours',
                url: '/operational-dashboard'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/operational-dashboard` },
                notification: { icon: absIcon, badge: absBadge }
              },
              android: { priority: 'high' },
              apns: { headers: { 'apns-priority': '10' } }
            });
          }
        }
      }

      if (notifications.length > 0) {
        const results = await messaging.sendEach(notifications);
        console.log(`Sent ${results.successCount} critical alert notifications for ${errorCount} errors`);
      }

      return { success: true, notificationsSent: notifications.length, errorCount };
    }

    return { success: true, notificationsSent: 0, errorCount };

  } catch (error) {
    console.error('Error checking system alerts:', error);
    throw error;
  }
});