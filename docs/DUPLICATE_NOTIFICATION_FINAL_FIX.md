# Duplicate Notification Fix - Final Solution

## Problem
Users are receiving duplicate notifications for ALL events on a single registered device. The issue persists even after:
- Removing legacy `fcmToken` field from Firestore
- Checking for duplicate devices
- Implementing `hasDevices` flag to prevent reading from both sources

## Root Cause Analysis

The duplicate notifications are likely caused by ONE of these scenarios:

### Scenario 1: Document Written Twice (Most Likely)
When saving an event, the Firestore document might be updated twice in quick succession:
1. First update triggers Cloud Function → Sends notification
2. Second update (e.g., adding audit log or timestamp) triggers same Cloud Function again → Sends second notification

**Evidence:**
- User reports duplicates on "both calendar page and user management page"
- This likely means notifications appear in both locations in the UI, not that these pages send notifications

### Scenario 2: Multiple Cloud Functions Triggering
Even though we have conditional logic, if an event update matches multiple criteria, multiple functions might send notifications.

### Scenario 3: Firestore Rules Issue
Since we updated Firestore rules to allow admins to read devices, there might be a permission issue causing retries.

## Solution

We need to implement **notification deduplication** to prevent the same notification from being sent twice within a short time window.

### Implementation Strategy

Add a tracking mechanism to record sent notifications and skip duplicates:

```javascript
/**
 * Check if notification was already sent recently (within last 60 seconds)
 * @param {string} userId - User ID
 * @param {string} eventId - Event ID  
 * @param {string} notificationType - Type of notification (e.g., 'event_create', 'event_update')
 * @returns {boolean} - True if already sent recently
 */
async function wasNotificationRecentlySent(userId, eventId, notificationType) {
  const notificationKey = `${userId}-${eventId}-${notificationType}`;
  const sentRef = db.collection('_notificationLog').doc(notificationKey);
  
  try {
    const doc = await sentRef.get();
    if (doc.exists) {
      const sentAt = doc.data().sentAt.toDate();
      const now = new Date();
      const diffSeconds = (now - sentAt) / 1000;
      
      // If sent within last 60 seconds, consider it a duplicate
      if (diffSeconds < 60) {
        console.log(`Skipping duplicate notification: ${notificationKey} (sent ${diffSeconds}s ago)`);
        return true;
      }
    }
    
    // Record this notification
    await sentRef.set({
      userId,
      eventId,
      notificationType,
      sentAt: new Date()
    }, { merge: true });
    
    return false;
  } catch (error) {
    console.error('Error checking notification log:', error);
    // On error, allow notification to be sent (fail open)
    return false;
  }
}
```

### Apply to All Notification Functions

Update each notification function to check for duplicates before sending:

```javascript
// Example: In sendNotificationsOnEventCreate
exports.sendNotificationsOnEventCreate = onDocumentCreated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  try {
    const eventData = event.data.data();
    const eventId = event.params.eventId;
    
    const notifications = [];
    const recipientsMeta = [];
    
    // Get all users
    const allUsersSnapshot = await db.collection('users').get();
    
    for (const userDoc of allUsersSnapshot.docs) {
      const userId = userDoc.id;
      
      // ✅ CHECK FOR DUPLICATE BEFORE PROCESSING
      if (await wasNotificationRecentlySent(userId, eventId, 'event_create')) {
        continue; // Skip this user - already notified recently
      }
      
      const tokens = await getAllUserTokens(userId);
      for (const token of tokens) {
        notifications.push({
          // ... notification payload
        });
        recipientsMeta.push({ userId, token });
      }
    }
    
    // Send notifications...
  }
});
```

### Firestore Structure for Notification Log

```
_notificationLog/
  {userId}-{eventId}-{type}/
    userId: "user123"
    eventId: "event456"
    notificationType: "event_create"
    sentAt: Timestamp
```

### Firestore Rules for Notification Log

Add to `firestore.rules`:

```javascript
match /_notificationLog/{logId} {
  allow read, write: if false; // Only Cloud Functions can access
}
```

## Alternative Solution: Client-Side Deduplication

If we don't want to use Firestore for logging, we can use in-memory caching in the service worker:

