const { onCall } = require("firebase-functions/v2/https");const logger = require('firebase-functions/logger');const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

// Heuristic: detect Web FCM tokens (long, includes colon). Adjust as needed if you store platform.
function isWebToken(token) {
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}

/**
 * Firebase Callable Function: Send Test Notification
 * Sends a test notification to a specific user's registered devices
 */
exports.sendTestNotification = onCall({
  region: "us-central1",
  memory: "256MiB",
  cors: true, // Enable CORS for all origins
}, async (request) => {
  try {
    const { userId, userName, clientTimestamp } = request.data;

    if (!userId) {
      throw new Error('userId is required');
    }

    // Get all device tokens for this user
    const tokens = new Set();
    let hasDevices = false;

    // Get from devices subcollection
    try {
      const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
      devicesSnap.forEach((d) => {
        const token = d.id;
        const enabled = d.data()?.enabled !== false;
        if (token && enabled) {
          tokens.add(token);
          hasDevices = true;
        }
      });
    } catch (e) {
      logger.error('Error fetching devices:', e);
    }

    // Fallback to fcmToken if no devices
    if (!hasDevices) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (userData?.fcmToken) {
          tokens.add(userData.fcmToken);
        }
      } catch (e) {
        console.error('Error fetching user fcmToken:', e);
      }
    }

    if (tokens.size === 0) {
      throw new Error('User has no registered devices');
    }

    const tokenList = Array.from(tokens);
    const serverIso = new Date().toISOString();
    // Prefer client-side timestamp (locale) when provided; otherwise show server ISO (marked UTC)
    const displayTimestamp = clientTimestamp || `${serverIso} (UTC)`;
    const displayName = userName || 'User';
    
    const title = 'Test Notification';
    const body = `Hi ${displayName}! This test notification was sent at ${displayTimestamp}`; 

    // Create notifications for each token with proper iOS/Android formatting
    const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
    const absIcon = `${baseUrl}/favicon.ico`;
    const absBadge = `${baseUrl}/favicon.ico`;

    const messages = tokenList.map(token => {
      const web = isWebToken(token);
      if (web) {
        // Web: send data-only + WebPush notification (service worker will also handle)
        return {
          token,
          data: {
            type: 'test_notification',
            timestamp: serverIso,
            clientTimestamp: clientTimestamp || '',
            url: '/'
          },
          webpush: {
            fcmOptions: {
              link: `${baseUrl}/`
            },
            notification: {
              title,
              body,
              icon: absIcon,
              badge: absBadge
            }
          }
        };
      }

      // Non-web (kept for completeness): include platform-specific configs
      return {
        token,
        notification: { title, body },
        data: {
          type: 'test_notification',
          timestamp: serverIso,
          clientTimestamp: clientTimestamp || '',
          url: '/'
        },
        webpush: {
          fcmOptions: { link: `${baseUrl}/` },
          notification: { icon: absIcon, badge: absBadge }
        },
        android: {
          priority: 'high',
          notification: {
            title,
            body,
            icon: absIcon,
            color: '#1976d2',
            sound: 'default',
            channelId: 'default'
          }
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { alert: { title, body }, sound: 'default', badge: 1 } }
        }
      };
    });

    // Send notifications
    const results = await messaging.sendEach(messages);

    logger.info(`Test notification results: ${results.successCount} success, ${results.failureCount} failures`);

    // Log failures
    results.responses.forEach((response, idx) => {
      if (!response.success) {
        logger.warn(`Failed to send to token ${idx}:`, response.error);
      }
    });

    return {
      success: true,
      successCount: results.successCount,
      failureCount: results.failureCount,
      totalSent: tokenList.length
    };

  } catch (error) {
    logger.error('Error sending test notification:', error);
    throw error;
  }
});
