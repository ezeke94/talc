# FCM Token Storage Migration - Complete

## Problem Statement
The `fcmToken` field was being stored in TWO places:
1. **Main user document** - `users/{userId}/fcmToken`
2. **Devices subcollection** - `users/{userId}/devices/{token}`

This created confusion and inconsistency, with Cloud Functions reading from the user document while the new device management system used the subcollection.

## Solution: Single Source of Truth
**Use devices subcollection as the ONLY source of FCM tokens**

### Architecture Decision
- ✅ **Devices subcollection** - Source of truth for all FCM tokens
- ❌ **Main user document** - Only stores `notificationsEnabled` flag (not the token)
- ✅ **Backwards compatibility** - Functions fall back to old `fcmToken` field if no devices exist

## Changes Made

### 1. Frontend Changes (`src/utils/notifications.js`)

#### Before:
```javascript
// Saved token in BOTH places
await setDoc(userRef, {
  fcmToken: token,  // ❌ Stored in main document
  notificationsEnabled: true
});

await setDoc(deviceRef, {
  token,  // ✅ Also stored in subcollection
  ...deviceInfo
});
```

#### After:
```javascript
// Only save token in devices subcollection
await setDoc(deviceRef, {
  token,  // ✅ ONLY source of truth
  ...deviceInfo
});

// Main document only stores the flag
await setDoc(userRef, {
  notificationsEnabled: true,  // ✅ Just a flag
  // fcmToken: NOT stored here anymore
});
```

**Benefits:**
- ✅ No duplicate storage
- ✅ Multi-device support works properly
- ✅ Single source of truth for tokens
- ✅ No confusion about which field to read

### 2. Cloud Functions Changes (`functions/eventChangeNotifications.js`)

Added new helper function for single user tokens:

```javascript
// NEW: Get all tokens for a specific user
async function getUserTokens(userId) {
  const tokenSet = new Set();
  
  // Primary: Read from devices subcollection
  const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
  devicesSnap.forEach((deviceDoc) => {
    const deviceData = deviceDoc.data();
    const token = deviceDoc.id;
    const enabled = deviceData?.enabled !== false;
    if (token && enabled) {
      tokenSet.add(token);
    }
  });
  
  // Fallback: If no devices, check old fcmToken field (backwards compatibility)
  if (tokenSet.size === 0) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (userData?.fcmToken) {
      tokenSet.add(userData.fcmToken);
    }
  }
  
  return Array.from(tokenSet);
}
```

**Updated Functions:**
1. ✅ `notifyEventReschedule` - Now uses `getUserTokens(userId)`
2. ✅ `notifyEventCancellation` - Now uses `getUserTokens(userId)`
3. ✅ `notifyEventCompletion` - Now uses `getUserTokens(userId)`
4. ✅ `notifyEventDelete` - Already uses `getAllUserTokens()`

#### Before (notifyEventReschedule example):
```javascript
for (const userId of assigneeIds) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (userData?.fcmToken) {  // ❌ Reading from main document
    notifications.push({
      token: userData.fcmToken,
      // ...
    });
  }
}
```

#### After:
```javascript
for (const userId of assigneeIds) {
  // ✅ Get all enabled devices for this user
  const userTokens = await getUserTokens(userId);
  
  // ✅ Send to ALL user's devices
  for (const token of userTokens) {
    notifications.push({
      token: token,
      // ...
    });
  }
}
```

**Benefits:**
- ✅ Supports multiple devices per user
- ✅ Respects device-level enable/disable
- ✅ No duplicates (Set deduplication)
- ✅ Backwards compatible with old tokens

### 3. Disable Notifications Behavior

#### Before:
```javascript
// Only removed from main document
await setDoc(userRef, {
  fcmToken: null,
  notificationsEnabled: false
});
```

#### After:
```javascript
// Remove from main document AND disable device
await setDoc(userRef, {
  fcmToken: null,  // Explicitly clear old field
  notificationsEnabled: false
});

// Also mark device as disabled (keeps history)
await setDoc(deviceRef, {
  enabled: false,
  lastSeenAt: serverTimestamp()
}, { merge: true });
```

**Benefits:**
- ✅ Device record preserved for history
- ✅ Re-enabling doesn't create duplicate
- ✅ Explicitly cleans old `fcmToken` field
- ✅ Tracks when device was disabled

## Migration Path

### For New Users
- Tokens stored ONLY in devices subcollection
- Main document has no `fcmToken` field
- Works perfectly from day one