```javascript
// In firebase-messaging-sw.js
const sentNotifications = new Map();

self.addEventListener('push', function(event) {
  const payload = event.data.json();
  const notificationKey = `${payload.data.eventId}-${payload.data.type}`;
  
  const now = Date.now();
  const lastSent = sentNotifications.get(notificationKey);
  
  // If same notification was shown in last 60 seconds, skip
  if (lastSent && (now - lastSent) < 60000) {
    console.log('Skipping duplicate notification:', notificationKey);
    return;
  }
  
  // Record this notification
  sentNotifications.set(notificationKey, now);
  
  // Clean up old entries (older than 5 minutes)
  for (const [key, timestamp] of sentNotifications.entries()) {
    if (now - timestamp > 300000) {
      sentNotifications.delete(key);
    }
  }
  
  // Show notification
  event.waitUntil(
    self.registration.showNotification(payload.notification.title, {
      body: payload.notification.body,
      // ... other options
    })
  );
});
```

## Immediate Fix (Recommended)

Since implementing deduplication requires significant changes, let's first add detailed logging to identify exactly what's happening:

### Step 1: Add Logging to Cloud Functions

Add these console.log statements to track executions:

```javascript
exports.sendNotificationsOnEventCreate = onDocumentCreated({
  document: "events/{eventId}",
  region: "us-central1",
  memory: "256MiB",
}, async (event) => {
  const eventId = event.params.eventId;
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] sendNotificationsOnEventCreate triggered for event: ${eventId}`);
  
  try {
    // ... existing code
    
    console.log(`[${timestamp}] Sending ${notifications.length} notifications for event: ${eventId}`);
    
    // Send notifications
    const results = await messaging.sendEach(notifications);
    
    console.log(`[${timestamp}] Sent ${results.successCount}/${notifications.length} notifications for event: ${eventId}`);
  } catch (error) {
    console.error(`[${timestamp}] Error in sendNotificationsOnEventCreate for event ${eventId}:`, error);
  }
});
```

### Step 2: Check Firebase Logs

```bash
firebase functions:log --only sendNotificationsOnEventCreate,notifyEventUpdate,notifyEventDelete
```

Look for:
- Multiple executions with same eventId within seconds
- Same timestamp appearing twice
- Pattern of duplicate sends

### Step 3: Check Firestore Writes

Add audit logging to Calendar.jsx to see if document is written twice:

```javascript
const handleSaveEvent = async (eventData) => {
  console.log('[Calendar] Saving event:', eventData.id || 'new', new Date().toISOString());
  
  try {
    if (editingEvent) {
      console.log('[Calendar] Updating existing event:', editingEvent.id);
      await updateDoc(eventRef, eventData);
      console.log('[Calendar] Update complete:', editingEvent.id);
    } else {
      console.log('[Calendar] Creating new event');
      const docRef = await addDoc(collection(db, 'events'), eventData);
      console.log('[Calendar] Create complete:', docRef.id);
    }
  } catch (error) {
    console.error('[Calendar] Save failed:', error);
  }
};
```

## Expected Outcome

After adding logging, we should see:
- How many times each function executes for a single event
- Whether the document is being written multiple times  
- Exact timing of duplicate sends

Then we can implement the appropriate fix based on the root cause.

## Files to Modify

1. **functions/eventNotifications.js** - Add deduplication or logging
2. **functions/eventChangeNotifications.js** - Add deduplication or logging
3. **functions/kpiNotifications.js** - Add deduplication or logging
4. **functions/operationalNotifications.js** - Add deduplication or logging
5. **firestore.rules** - Add rules for `_notificationLog` collection
6. **public/firebase-messaging-sw.js** - Add client-side deduplication (alternative)

## Testing Plan

1. Create a new event
2. Watch browser console for logs
3. Check Firebase Functions logs
4. Count how many notifications received
5. Verify only ONE notification per event per user

## Deployment

```bash
# Deploy functions with logging
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:sendNotificationsOnEventCreate,functions:notifyEventUpdate

# Deploy Firestore rules (if using server-side deduplication)
firebase deploy --only firestore:rules
```
