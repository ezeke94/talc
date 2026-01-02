const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require('firebase-functions/logger');
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize admin SDK if not already done
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

// Heuristic to detect Web FCM tokens
function isWebToken(token) {
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}

// Absolute asset URLs for WebPush
const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
const absIcon = `${baseUrl}/favicon.ico`;
const absBadge = `${baseUrl}/favicon.ico`;

// Firestore-based deduplication helper (READ-ONLY check)
async function wasNotificationRecentlySent(userId, dedupKey, ttlSeconds = 24 * 3600) {
  try {
    const key = `${userId}-${dedupKey}`;
    const ref = db.collection('_notificationLog').doc(key);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      const sentAt = data.sentAt?.toDate ? data.sentAt.toDate() : (data.sentAt ? new Date(data.sentAt) : null);
      if (sentAt) {
        const ageSec = (Date.now() - sentAt.getTime()) / 1000;
        if (ageSec < ttlSeconds) return true;
        return false;
      } else {
        // If stored entry has no timestamp, treat conservatively as "recent"
        return true;
      }
    }
    // Intentionally DO NOT write here — this is a read-only check. Writing should occur only after a successful send.
    return false;
  } catch (e) {
    logger.error('wasNotificationRecentlySent error', e);
    // Fail open so we don't block notifications on helper errors
    return false;
  }
}

// Record that a notification was actually sent (writes to _notificationLog)
async function recordNotificationSent(userId, dedupKey, meta = {}) {
  try {
    const key = `${userId}-${dedupKey}`;
    const ref = db.collection('_notificationLog').doc(key);
    await ref.set({ userId, dedupKey, sentAt: new Date(), meta }, { merge: true });
  } catch (e) {
    logger.error('recordNotificationSent error', e);
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
      logger.error(`getAllUserTokens: failed to read user ${userId}`, e);
    }
  }
  
  return Array.from(tokens);
}

// Helper: Handle Firestore index-required errors for scheduled functions
async function handleMissingIndex(funcName, error) {
  const isIndexError = error && (error.code === 9 || (error.message && error.message.includes('requires an index')));
  if (!isIndexError) return false;
  logger.warn(`Firestore index missing for ${funcName}. Skipping this scheduled run: ${error.message}`);
  try {
    await db.collection('_alerts').doc('missing_indexes').set({
      lastSeen: new Date(),
      [funcName]: { lastSeen: new Date(), message: String(error) }
    }, { merge: true });
  } catch (e) {
    logger.warn('Failed to write missing_indexes alert doc', e);
  }
  return true;
}


