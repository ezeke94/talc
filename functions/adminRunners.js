const { onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
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
  region: 'us-central1',
  timeoutSeconds: 120,
  memory: '512MiB'
}, async (req) => {
  await requireAdminOrQuality(req.auth);
  const result = await kpi.runWeeklyKPIReminders(true);
  return result;
});

// Admin callable: run KPI reminders immediately
exports.runWeeklyKPIReminders = onCall({
  region: 'us-central1',
  timeoutSeconds: 120,
  memory: '512MiB'
}, async (req) => {
  const uid = await requireAdminOrQuality(req.auth);
  const force = !!(req.data && req.data.force);
  const result = await kpi.runWeeklyKPIReminders(false, { force });
  // Log run to Firestore for audit
  try {
    await db.collection('_admin').doc('kpiRunLogs').collection('runs').add({
      initiatedBy: uid,
      initiatedAt: new Date(),
      type: 'manual',
      forced: force,
      resultSummary: {
        notificationCount: result.notificationCount || 0,
        pendingEvaluations: result.pendingEvaluations || 0,
        evaluatorsNotified: result.evaluatorsNotified || result.evaluatorsSummary?.length || 0
      },
      evaluatorsPreview: (result.evaluatorsSummary || []).slice(0, 200)
    });
  } catch (e) {
    logger.warn('Failed to write KPI run log', e);
  }
  return result;
});

// Admin callable: trigger to send weekly KPI reminders now (manual trigger)
exports.sendWeeklyKPIRemindersManual = onCall({
  region: 'us-central1'
}, async (req) => {
  const uid = await requireAdminOrQuality(req.auth);
  const result = await kpi.runWeeklyKPIReminders(false);
  // Audit log
  try {
    await db.collection('_admin').doc('kpiRunLogs').collection('runs').add({
      initiatedBy: uid,
      initiatedAt: new Date(),
      type: 'manual-send',
      resultSummary: {
        notificationCount: result.notificationCount || 0,
        pendingEvaluations: result.pendingEvaluations || 0,
        evaluatorsNotified: result.evaluatorsNotified || result.evaluatorsSummary?.length || 0
      }
    });
  } catch (e) {
    logger.warn('Failed to write KPI send log', e);
  }
  return result;
});

// HTTP fallback endpoints removed — using callables only now (deleted from console and removed locally to avoid drift)
// REMOVED: admin callables for removed notification flows (quality team & weekly overdue).
