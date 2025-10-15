// Netlify Function: sendTestNotification
// Expects environment variables:
//   SERVICE_ACCOUNT_JSON - JSON string of Firebase service account (for admin SDK)
//   FCM_PROJECT_ID - Firebase project ID (optional if in service account)
// Receives POST JSON: { token: '<recipient-token>', title: '...', body: '...', data: { ... } }

const admin = require('firebase-admin');

let appInitialized = false;

function initAdmin() {
  if (appInitialized) return;
  const svcJson = process.env.SERVICE_ACCOUNT_JSON;
  if (!svcJson) throw new Error('SERVICE_ACCOUNT_JSON not set in env');
  const serviceAccount = JSON.parse(svcJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  appInitialized = true;
}

// Heuristic for Web FCM tokens
function isWebToken(token) {
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}

exports.handler = async function (event) {
  try {
    initAdmin();
    const body = JSON.parse(event.body || '{}');
    const { token, tokens, title, body: msgBody, data = {}, userName, timestamp } = body;
    
    // Support both single token and multiple tokens
    const tokenList = tokens || (token ? [token] : []);
    
    if (tokenList.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'token or tokens array is required' }) };
    }

    // Use provided title/body or create test notification message
    const notificationTitle = title || 'Test Notification';
    const notificationBody = msgBody || (userName && timestamp 
      ? `Hi ${userName}! This is a test notification sent at ${timestamp}` 
      : 'Test notification from TALC Management');

    // Absolute URLs for WebPush assets
    const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
    const absIcon = `${baseUrl}/favicon.ico`;
    const absBadge = `${baseUrl}/favicon.ico`;

    // Create notifications for each token with web-specific handling
    const messages = tokenList.map(tkn => {
      const web = isWebToken(tkn);
      if (web) {
        return {
          token: tkn,
          data: {
            type: 'test_notification',
            timestamp: timestamp || new Date().toISOString(),
            ...Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: String(data[k]) }), {})
          },
          webpush: {
            fcmOptions: { link: `${baseUrl}/` },
            notification: { title: notificationTitle, body: notificationBody, icon: absIcon, badge: absBadge }
          }
        };
      }
      return {
        token: tkn,
        notification: { title: notificationTitle, body: notificationBody },
        data: {
          type: 'test_notification',
          timestamp: timestamp || new Date().toISOString(),
          ...Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: String(data[k]) }), {})
        },
        webpush: {
          fcmOptions: { link: `${baseUrl}/` },
          notification: { icon: absIcon, badge: absBadge }
        },
        android: {
          priority: 'high',
          notification: {
            icon: absIcon,
            color: '#1976d2',
            sound: 'default',
            channelId: 'default'
          }
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { alert: { title: notificationTitle, body: notificationBody }, sound: 'default', badge: 1 } }
        }
      };
    });

    // Send all notifications
    const results = await admin.messaging().sendEach(messages);
    
    console.log(`Test notification results: ${results.successCount} success, ${results.failureCount} failures`);
    
    // Log failures
    results.responses.forEach((response, idx) => {
      if (!response.success) {
        console.error(`Failed to send to token ${idx}:`, response.error);
      }
    });

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true,
        successCount: results.successCount,
        failureCount: results.failureCount,
        totalSent: tokenList.length
      }) 
    };
  } catch (err) {
    console.error('sendTestNotification error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