// Core runner for KPI reminders
async function runWeeklyKPIReminders(dryRun = false, options = {}) {
  const force = !!options.force;
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Get all mentors with their assigned evaluators
    const mentorsSnapshot = await db.collection('mentors').get();
    const mentors = mentorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get recent KPI submissions (last 2 weeks)
    const recentSubmissionsSnapshot = await db.collection('kpiSubmissions')
      .where('createdAt', '>=', twoWeeksAgo)
      .get();
    
    const recentSubmissions = new Set();
    recentSubmissionsSnapshot.forEach(doc => {
      const data = doc.data();
      recentSubmissions.add(`${data.mentorId}_${data.kpiType || data.formName}`);
    });

    const notifications = [];
    const evaluatorTokens = new Map();

    // Check for mentors without recent KPI submissions
    const pendingEvaluations = [];
    
    // Prefetch form names for all assigned forms to avoid sequential reads
    const allFormIds = new Set();
    for (const m of mentors) {
      const ids = m.assignedFormIds || [];
      ids.forEach(id => allFormIds.add(id));
    }
    const formIdList = Array.from(allFormIds);
    const formNamesById = {};
    if (formIdList.length) {
      const formSnaps = await Promise.all(formIdList.map(id => db.collection('kpiForms').doc(id).get()));
      formSnaps.forEach((snap, idx) => {
        const id = formIdList[idx];
        formNamesById[id] = snap.exists ? (snap.data().name || id) : id;
      });
    }

    for (const mentor of mentors) {
      const mentorCenters = Array.isArray(mentor.assignedCenters) 
        ? mentor.assignedCenters 
        : (mentor.center ? [mentor.center] : []);

      // Check if mentor has recent submissions for each assigned form
      const assignedFormIds = mentor.assignedFormIds || [];
      
      for (const formId of assignedFormIds) {
        // Use prefetched form name
        const formName = formNamesById[formId] || formId;
        const submissionKey = `${mentor.id}_${formName}`;
        if (!recentSubmissions.has(submissionKey)) {
          pendingEvaluations.push({
            mentorId: mentor.id,
            mentorName: mentor.name,
            formId: formId,
            formName: formName,
            centers: mentorCenters,
            assignedEvaluator: mentor.assignedEvaluator
          });
        }
      }
    }

    // Send notifications to assigned evaluators or fallback to admin/quality
    const notificationsByEvaluator = new Map();

    for (const pending of pendingEvaluations) {
      let targetEvaluatorId = null;

      // If assigned evaluator exists, use them (fast path)
      if (pending.assignedEvaluator?.id) {
        targetEvaluatorId = pending.assignedEvaluator.id;
      } else if (!dryRun) {
        // For non-dry runs, perform the heavier fallback logic using cached evaluator tokens
        // Get ALL users (role-based filtering removed)
        if (evaluatorTokens.size === 0) {
          const usersSnapshot = await db.collection('users').get();
          // Parallelize token lookups to speed up building the cache
          await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
            const userData = userDoc.data();
            const tokens = await getAllUserTokens(userDoc.id);
            // Include evaluator in cache even if they have no tokens so run mirrors preview
            evaluatorTokens.set(userDoc.id, {
              tokens: tokens,
              centers: userData.assignedCenters || [],
              name: userData.name || userData.email,
              role: userData.role || 'User'
            });
          }));
        }

        for (const [evaluatorId, evaluatorData] of evaluatorTokens) {
          const shouldNotify = evaluatorData.centers.length === 0 || 
            pending.centers.some(center => evaluatorData.centers.includes(center));

          if (shouldNotify) {
            targetEvaluatorId = evaluatorId;
            break; // Use first available admin/quality
          }
        }
      }

      // Add to notifications for this evaluator
      if (targetEvaluatorId) {
        if (!notificationsByEvaluator.has(targetEvaluatorId)) {
          notificationsByEvaluator.set(targetEvaluatorId, []);
        }
        notificationsByEvaluator.get(targetEvaluatorId).push(pending);
      }
    }

    // Build per-evaluator summary
    const evaluatorsSummary = [];
    // Track evaluators that will actually be sent notifications (so we can record dedupe entries AFTER successful sends)
    const willNotifyEvaluatorIds = new Set();
    for (const [evaluatorId, pendingList] of notificationsByEvaluator) {
      let evaluatorData = evaluatorTokens.get(evaluatorId);

      // If evaluator data wasn't cached (e.g., assigned evaluator with no cached tokens),
      // fetch a minimal profile so preview can show the evaluator even if they have 0 tokens.
      if (!evaluatorData) {
        try {
          const userDoc = await db.collection('users').doc(evaluatorId).get();
          const userData = userDoc.exists ? userDoc.data() : {};
          const tokens = await getAllUserTokens(evaluatorId);
          evaluatorData = {
            tokens,
            centers: userData.assignedCenters || [],
            name: userData.name || userData.email || evaluatorId,
            role: userData.role || 'User'
          };
          // Cache for possible later use
          evaluatorTokens.set(evaluatorId, evaluatorData);
        } catch (e) {
          logger.warn('Failed to fetch evaluator data for preview', evaluatorId, e);
          // Continue - skip this evaluator if profile can't be loaded
          continue;
        }
      }

      const mentorCount = new Set(pendingList.map(p => p.mentorId)).size;
      const formCount = pendingList.length;
      const tokenCount = evaluatorData.tokens.length;
      const tokenSamples = evaluatorData.tokens.slice(0, 3);

      // Dedup per day per evaluator for KPI reminders (only applied for sends)
      // NOTE: This dedupe key is KPI-specific and will not block other notification types
      const todayKey = new Date();
      todayKey.setUTCHours(0,0,0,0);
      const dedupKey = `kpi_reminder_${todayKey.toISOString().slice(0,10)}`;
      let skipReason = null;
      if (!dryRun) {
        const wasSent = await wasNotificationRecentlySent(evaluatorId, dedupKey, 24 * 3600);
        if (wasSent && !force) skipReason = 'deduped';
      }
      if (!skipReason && tokenCount === 0) {
        skipReason = 'no_tokens';
      }

      evaluatorsSummary.push({
        evaluatorId,
        name: evaluatorData.name,
        role: evaluatorData.role,
        mentorCount,
        formCount,
        tokenCount,
        tokenSamples,
        skipReason
      });

      // If not dry run, build push messages only for evaluators that will be sent
      if (!dryRun && !skipReason) {
        // mark evaluator to record dedupe after successful send
        willNotifyEvaluatorIds.add(evaluatorId);
        for (const token of evaluatorData.tokens) {
          const title = `KPI Assessments Pending`; 
          const body = `${mentorCount} mentor(s) need evaluation (${formCount} forms)`;
          const web = isWebToken(token);
          if (web) {
            notifications.push({
              token,
              data: {
                type: 'kpi_reminder',
                pendingCount: formCount.toString(),
                mentorCount: mentorCount.toString(),
                evaluatorRole: evaluatorData.role,
                url: '/mentors'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/mentors` },
                notification: { title, body, icon: absIcon, badge: absBadge }
              }
            });
          } else {
            notifications.push({
              token,
              notification: { title, body },
              data: {
                type: 'kpi_reminder',
                pendingCount: formCount.toString(),
                mentorCount: mentorCount.toString(),
                evaluatorRole: evaluatorData.role,
                url: '/mentors'
              },
              webpush: {
                fcmOptions: { link: `${baseUrl}/mentors` },
                notification: { icon: absIcon, badge: absBadge }
              }
            });
          }
        }
      }
    }

    if (!dryRun) {
      // Send notifications in batches
      const batchSize = 500;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        if (batch.length > 0) {
          await messaging.sendEach(batch);
        }
      }

      logger.info(`Sent ${notifications.length} KPI reminder notifications for ${evaluatorsSummary.filter(e => e.skipReason === null).length} evaluators (total evaluated: ${evaluatorsSummary.length})`);
      try { await handleMissingIndex('sendWeeklyKPIReminders', null); await resolveMissingIndex('sendWeeklyKPIReminders'); } catch(e) { /* ignore */ }

      // After successful send, record dedupe entries for evaluators actually notified
      try {
        const dedupKeyForToday = `kpi_reminder_${new Date().toISOString().slice(0,10)}`;
        const evaluatorIds = Array.from(willNotifyEvaluatorIds);
        if (evaluatorIds.length) {
          await Promise.all(evaluatorIds.map(id => recordNotificationSent(id, dedupKeyForToday, { type: 'kpi_reminder' })));
        }
      } catch (e) {
        logger.warn('Failed to record KPI dedupe entries', e);
      }

      const runSummary = {
        success: true,
        notificationCount: notifications.length,
        pendingEvaluations: pendingEvaluations.length,
        evaluatorsNotified: evaluatorsSummary.filter(e => e.skipReason === null).length,
        evaluatorsSummary: evaluatorsSummary.slice(0, 500)
      };

      return runSummary;
    } else {
      // Dry-run: return summary and preview
      return {
        success: true,
        notificationCount: 0,
        pendingEvaluations: pendingEvaluations.length,
        evaluatorsPreview: evaluatorsSummary.slice(0, 200),
        pendingPreview: pendingEvaluations.slice(0, 200),
        evaluatorsCount: evaluatorsSummary.length
      };
    }

  } catch (error) {
    if (await handleMissingIndex('sendWeeklyKPIReminders', error)) {
      return { success: true, notificationCount: 0, pendingEvaluations: 0, evaluatorsNotified: 0, note: 'missing_index' };
    }
    logger.error('Error sending KPI reminders:', error);
    throw error;
  }
}

// Scheduled wrapper
exports.sendWeeklyKPIReminders = onSchedule({
  schedule: "0 14 * * 5", // Every Friday at 2 PM (IST)
  timeZone: "Asia/Kolkata",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  const result = await runWeeklyKPIReminders();
  // Log scheduled run to Firestore for audit
  try {
    await db.collection('_admin').doc('kpiRunLogs').collection('runs').add({
      initiatedBy: 'system',
      initiatedAt: new Date(),
      type: 'scheduled',
      resultSummary: {
        notificationCount: result.notificationCount || 0,
        pendingEvaluations: result.pendingEvaluations || 0,
        evaluatorsNotified: result.evaluatorsNotified || result.evaluatorsSummary?.length || 0
      },
      evaluatorsPreview: (result.evaluatorsSummary || []).slice(0, 200)
    });
  } catch (e) {
    logger.warn('Failed to write KPI scheduled run log', e);
  }
  return result;
});

// Export runner for admin invocations
exports.runWeeklyKPIReminders = runWeeklyKPIReminders;