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

// Heuristic: detect Web FCM tokens (long, includes colon). Adjust if storing platform separately.
function isWebToken(token) {
  return typeof token === 'string' && token.length > 150 && token.includes(':');
}

// Absolute asset URLs for WebPush icons/badges
const baseUrl = (process.env.FRONTEND_URL || 'https://kpitalc.netlify.app').replace(/\/$/, '');
const absIcon = `${baseUrl}/favicon.ico`;
const absBadge = `${baseUrl}/favicon.ico`;

// Firestore-based deduplication: READ-ONLY check
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
        return false;
      } else {
        return true;
      }
    }
    // Do not write here; recording happens after successful sends
    return false;
  } catch (e) {
    logger.error('wasNotificationRecentlySent error', e);
    return false; // fail open
  }
}

// Record that a notification was actually sent (for operational notifications)
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


// REMOVED: Monthly operational summary (deleted per request)


// REMOVED: Critical system alerts (deleted per request)
