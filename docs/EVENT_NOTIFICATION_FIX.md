# Event Notification Fix

## Issues Identified

### 1. Missing Event Creation Notifications
**Problem**: When a new event is created, no notifications are sent to users.

**Root Cause**: The `sendNotificationsOnEventCreate` function exists in `functions/eventNotifications.js` but was not exported in `functions/index.js`.

**Fix Applied**: Added the export to `functions/index.js`:
```javascript
exports.sendNotificationsOnEventCreate = eventNotifications.sendNotificationsOnEventCreate;
```

### 2. Duplicate Event Delete Notifications
**Problem**: Users receive the same delete notification twice when an event is deleted.

**Possible Causes**:
1. Multiple deployments of the same Cloud Function
2. Old function versions still active
3. Race condition in Cloud Functions

**Solution**: Redeploy functions to ensure clean state and remove any duplicate deployments.

## Deployment Steps

### Step 1: Deploy Functions
```powershell
# Navigate to functions directory
cd functions

# Install dependencies (if needed)
npm install

# Deploy all functions
firebase deploy --only functions
```

### Step 2: Verify Deployed Functions
```powershell
# List all deployed functions
firebase functions:list
```

**Expected functions**:
- `sendOwnerEventReminders` (scheduled)
- `sendQualityTeamEventReminders` (scheduled)
- `sendWeeklyOverdueTaskReminders` (scheduled)
- `sendNotificationsOnEventCreate` (Firestore trigger - NEW)
- `sendWeeklyKPIReminders` (scheduled)
- `notifyEventReschedule` (Firestore trigger)
- `notifyEventCancellation` (Firestore trigger)
- `notifyEventCompletion` (Firestore trigger)
- `notifyEventDelete` (Firestore trigger)
- `sendMonthlyOperationalSummary` (scheduled)
- `sendCriticalSystemAlert` (HTTP)
- `helloWorld` (HTTP)

### Step 3: Clean Up Duplicate Functions (if any exist)
If you see duplicate functions in the list, delete the old ones:
```powershell
# Delete a specific function
firebase functions:delete FUNCTION_NAME
```

### Step 4: Test Event Notifications

#### Test Event Creation:
1. Log in to the application
2. Navigate to Calendar
3. Create a new event with assignees
4. **Expected**: All users should receive a notification about the new event

#### Test Event Deletion:
1. Delete an existing event
2. **Expected**: All users should receive ONE notification (not two) about the deletion

## Verification Checklist

- [ ] Functions deployed successfully
- [ ] No duplicate functions in Firebase Console
- [ ] Event creation sends notifications to all users
- [ ] Event deletion sends only ONE notification (not duplicate)
- [ ] Event reschedule notifications still work
- [ ] Event cancellation notifications still work
- [ ] Event completion notifications still work

## Code Changes Summary

### Modified Files:
1. **functions/index.js**
   - Added export: `exports.sendNotificationsOnEventCreate = eventNotifications.sendNotificationsOnEventCreate;`

## Technical Details

### Event Creation Trigger
- **Trigger Type**: Firestore `onDocumentCreated`
- **Collection**: `events/{eventId}`
- **Behavior**: Sends notification to all users when a new event is created
- **Region**: `us-central1`

### Event Delete Trigger
- **Trigger Type**: Firestore `onDocumentDeleted`
- **Collection**: `events/{eventId}`
- **Behavior**: Sends notification to all users when an event is deleted
- **Region**: `us-central1`

## Troubleshooting

### If notifications still not working:
1. Check Firebase Console > Functions for any errors
2. Verify FCM tokens are registered for users
3. Check browser console for service worker errors
4. Verify notification permissions are granted

### If still getting duplicate delete notifications:
1. Check for duplicate function deployments in Firebase Console
2. Review Cloud Functions logs for multiple executions
3. Ensure only one `notifyEventDelete` function is deployed
4. Consider adding idempotency key to prevent duplicate processing

## Monitoring

After deployment, monitor the following:
- Cloud Functions logs for execution counts
- User feedback about notification delivery
- Check for any error logs in Firebase Console

## Cost Impact

Adding event creation notifications will increase Cloud Function invocations:
- **New triggers**: 1 per event creation
- **Estimated cost**: Minimal (within free tier for typical usage)
- **Free tier**: 2M invocations/month

## Next Steps

1. Deploy the functions using the commands above
2. Test thoroughly in development environment
3. Monitor for 24-48 hours after deployment
4. If issues persist, review Cloud Functions logs

## Related Files
- `functions/index.js` - Main exports file (modified)
- `functions/eventNotifications.js` - Event reminder and creation notifications
- `functions/eventChangeNotifications.js` - Event change notifications (update, delete, cancel)
- `src/pages/Calendar.jsx` - Frontend event management
