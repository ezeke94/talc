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

exports.handler = async function (event) {
  try {
    initAdmin();
    const body = JSON.parse(event.body || '{}');
    const { token, title = 'Test', body: msgBody = 'Hello from Netlify function', data = {} } = body;
    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'token is required' }) };
    }

    const message = {
      token,
      notification: {
        title,
        body: msgBody,
      },
      data: Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: String(data[k]) }), {}),
    };

    const response = await admin.messaging().send(message);
    return { statusCode: 200, body: JSON.stringify({ result: response }) };
  } catch (err) {
    console.error('sendTestNotification error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
