const { onCall } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const eventNotifications = require('./eventNotifications');

// Initialize admin SDK if not already done
if (!getApps().length) initializeApp();
const db = getFirestore();
if (!admin.apps.length) admin.initializeApp();

// Helper: ensure caller is admin or quality
async function requireAdminOrQuality(auth) {
  if (!auth || !auth.uid) {
    throw new Error('Authentication required');
  }
  const uid = auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  const data = userDoc.data() || {};
  const role = data.role || '';
  if (!['Admin', 'Quality'].includes(role)) {
    const err = new Error('Permission denied: admin or quality role required');
    err.code = 'permission-denied';
    throw err;
  }
  return uid;
}

// REMOVED: runOwnerEventReminders callable (deleted per request)

// REMOVED: admin preview callable for owner reminders (deleted as part of cleanup)


// REMOVED: one-time migration callable (cleanup completed)


const kpi = require('./kpiNotifications');

// Admin callable: preview KPI reminders (dry run)
exports.previewWeeklyKPIReminders = onCall({
  region: 'us-central1'
}, async (req) => {
  await requireAdminOrQuality(req.auth);
  const result = await kpi.runWeeklyKPIReminders(true);
  return result;
});

// Admin callable: run KPI reminders immediately
exports.runWeeklyKPIReminders = onCall({
  region: 'us-central1'
}, async (req) => {
  await requireAdminOrQuality(req.auth);
  const result = await kpi.runWeeklyKPIReminders(false);
  return result;
});

// HTTP fallback endpoints (CORS-enabled) for cross-origin callers (e.g., Netlify)
const { onRequest } = require('firebase-functions/v2/https');

function setCorsHeaders(res, origin) {
  // Consider restricting origin to a whitelist for production
  res.set('Access-Control-Allow-Origin', origin || '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

exports.previewWeeklyKPIRemindersHttp = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  setCorsHeaders(res, req.get('origin'));
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.get('Authorization') || req.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    await requireAdminOrQuality({ uid: decoded.uid });
    const result = await kpi.runWeeklyKPIReminders(true);
    return res.json(result);
  } catch (err) {
    console.error('previewWeeklyKPIRemindersHttp error', err);
    return res.status(500).json({ error: err.message });
  }
});

exports.runWeeklyKPIRemindersHttp = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  setCorsHeaders(res, req.get('origin'));
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.get('Authorization') || req.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const idToken = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    await requireAdminOrQuality({ uid: decoded.uid });
    const result = await kpi.runWeeklyKPIReminders(false);
    return res.json(result);
  } catch (err) {
    console.error('runWeeklyKPIRemindersHttp error', err);
    return res.status(500).json({ error: err.message });
  }
});

// REMOVED: admin callables for removed notification flows (quality team & weekly overdue).
