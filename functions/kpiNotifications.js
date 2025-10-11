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

// Weekly KPI assessment reminders (Fridays at 2 PM)
exports.sendWeeklyKPIReminders = onSchedule({
  schedule: "0 14 * * 5", // Every Friday at 2 PM UTC
  timeZone: "UTC",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
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

    // Get ALL users (role-based filtering removed)
    const usersSnapshot = await db.collection('users').get();

    const notifications = [];
    const evaluatorTokens = new Map();

    // Cache ALL user FCM tokens (with multi-device support)
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const tokens = await getAllUserTokens(userDoc.id);
      
      if (tokens.length > 0) {
        evaluatorTokens.set(userDoc.id, {
          tokens: tokens,
          centers: userData.assignedCenters || [],
          name: userData.name || userData.email,
          role: userData.role || 'User'
        });
      }
    }

    // Check for mentors without recent KPI submissions
    const pendingEvaluations = [];
    
    for (const mentor of mentors) {
      const mentorCenters = Array.isArray(mentor.assignedCenters) 
        ? mentor.assignedCenters 
        : (mentor.center ? [mentor.center] : []);

      // Check if mentor has recent submissions for each assigned form
      const assignedFormIds = mentor.assignedFormIds || [];
      
      for (const formId of assignedFormIds) {
        // Try to find the form to get its name
        const formDoc = await db.collection('kpiForms').doc(formId).get();
        const formName = formDoc.exists ? formDoc.data().name : formId;
        
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

      // First, try to use assigned evaluator
      if (pending.assignedEvaluator?.id) {
        // Get assigned evaluator's FCM token
        const evaluatorDoc = await db.collection('users').doc(pending.assignedEvaluator.id).get();
        const evaluatorData = evaluatorDoc.data();
        const tokens = await getAllUserTokens(pending.assignedEvaluator.id);
        
        if (tokens.length > 0) {
          targetEvaluatorId = pending.assignedEvaluator.id;
          
          // Add to evaluator tokens if not already cached
          if (!evaluatorTokens.has(targetEvaluatorId)) {
            evaluatorTokens.set(targetEvaluatorId, {
              tokens: tokens, // Changed to array of tokens
              centers: evaluatorData.assignedCenters || [],
              name: evaluatorData.name || evaluatorData.email,
              role: evaluatorData.role
            });
          }
        }
      }

      // Fallback: find appropriate admin/quality member
      if (!targetEvaluatorId) {
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

    // Send consolidated notifications
    for (const [evaluatorId, pendingList] of notificationsByEvaluator) {
      const evaluatorData = evaluatorTokens.get(evaluatorId);
      if (!evaluatorData) continue;

      const mentorCount = new Set(pendingList.map(p => p.mentorId)).size;
      const formCount = pendingList.length;
      
      // Send to all devices for this evaluator
      for (const token of evaluatorData.tokens) {
        notifications.push({
          token: token,
          notification: {
            title: `KPI Assessments Pending`,
            body: `${mentorCount} mentor(s) need evaluation (${formCount} forms)`,
          },
          data: {
            type: 'kpi_reminder',
            pendingCount: formCount.toString(),
            mentorCount: mentorCount.toString(),
            evaluatorRole: evaluatorData.role,
            url: '/mentors'
          },
          webpush: {
            fcmOptions: {
              link: `${process.env.FRONTEND_URL || 'https://your-app-domain.com'}/mentors`
            },
            notification: {
              icon: '/favicon.ico'
            }
          }
        });
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

    console.log(`Sent ${notifications.length} KPI reminder notifications for ${pendingEvaluations.length} pending evaluations`);
    return { 
      success: true, 
      notificationCount: notifications.length,
      pendingEvaluations: pendingEvaluations.length,
      evaluatorsNotified: notificationsByEvaluator.size
    };

  } catch (error) {
    console.error('Error sending KPI reminders:', error);
    throw error;
  }
});