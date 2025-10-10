# Event Notification Testing Checklist

## Pre-Deployment
- [ ] Review code changes in `functions/index.js`
- [ ] Ensure no duplicate exports exist
- [ ] Backup current Cloud Functions configuration

## Deployment
- [ ] Run `.\deploy-event-notification-fix.ps1`
- [ ] Verify all functions deployed successfully
- [ ] Check for no duplicate functions in Firebase Console

## Test 1: Event Creation Notifications ✨ NEW

### Setup:
1. Ensure at least 2 users are logged in (or have FCM tokens registered)
2. Open Calendar page

### Test Steps:
1. Click "Add Event/Task" button
2. Fill in event details:
   - Title: "Test Event Creation Notification"
   - Start Date/Time: Tomorrow at 10:00 AM
   - Assignees: Select at least one user
3. Click "Create Event"

### Expected Results:
- ✅ Event is created successfully
- ✅ **ALL users receive a notification** (check browser notifications)
- ✅ Notification title: "New Event Created: Test Event Creation Notification"
- ✅ Notification body: Shows scheduled time
- ✅ Clicking notification redirects to `/calendar`

### Verification:
- [ ] Notification appears on desktop
- [ ] Notification appears on mobile (if testing PWA)
- [ ] Notification sound/vibration works
- [ ] Notification persists in notification center
- [ ] Check Firebase Console > Functions > Logs for `sendNotificationsOnEventCreate`

## Test 2: Event Deletion Notifications (Duplicate Fix)

### Setup:
1. Create a test event first (can use event from Test 1)
2. Note the current time for log comparison

### Test Steps:
1. Navigate to Calendar
2. Click on the test event
3. Click "Delete" button
4. Confirm deletion

### Expected Results:
- ✅ Event is deleted successfully
- ✅ **Receive ONLY ONE notification** (not two!)
- ✅ Notification title: "Event Deleted: [Event Title]"
- ✅ Notification body: Shows event date and who deleted it

### Verification:
- [ ] Only ONE notification received (not duplicate)
- [ ] Check browser notification count
- [ ] Check Firebase Console > Functions > Logs
  - Should see only ONE execution of `notifyEventDelete`
  - Note the execution timestamp
- [ ] Check mobile device (if testing PWA)

## Test 3: Other Event Notifications (Regression Testing)

### Test Event Reschedule:
1. Create an event
2. Edit the event and change the start date/time
3. Save changes
4. **Expected**: Assignees receive reschedule notification

Verification:
- [ ] Reschedule notification received
- [ ] Shows old and new date/time

### Test Event Cancellation:
1. Create an event with status "pending"
2. Edit event and change status to "cancelled"
3. Save changes
4. **Expected**: Assignees receive cancellation notification

Verification:
- [ ] Cancellation notification received
- [ ] Shows event title and date

### Test Event Completion:
1. Create an event with status "in_progress"
2. Change status to "completed"
3. Save changes
4. **Expected**: Admin/Quality users receive completion notification

Verification:
- [ ] Completion notification received by supervisors
- [ ] Not sent to regular users

## Test 4: Scheduled Reminders (Optional)

### Test Owner Event Reminders:
1. Create an event scheduled for tomorrow
2. Wait for scheduled function to run (4 PM UTC daily)
3. **Expected**: Event owners receive reminder

### Test Quality Team Reminders:
1. Create an event with status "pending" for tomorrow
2. Wait for scheduled function (5 PM UTC daily)
3. **Expected**: Quality team receives reminder

## Monitoring & Logs

### Firebase Console Checks:
1. Go to Firebase Console > Functions
2. Click on each function to view logs
3. Look for:
   - Successful executions
   - Error messages
   - Notification counts
   - FCM send results

### Key Log Messages to Look For:

**Event Creation:**
```
Sent X notifications for event creation
```

**Event Deletion (should appear only ONCE per delete):**
```
Sent X/Y deletion notifications for event [eventId]
```

**Errors to Watch For:**
- `FCM send failure`
- `Error sending notifications`
- `Token not registered`

### Browser Console:
1. Open Developer Tools (F12)
2. Check Console tab for:
   - Service worker messages
   - FCM token registration
   - Notification permission status

## Troubleshooting

### No Event Creation Notifications:
1. Check if `sendNotificationsOnEventCreate` is deployed
2. Verify function is triggered (Firebase Console > Functions)
3. Check FCM tokens are registered for users
4. Verify notification permissions are granted

### Still Getting Duplicate Delete Notifications:
1. Run `firebase functions:list` to check for duplicates
2. Delete any duplicate functions
3. Check Cloud Functions logs for multiple executions
4. Verify only one delete operation in Calendar.jsx

### Notifications Not Appearing:
1. Check notification permissions in browser
2. Verify FCM token exists for user
3. Check service worker is active
4. Review browser console for errors
5. Test with a different browser

## Performance Monitoring

After deployment, monitor for 24-48 hours:

### Metrics to Track:
- [ ] Function execution count
- [ ] Success rate of notifications
- [ ] Average execution time
- [ ] Error rate
- [ ] Cost (should be minimal within free tier)

### User Feedback:
- [ ] Event creators confirm notifications work
- [ ] Users report receiving notifications
- [ ] No complaints about duplicate notifications
- [ ] Notification delivery is timely (< 5 seconds)

## Success Criteria

✅ **Deployment Successful** if:
1. Event creation sends notifications to all users
2. Event deletion sends only ONE notification
3. No errors in Cloud Functions logs
4. All existing notifications still work
5. No duplicate functions deployed
6. Performance within acceptable limits

## Rollback Plan

If issues occur:
1. Check previous deployment in Firebase Console
2. Roll back to previous version:
   ```powershell
   firebase functions:delete sendNotificationsOnEventCreate
   ```
3. Investigate logs for root cause
4. Fix and redeploy

## Sign-off

- [ ] All tests passed
- [ ] No duplicate notifications
- [ ] Event creation notifications working
- [ ] Logs reviewed - no errors
- [ ] User acceptance testing complete
- [ ] Production deployment approved

**Tested By:** _________________
**Date:** _________________
**Approved By:** _________________
**Date:** _________________
