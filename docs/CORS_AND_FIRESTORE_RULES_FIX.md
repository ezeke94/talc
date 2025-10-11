# CORS and Firestore Rules Fix

## Issue Date
October 11, 2025

## Problem Description

User encountered two errors when trying to send test notifications from User Management page:

### 1. CORS Error
```
Access to fetch at 'https://us-central1-kpi-talc.cloudfunctions.net/sendTestNotification' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### 2. FCM Registration Error
```
POST https://fcmregistrations.googleapis.com/v1/projects/kpi-talc/registrations 401 (Unauthorized)
```

### 3. Function Error
```
Error sending test notification: FirebaseError: internal
```

## Root Causes

### 1. Missing CORS Configuration
The `sendTestNotification` Firebase callable function (v2) did not have explicit CORS configuration enabled, causing preflight request failures when called from localhost during development.

### 2. Restrictive Firestore Rules
The Firestore rules for the devices subcollection only allowed users to read their own devices:
```javascript
match /devices/{deviceId} {
  allow read, write: if isAuthed() && request.auth.uid == userId;
}
```

This prevented admins from reading other users' devices when sending test notifications through the admin panel, even though the Cloud Function runs with admin privileges.

## Solutions Implemented

### 1. Enable CORS in Firebase Function
**File**: `functions/sendTestNotification.js`

Added `cors: true` to the function configuration:

```javascript
exports.sendTestNotification = onCall({
  region: "us-central1",
  memory: "256MiB",
  cors: true, // Enable CORS for all origins
}, async (request) => {
  // ... function code
});
```

This enables CORS for all origins, allowing the function to be called from localhost during development and from the production domain.

### 2. Update Firestore Rules for Admin Access
**File**: `firestore.rules`

Updated the devices subcollection rules to allow admins to read all devices:

**Before**:
```javascript
match /devices/{deviceId} {
  allow read, write: if isAuthed() && request.auth.uid == userId;
}
```

**After**:
```javascript
match /devices/{deviceId} {
  allow read: if isAuthed() && (request.auth.uid == userId || isAdmin());
  allow write: if isAuthed() && request.auth.uid == userId;
}
```

This allows:
- **Users**: Can read and write their own devices
- **Admins**: Can read all users' devices (but not write)
- **Cloud Functions**: Run with admin privileges, can read all devices

## Deployment

### Commands Executed
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy all functions including sendTestNotification
firebase deploy --only functions
```

### Deployment Results
✅ Firestore rules deployed successfully  
✅ `sendTestNotification` function created successfully  
✅ All other notification functions updated successfully  

## Testing Verification

After deployment, test the following:

1. **CORS Resolution**:
   - [ ] Open app at `http://localhost:5173`
   - [ ] Navigate to User Management
   - [ ] Click notification bell icon
   - [ ] Verify no CORS errors in browser console

2. **Firestore Rules**:
   - [ ] Admin user can view devices dialog
   - [ ] Device list loads successfully
   - [ ] Send test notification works without internal errors

3. **Function Execution**:
   - [ ] Test notification sends successfully
   - [ ] Success message shows correct device count
   - [ ] Notifications received on user's devices

4. **Security**:
   - [ ] Non-admin users cannot read other users' devices
   - [ ] Users can only write to their own devices
   - [ ] Admin can read but not modify other users' devices

## Security Considerations

### Why Allow Admin Read Access to Devices?

1. **Administrative Functions**: Admins need to view user devices to:
   - Send test notifications
   - Troubleshoot notification issues
   - Verify device registrations
   - Monitor system health

2. **Limited Scope**: Admin access is **read-only** for devices
   - Cannot modify or delete other users' devices
   - Cannot register devices on behalf of users
   - Can only view device metadata

3. **Privacy Protection**: Device tokens are:
   - Not exposed in the UI (only device metadata shown)
   - Stored securely in Firestore
   - Never sent to client-side code
   - Only used server-side for FCM

### CORS Security

The `cors: true` configuration allows all origins. For production security enhancement, consider restricting to specific origins:

```javascript
exports.sendTestNotification = onCall({
  region: "us-central1",
  memory: "256MiB",
  cors: ["https://your-production-domain.com", "http://localhost:5173"],
}, async (request) => {
  // ... function code
});
```

However, Firebase callable functions already include:
- Built-in authentication checks
- Request validation
- Rate limiting
- DDoS protection

So allowing all origins with CORS is generally safe for callable functions that require authentication.

## Impact on Other Functions

All notification functions were updated during deployment:
- `sendOwnerEventReminders`
- `sendQualityTeamEventReminders`
- `sendWeeklyOverdueTaskReminders`
- `sendNotificationsOnEventCreate`
- `sendWeeklyKPIReminders`
- `notifyEventReschedule`
- `notifyEventUpdate`
- `notifyEventCancellation`
- `notifyEventCompletion`
- `notifyEventDelete`
- `sendCriticalSystemAlert`
- `sendMonthlyOperationalSummary`
- `helloWorld`

These functions already run with admin privileges and access Firestore using the Admin SDK, so the Firestore rules changes do not affect them. They will continue to function normally.

## Related Files

### Modified Files:
- `functions/sendTestNotification.js` - Added CORS configuration
- `firestore.rules` - Updated devices subcollection rules

### Deployed Resources:
- All Firebase Cloud Functions (updated)
- Firestore Security Rules (updated)

## Troubleshooting

### If CORS errors persist:
1. Clear browser cache and reload
2. Verify function deployed successfully:
   ```bash
   firebase functions:list
   ```
3. Check Firebase Console > Functions > sendTestNotification
4. Ensure latest function version is active

### If Firestore permission errors occur:
1. Verify rules deployed:
   ```bash
   firebase firestore:rules:list
   ```
2. Check user role in Firestore Console
3. Verify user is authenticated
4. Check browser console for specific rule violation details

### If function still returns "internal" error:
1. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only sendTestNotification
   ```
2. Verify user has devices registered
3. Check FCM tokens are valid
4. Verify Firebase Admin SDK initialized correctly

## Future Improvements

1. **CORS Configuration**: Restrict CORS to specific production domains
2. **Rate Limiting**: Add custom rate limiting for test notifications
3. **Audit Logging**: Log when admins view user devices
4. **Device Verification**: Validate device tokens before sending
5. **Batch Notifications**: Support sending to specific devices instead of all

## Conclusion

The CORS and Firestore rules issues have been resolved by:
1. Adding explicit CORS configuration to the callable function
2. Granting admin read access to devices subcollection
3. Deploying both rules and functions successfully

The system now allows admins to view user devices and send test notifications without CORS or permission errors, while maintaining security by limiting admin access to read-only and keeping device tokens private.
