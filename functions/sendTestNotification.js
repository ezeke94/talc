const { onCall } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

/**
 * Firebase Callable Function: Send Test Notification
 * Sends a test notification to a specific user's registered devices
 */
exports.sendTestNotification = onCall({
  region: "us-central1",
  memory: "256MiB",
}, async (request) => {
  try {
    const { userId, userName } = request.data;

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
      console.error('Error fetching devices:', e);
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
    const timestamp = new Date().toLocaleString();
    const displayName = userName || 'User';
    
    const title = 'Test Notification';
    const body = `Hi ${displayName}! This is a test notification sent at ${timestamp}`;

    // Create notifications for each token with proper iOS/Android formatting
    const messages = tokenList.map(token => ({
      token,
      notification: {
        title,
        body,
      },
      data: {
        type: 'test_notification',
        timestamp: new Date().toISOString(),
        url: '/'
      },
      webpush: {
        fcmOptions: {
          link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/`
        },
        notification: {
          icon: '/favicon.ico',
          badge: '/favicon.ico'
        }
      },
      // Android-specific config
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          color: '#1976d2',
          sound: 'default',
          channelId: 'default'
        }
      },
      // iOS-specific config
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title,
              body
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    }));

    // Send notifications
    const results = await messaging.sendEach(messages);

    console.log(`Test notification results: ${results.successCount} success, ${results.failureCount} failures`);

    // Log failures
    results.responses.forEach((response, idx) => {
      if (!response.success) {
        console.error(`Failed to send to token ${idx}:`, response.error);
      }
    });

    return {
      success: true,
      successCount: results.successCount,
      failureCount: results.failureCount,
      totalSent: tokenList.length
    };

  } catch (error) {
    console.error('Error sending test notification:', error);
    throw error;
  }
});