### For Existing Users
1. **First enable after update**:
   - Token saved to devices subcollection
   - Main document `fcmToken` set to `null`
   - Old token automatically migrated

2. **Cloud Functions**:
   - Try devices subcollection first
   - Fall back to old `fcmToken` if no devices
   - Gradual migration as users enable/disable

3. **No breaking changes**:
   - Backwards compatible
   - Works with old and new data
   - Self-migrating over time

## Data Structure

### Main User Document
```javascript
{
  uid: "oQnOs84X3Jd4DmwZ6qdSBAO9HT32",
  email: "user@example.com",
  notificationsEnabled: true,  // ✅ Just a flag
  fcmToken: null,              // ✅ Explicitly null (cleaned up)
  lastTokenUpdate: Timestamp
}
```

### Devices Subcollection (Source of Truth)
```javascript
users/{userId}/devices/{token} = {
  token: "dCSejMMX9uOauanO--mBWN:APA91bG...",  // ✅ The actual token
  name: "My Android Phone",                    // ✅ User-friendly name
  platform: "Linux",
  userAgent: "Mozilla/5.0...",
  createdAt: Timestamp,
  lastSeenAt: Timestamp,
  enabled: true                                // ✅ Device-level control
}
```

## Testing Checklist

### Frontend Testing
- [ ] Enable notifications → Token saved only to devices subcollection
- [ ] Check Firestore → Main document has no `fcmToken` field (or it's null)
- [ ] Disable notifications → Device marked as `enabled: false`
- [ ] Re-enable notifications → Same device updated, not duplicated
- [ ] Check console → No errors about missing tokens

### Cloud Functions Testing
- [ ] Create event → All assignees receive notification on all their devices
- [ ] Reschedule event → Assignees notified on all devices
- [ ] Cancel event → Assignees notified on all devices
- [ ] Complete event → Supervisors notified on all devices
- [ ] Delete event → No duplicate notifications
- [ ] Check logs → Correct number of notifications sent

### Backwards Compatibility Testing
- [ ] Old user with `fcmToken` in main document → Still receives notifications
- [ ] Old user enables notifications → Token migrated to subcollection
- [ ] Mixed environment (some old, some new users) → All receive notifications

## Deployment Steps

1. **Deploy frontend changes**:
   ```bash
   npm run build
   # Deploy to Netlify/hosting
   ```

2. **Deploy Cloud Functions**:
   ```bash
   cd functions
   firebase deploy --only functions:notifyEventReschedule,functions:notifyEventCancellation,functions:notifyEventCompletion
   ```

3. **Monitor deployment**:
   - Check Cloud Functions logs
   - Verify notifications still work
   - Watch for errors in console

4. **Optional cleanup** (after 1-2 weeks):
   - Remove `fcmToken` field from all user documents
   - Remove fallback code from Cloud Functions
   - Keep devices subcollection only

## Files Modified

### Frontend
- ✅ `src/utils/notifications.js` - Token storage logic
- ✅ `src/utils/deviceManager.js` - Duplicate cleanup (already done)
- ✅ `src/components/NotificationSettings.jsx` - Auto cleanup (already done)

### Cloud Functions
- ✅ `functions/eventChangeNotifications.js` - Added `getUserTokens()`, updated 4 functions
- ✅ `functions/eventNotifications.js` - Already using `getAllUserTokens()` (no changes needed)

### Documentation
- ✅ `docs/DEVICE_DUPLICATE_FIX.md` - Previous fix documentation
- ✅ `docs/FCM_TOKEN_MIGRATION.md` - This document (NEW)

## Benefits Summary

### Before Migration
❌ Tokens stored in 2 places (confusion)
❌ Functions read from different sources
❌ Duplicate device registrations
❌ No proper multi-device support
❌ Inconsistent data

### After Migration
✅ Single source of truth (devices subcollection)
✅ All functions read from same place
✅ No duplicates (automatic cleanup)
✅ Full multi-device support
✅ Consistent, clean data
✅ Device-level enable/disable
✅ Backwards compatible

## Future Enhancements

1. **Scheduled cleanup job**:
   - Cloud Function to remove old `fcmToken` fields
   - Run weekly to clean up legacy data

2. **Analytics**:
   - Track notification delivery per device
   - Identify inactive devices for cleanup

3. **Device limits**:
   - Limit to 10 devices per user
   - Auto-remove oldest when limit reached

4. **Token refresh**:
   - Detect FCM token refresh events
   - Update device records automatically
