# Cleanup Duplicate Devices Tool - User Guide

## What This Tool Does

The cleanup tool (`/cleanup-duplicate-devices.html`) performs two important maintenance tasks:

### 1. **Duplicate Device Cleanup**
- Scans all users in the system
- Finds duplicate device registrations (same FCM token)
- Keeps the most recently used device
- Removes older duplicates
- Safe to run multiple times

### 2. **Old fcmToken Field Cleanup**
- Removes the deprecated `fcmToken` field from user documents
- Only the `devices` subcollection should store tokens
- This is a one-time migration cleanup
- Non-destructive (devices subcollection remains intact)

## How to Use

### Access the Tool

1. **Navigate to the cleanup page**:
   ```
   http://localhost:5173/cleanup-duplicate-devices.html (development)
   https://your-domain.com/cleanup-duplicate-devices.html (production)
   ```

2. **Sign in**:
   - If not signed in, you'll be redirected to the login page
   - Sign in with an admin account
   - Return to the cleanup page

3. **Run Cleanup**:
   - Click **"Start Duplicate Cleanup"** to remove duplicate devices
   - Click **"Clean Old fcmToken Fields"** to remove deprecated token fields
   - Watch the progress in the log area

### Step-by-Step Process

#### Duplicate Device Cleanup

1. Click "Start Duplicate Cleanup"
2. Tool will:
   - Fetch all users
   - For each user, get their devices
   - Group devices by token
   - Sort by `lastSeenAt` (most recent first)
   - Keep the most recent, delete others
3. Review the log output
4. See summary: "Removed X duplicate devices from Y users"

#### Old Token Field Cleanup

1. Click "Clean Old fcmToken Fields"
2. Confirm the action
3. Tool will:
   - Fetch all users
   - Check if user has `fcmToken` field
   - Remove the field from user document
   - Keep devices subcollection intact
4. Review the log output
5. See summary: "Removed fcmToken field from X/Y users"

## When to Run

### Duplicate Device Cleanup
Run this when:
- ✅ After initial deployment
- ✅ Users report seeing duplicate notifications
- ✅ After migration from old notification system
- ✅ Periodically (monthly maintenance)

### Old Token Field Cleanup
Run this when:
- ✅ After deploying the new token storage system
- ✅ One-time migration (doesn't need to be repeated)
- ✅ To clean up legacy data

## Safety Features

### Built-in Safeguards

1. **Authentication Required**:
   - Must be signed in to use
   - Redirects to login if not authenticated

2. **Non-Destructive**:
   - Duplicate cleanup keeps most recent device
   - Token cleanup only removes deprecated field
   - Devices subcollection always preserved

3. **Detailed Logging**:
   - Every action logged to screen
   - Success/failure clearly marked
   - Easy to review what happened

4. **Confirmation Prompts**:
   - Token field cleanup requires confirmation
   - Prevents accidental execution

5. **Error Handling**:
   - Continues processing if one user fails
   - Reports errors but doesn't stop
   - Shows retry button on failure

## Expected Results

### Before Cleanup

**User Document**:
```javascript
{
  fcmToken: "dCSejMMX9uOauanO--mBWN:APA91bG...",
  notificationsEnabled: true
}
```

**Devices Subcollection**:
```javascript
devices/
  ├── dCSejMMX9uOauanO--mBWN:APA91bG... (lastSeenAt: Oct 10)
  ├── dCSejMMX9uOauanO--mBWN:APA91bG... (lastSeenAt: Oct 5) ❌ Duplicate
  └── dCSejMMX9uOauanO--mBWN:APA91bG... (lastSeenAt: Oct 1) ❌ Duplicate
```

### After Duplicate Cleanup

**Devices Subcollection**:
```javascript
devices/
  └── dCSejMMX9uOauanO--mBWN:APA91bG... (lastSeenAt: Oct 10) ✅ Only most recent
```

### After Token Field Cleanup

**User Document**:
```javascript
{
  // fcmToken removed ✅
  notificationsEnabled: true
}
```

## Troubleshooting

### "Please sign in first"
- **Cause**: Not authenticated
- **Solution**: Click the message to redirect, sign in, and return

### "Error: Missing or insufficient permissions"
- **Cause**: User doesn't have Firestore read/write access
- **Solution**: Check Firestore security rules, ensure user is admin

### "Failed to remove device"
- **Cause**: Network error or race condition
- **Solution**: Safe to ignore if only a few errors, retry if many

### Tool page is blank
- **Cause**: Firebase config not loading
- **Solution**: Check browser console for errors, verify firebase-config.js exists

### No duplicates found
- **Cause**: System is already clean
- **Solution**: This is good! No action needed

## Verification

### How to Verify Cleanup Worked

1. **Check Firestore Console**:
   - Navigate to `users/{userId}/devices`
   - Verify each token appears only once
   - Check `lastSeenAt` on remaining devices

2. **Check User Documents**:
   - Navigate to `users/{userId}`
   - Verify `fcmToken` field is absent or null
   - Verify `notificationsEnabled` still exists

3. **Test Notifications**:
   - Send a test notification
   - Should receive only ONE notification per device
   - All enabled devices should receive it

## Logs Example

```
[10:15:30] Starting duplicate device cleanup...
[10:15:31] Found 50 users to process
[10:15:32] Processing user 1/50: oQnOs84X3Jd4DmwZ6qdSBAO9HT32
[10:15:32]   Found 5 devices
[10:15:32]   Found 3 duplicates for token: dCSejMMX9uOauanO...
[10:15:33]     ✓ Removed duplicate device 1/2
[10:15:33]     ✓ Removed duplicate device 2/2
[10:15:34] Processing user 2/50: KvLrqmzHcSMdIUBy31reZxEKHT...
[10:15:34]   Found 1 devices
...
[10:16:45] Cleanup complete! Total duplicates removed: 45
```

## Best Practices

1. **Run during off-hours**: Minimize impact on active users
2. **Backup first**: Export Firestore data before running
3. **Test in development**: Run on dev environment first
4. **Review logs**: Check for unexpected errors
5. **Verify results**: Spot-check Firestore after completion

## Automation (Optional)

For regular maintenance, consider creating a Cloud Function:

```javascript
// Run monthly via Cloud Scheduler
exports.monthlyDeviceCleanup = onSchedule('0 0 1 * *', async (event) => {
  // Use same logic as cleanup tool
  // Run automatically
});
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Review Firestore security rules
3. Verify Firebase config is correct
4. Check authentication status
5. Try in incognito mode to rule out cache issues
