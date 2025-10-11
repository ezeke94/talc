# Debugging Duplicate Notifications

## Issue
Users are receiving notifications twice on both iPhone and Android devices.

## Potential Causes

### 1. Same User Added Twice to Recipient List
**Check:** Does the notification function add the same user ID multiple times?
- ✅ `sendOwnerEventReminders` uses `new Set(ownerIds)` to deduplicate
- ✅ `sendQualityTeamEventReminders` iterates through unique users from Firestore

### 2. Same Device Token Listed Twice
**Check:** Is the same FCM token being added to the notification batch twice?
- ✅ All functions use `Set()` to prevent duplicate tokens
- ✅ `hasDevices` flag prevents using both legacy fcmToken and devices subcollection

### 3. Multiple Functions Sending Same Notification
**Check:** Are multiple scheduled functions triggering for the same event?
- ⚠️ `sendOwnerEventReminders` - Daily at 4 PM UTC (events **tomorrow**)
- ⚠️ `sendQualityTeamEventReminders` - Daily at 4 PM UTC (events **today**)
- These run at the SAME TIME but for different event dates (should not overlap)

### 4. Event Matches Multiple Criteria
**Check:** Does an event trigger multiple notification types?
- Possibility: Event created today might trigger `sendNotificationsOnEventCreate` 
- Plus: Same event might also be in tomorrow's reminder if created late in day

### 5. Device Token Duplicate in Firestore
**Check:** Is the same token stored multiple times in devices subcollection?
- Possible if device was registered, removed, and re-registered with same token
- Document ID is the token, so can't have true duplicates... unless tokens are different

### 6. User Has Multiple Devices with SAME Notification
**Check:** User might have 2 devices (iPhone + Android) and getting notification on both
- This is CORRECT behavior - not a bug
- BUT user says "getting every notification twice on all their registered devices"
- This means: If they have 2 devices, they're getting 4 notifications total (2 per device)

## Most Likely Cause

Based on "getting every notification twice on all their registered devices":

**Hypothesis:** The notification is being sent in TWO SEPARATE batches, and each batch sends to all devices.

This could happen if:
1. ✅ Event creation triggers `sendNotificationsOnEventCreate` immediately
2. ✅ Same event also matches tomorrow's criteria for `sendOwnerEventReminders` (if created late in day)
3. Result: 2 separate cloud functions both send notifications for the same event

OR:

1. Event matches both tomorrow and today criteria due to timezone issues
2. Both `sendOwnerEventReminders` and `sendQualityTeamEventReminders` fire for it
3. Result: 2 separate notifications sent within minutes

## Debugging Steps

### Step 1: Check Firebase Functions Logs
```bash
firebase functions:log --only sendOwnerEventReminders,sendQualityTeamEventReminders,sendNotificationsOnEventCreate
```

Look for:
- Multiple function executions for the same event ID
- Timestamps showing multiple sends within same time window
- Same token appearing multiple times in logs

### Step 2: Check Firestore User Document
Query the affected user's document:
```javascript
// In Firebase Console Firestore
users/{userId}
  fcmToken: <should be null>
  devices/
    {token1}/
      enabled: true
    {token2}/  // Should NOT have duplicate tokens
      enabled: true
```

**Check for:**
- Multiple devices with same token (shouldn't be possible)
- Legacy `fcmToken` field not null (would cause duplicates)

### Step 3: Check Event Document
```javascript
events/{eventId}
  startDateTime: <timestamp>
  createdAt: <timestamp>
  lastModifiedAt: <timestamp>
  status: "pending"
  assignees: [userId1, userId2]
  createdBy: { userId: userId1 }
```

**Check if:**
- Event was created recently (last 24 hours) - would skip some reminders
- Event date is boundary case (today vs tomorrow depending on timezone)
- User ID appears in multiple places (creator + assignee) - already handled with Set

### Step 4: Add Detailed Logging

Update notification functions to log exactly what's being sent:

```javascript
console.log(`[sendOwnerEventReminders] Processing event: ${eventDoc.id}`);
console.log(`[sendOwnerEventReminders] Sending to users:`, uniqueOwnerIds);
console.log(`[sendOwnerEventReminders] Total tokens:`, tokens.length);
console.log(`[sendOwnerEventReminders] Unique tokens:`, [...new Set(tokens)].length);
```

## Quick Fix Options

### Option 1: Change Schedules to Avoid Overlap
```javascript
// Send owner reminders at 4 PM
exports.sendOwnerEventReminders = onSchedule({
  schedule: "0 16 * * *", // 4 PM UTC
  ...
});

// Send same-day reminders at 8 AM (different time)
exports.sendQualityTeamEventReminders = onSchedule({
  schedule: "0 8 * * *", // 8 AM UTC (changed from 4 PM)
  ...
});
```

### Option 2: Add Notification Deduplication
Track sent notifications in Firestore to prevent re-sending:

```javascript
// Before sending notification
const notifKey = `${userId}-${eventId}-${type}-${date}`;
const sentRef = doc(db, 'sentNotifications', notifKey);
const alreadySent = await getDoc(sentRef);

if (alreadySent.exists()) {
  console.log(`Skipping duplicate notification: ${notifKey}`);
  continue;
}

// Send notification
await messaging.sendEach(batch);

// Mark as sent
await setDoc(sentRef, {
  sentAt: serverTimestamp(),
  userId,
  eventId,
  type
}, { merge: true });
```

### Option 3: Consolidate Similar Functions
Merge `sendOwnerEventReminders` and `sendQualityTeamEventReminders` into one function:

```javascript
exports.sendEventReminders = onSchedule({
  schedule: "0 16 * * *",
  ...
}, async () => {
  // Send tomorrow reminders to owners
  await sendTomorrowReminders();
  
  // Send today reminders to all users
  await sendTodayReminders();
});
```

## Recommended Action

1. **Immediate:** Check Firebase Functions logs to confirm which functions are running
2. **Quick Fix:** Change `sendQualityTeamEventReminders` schedule to `0 8 * * *` (8 AM instead of 4 PM)
3. **Long-term:** Implement notification deduplication system
4. **Monitor:** Add detailed logging to track notification sends

## Testing

After applying fix:
1. Create test event for tomorrow
2. Wait for 4 PM UTC (sendOwnerEventReminders)
3. Verify user receives only ONE notification
4. Wait until event date (8 AM UTC for sendQualityTeamEventReminders)
5. Verify user receives only ONE notification (different from step 3)
6. Total notifications: 2 (one day before + same day) ✅
7. NOT: 4 notifications (2x day before + 2x same day) ❌
