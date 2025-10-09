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

    // Get admin users
    const adminsSnapshot = await db.collection('users')
      .where('role', '==', 'Admin')
      .where('fcmToken', '!=', null)
      .get();

    const notifications = [];
    
    adminsSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        const monthName = lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        notifications.push({
          token: userData.fcmToken,
          notification: {
            title: `Monthly Summary - ${monthName}`,
            body: `${completedEvents}/${totalEvents} events completed (${completionRate}%). ${overdueCount} overdue.`,
          },
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
            fcmOptions: {
              link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/operational-dashboard`
            },
            notification: {
              icon: '/favicon.ico'
            }
          }
        });
      }
    });

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
      // Get admin users
      const adminsSnapshot = await db.collection('users')
        .where('role', '==', 'Admin')
        .where('fcmToken', '!=', null)
        .get();

      const notifications = [];
      
      adminsSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmToken) {
          notifications.push({
            token: userData.fcmToken,
            notification: {
              title: `🚨 System Alert`,
              body: `${errorCount} errors detected in the last 6 hours`,
            },
            data: {
              type: 'system_alert',
              errorCount: errorCount.toString(),
              timeframe: '6_hours',
              url: '/operational-dashboard'
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
      });

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