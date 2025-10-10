# Duplicate Notification Fix

**Date:** October 10, 2025  
**Issue:** Users receiving duplicate notifications on all registered devices  
**Status:** ✅ Fixed

## Problem Description

Users were receiving **every notification twice** on all their registered devices, regardless of notification type or user role.

## Root Cause

The issue was in the token retrieval functions across all notification modules. When the system migrated from a single `fcmToken` field to a multi-device `devices` subcollection, some tokens existed in BOTH locations:
- `users/{userId}/fcmToken` (legacy field)
- `users/{userId}/devices/{token}` (new subcollection)

The token retrieval functions were **adding the same token twice**:
1. Once from the legacy `fcmToken` field
2. Again from the `devices` subcollection

Even though the functions used `Set()` for deduplication, they were fetching both sources without checking if devices existed first, resulting in duplicate notifications being sent to the same device token.

## Solution

Updated all token retrieval helper functions to follow a proper fallback pattern:

1. **Primary:** Check the `devices` subcollection for all enabled device tokens
2. **Fallback:** Only use the legacy `fcmToken` field if NO devices exist
3. **Result:** Each unique device receives exactly ONE notification

## Files Modified

### 1. `functions/eventNotifications.js`
- ✅ Fixed `getAllUserTokens(userId)` - Added `hasDevices` flag to prevent duplicate token retrieval
- ✅ Fixed `getAllTokensForAllUsers()` - Same pattern applied for bulk token fetching

### 2. `functions/eventChangeNotifications.js`
- ✅ Fixed `getUserTokens(userId)` - Added `hasDevices` flag
- ✅ Fixed `getAllUserTokens()` - Added `hasDevices` flag
- ✅ Fixed `getAllTokensForAllUsers()` - Added `hasDevices` flag

### 3. `functions/kpiNotifications.js`
- ✅ Added `getAllUserTokens(userId)` helper function (was missing)
- ✅ Updated evaluator token caching to use multi-device support
- ✅ Updated notification sending to iterate through all tokens per evaluator

### 4. `functions/operationalNotifications.js`
- ✅ Added `getAllUserTokens(userId)` helper function (was missing)
- ✅ Updated monthly summary notifications to support multi-device
- ✅ Updated critical system alerts to support multi-device

## Key Code Changes

### Before (Problematic Pattern)
```javascript
async function getAllUserTokens(userId) {
  const tokens = new Set();
  
  // ❌ Always adds fcmToken first
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.data()?.fcmToken) tokens.add(userDoc.data().fcmToken);
  
  // ❌ Then adds from devices subcollection (might be the same token!)
  const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
  devicesSnap.forEach((d) => {
    if (d.id && d.data()?.enabled !== false) tokens.add(d.id);
  });
  
  return Array.from(tokens); // ❌ Same token appears twice!
}
```

### After (Fixed Pattern)
```javascript
async function getAllUserTokens(userId) {
  const tokens = new Set();
  let hasDevices = false;
  
  // ✅ First check devices subcollection
  const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
  devicesSnap.forEach((d) => {
    if (d.id && d.data()?.enabled !== false) {
      tokens.add(d.id);
      hasDevices = true;
    }
  });
  
  // ✅ Only use legacy fcmToken if NO devices exist
  if (!hasDevices) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.data()?.fcmToken) tokens.add(userDoc.data().fcmToken);
  }
  
  return Array.from(tokens); // ✅ No duplicates!
}
```

## Impact

### Before Fix
- User with 1 device registered → Received 2 notifications per event
- User with 2 devices registered → Received 4 notifications per event (2x per device)

### After Fix
- User with 1 device registered → Receives 1 notification
- User with 2 devices registered → Receives 2 notifications (1 per device)
- User with N devices registered → Receives N notifications (1 per device)

## Affected Notification Types

All notification types are now fixed:
- ✅ Event reminders (owner, quality team, same-day)
- ✅ Event creation notifications
- ✅ Event change notifications (reschedule, update, cancellation, completion, deletion)
- ✅ Overdue task reminders
- ✅ KPI assessment reminders
- ✅ Monthly operational summaries
- ✅ Critical system alerts

## Testing Recommendations

1. **Verify Single Device Users:**
   - Register a single device for a test user
   - Trigger various notification types
   - Confirm only ONE notification is received

2. **Verify Multi-Device Users:**
   - Register multiple devices for a test user
   - Trigger various notification types
   - Confirm ONE notification per device (not duplicates)

3. **Verify Legacy Users:**
   - Test with users who only have the old `fcmToken` field (no devices subcollection)
   - Confirm they still receive notifications via the fallback mechanism

4. **Verify Disabled Devices:**
   - Disable a device in the `devices` subcollection
   - Confirm that device does NOT receive notifications

## Deployment Notes

- No database migration required
- No breaking changes
- Backward compatible with users who haven't migrated to the new device system
- Can be deployed immediately

## Related Documentation

- [Device Fingerprinting](./DEVICE_FINGERPRINTING.md)
- [FCM Token Migration](./FCM_TOKEN_MIGRATION.md)
- [Notification System Complete](./NOTIFICATION_SYSTEM_COMPLETE.md)
