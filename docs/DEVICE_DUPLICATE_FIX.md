# Device Duplicate Fix - Summary

## Problem
The devices subcollection was saving duplicate entries for the same device when users:
- Toggled notifications on/off multiple times
- The FCM token refreshed or changed
- Multiple instances of the app were running

This resulted in the same device token being stored multiple times in Firestore.

## Root Causes
1. **No duplicate check**: When enabling notifications, the code always used `{ merge: true }` but didn't check if the device already existed to preserve `createdAt`
2. **No proper disable handling**: When disabling notifications, the device entry wasn't marked as `enabled: false`, causing a fresh entry on re-enable
3. **No cleanup mechanism**: Existing duplicates accumulated over time

## Changes Made

### 1. **notifications.js** - Improved device registration
```javascript
// Before: Always merged/created device
await setDoc(deviceRef, {...}, { merge: true });

// After: Check if exists first, preserve createdAt
const existingDevice = await getDoc(deviceRef);
if (existingDevice.exists()) {
  // Update existing (re-enabling)
  await setDoc(deviceRef, {...}, { merge: true });
} else {
  // Create new
  await setDoc(deviceRef, {...});
}
```

**Changes:**
- Added `getDoc` to check for existing device before creating
- Preserves `createdAt` timestamp when re-enabling
- Only sets `createdAt` for genuinely new devices
- Updates `lastSeenAt` on every enable/re-enable

### 2. **notifications.js** - Proper disable handling
```javascript
// Before: Just removed from localStorage and main user doc
localStorage.removeItem('fcmToken');

// After: Also disable in devices subcollection
const deviceRef = doc(db, 'users', currentUser.uid, 'devices', currentToken);
await setDoc(deviceRef, {
  enabled: false,
  lastSeenAt: serverTimestamp()
}, { merge: true });
```

**Changes:**
- Stores current token before removing from localStorage
- Marks device as `enabled: false` in subcollection
- Keeps device record for history/re-enabling
- Updates `lastSeenAt` to track when disabled

### 3. **deviceManager.js** - Duplicate cleanup utility
Added new `cleanupDuplicateDevices()` function:
- Fetches all devices for a user
- Groups by token to find duplicates
- Sorts by `lastSeenAt` (most recent first)
- Keeps most recent, deletes older duplicates
- Returns count of removed duplicates

### 4. **NotificationSettings.jsx** - Automatic cleanup
```javascript
const loadDevices = async () => {
  // Clean up duplicates first
  const duplicatesRemoved = await cleanupDuplicateDevices(currentUser.uid);
  
  // Then load clean device list
  const userDevices = await getUserDevices(currentUser.uid);
  setDevices(userDevices);
};
```

**Changes:**
- Automatically cleans duplicates when loading device list
- Logs cleanup results to console
- Ensures UI always shows clean data

### 5. **cleanup-duplicate-devices.html** - Admin cleanup tool
Created standalone admin page to cleanup existing duplicates:
- Processes all users in the system
- Removes duplicates based on token + lastSeenAt
- Shows detailed progress logs
- Safe to run multiple times

## How It Works Now

### Enabling Notifications (First Time)
1. User enables notifications
2. FCM token obtained
3. Check if device exists → **No**
4. Create new device with `createdAt` and `enabled: true`
5. Store in subcollection

### Disabling Notifications
1. User disables notifications
2. Get current token from localStorage
3. Set `enabled: false` on device document
4. Remove from localStorage
5. Update main user document

### Re-enabling Notifications
1. User enables notifications again
2. FCM token obtained (may be same or new)
3. Check if device exists → **Yes**
4. Update existing device with `enabled: true`
5. Preserve original `createdAt`
6. Update `lastSeenAt`

### Loading Devices
1. Component mounts or user refreshes
2. Run `cleanupDuplicateDevices()` first
3. Load clean device list
4. Display in UI

## Benefits

✅ **No More Duplicates**: Existing devices are updated, not duplicated
✅ **Preserved History**: `createdAt` shows when device was first registered
✅ **Better Tracking**: `lastSeenAt` shows recent activity
✅ **Automatic Cleanup**: Duplicates cleaned on every device list load
✅ **Enable/Disable Toggle**: Devices can be disabled without losing history
✅ **Multi-device Support**: Each unique token tracked separately

## Testing Steps

1. **Test Enable/Disable**:
   - Enable notifications → Check 1 device in Firestore
   - Disable notifications → Device should have `enabled: false`
   - Re-enable notifications → Same device, `enabled: true`
   - Verify no duplicate created

2. **Test Cleanup**:
   - Open Profile Settings → Registered Devices
   - Check console for cleanup logs
   - Verify only unique devices shown

3. **Test Admin Cleanup** (one-time):
   - Navigate to `/cleanup-duplicate-devices.html`
   - Click "Start Cleanup"
   - Review logs for duplicates removed
   - Check Firestore to confirm clean data

## Running the Cleanup

### For Current User (Automatic)
Just open the Profile Settings dialog - cleanup runs automatically.

### For All Users (Admin Tool)
1. Navigate to: `http://localhost:5173/cleanup-duplicate-devices.html` (dev) or `https://your-domain.com/cleanup-duplicate-devices.html` (prod)
2. Sign in with admin account
3. Click "Start Cleanup"
4. Wait for completion
5. Review logs

## Files Modified

1. `src/utils/notifications.js` - Device registration and disable logic
2. `src/utils/deviceManager.js` - Added cleanup utility
3. `src/components/NotificationSettings.jsx` - Auto-cleanup on load
4. `public/cleanup-duplicate-devices.html` - Admin cleanup tool (NEW)

## Migration Notes

- Existing duplicates will be automatically cleaned when users open Profile Settings
- Admin can manually run cleanup for all users using the HTML tool
- No database migration needed - cleanup happens on-demand
- Safe to deploy immediately

## Future Improvements

- Add scheduled Cloud Function to cleanup duplicates periodically
- Add device usage analytics (track notification delivery success)
- Add device nickname editing from UI
- Add "last notification received" timestamp
