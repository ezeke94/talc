# Critical Notification Fix - iOS APNS Issue

**Date:** October 11, 2025  
**Issue:** iPhone users seeing raw JSON data in notifications instead of formatted messages  
**Status:** ✅ Fixed

## The Real Problem

The screenshot was from an **iPhone**, not Android! The notification was showing:
```
{"data":{"url":"/calendar","type":"event_delete","eventId":"8IFXeGMU14AY2dZO5NQ1"},...}
```

## Root Cause: iOS APNS Payload Structure

Unlike Android, iOS (APNS) requires notifications to have a specific payload structure:

### ❌ WRONG (What we had):
```javascript
{
  notification: {
    title: "Event Deleted",
    body: "An event has been deleted"
  },
  data: {
    type: 'event_delete',
    eventId: '123'
  },
  apns: {
    headers: {
      'apns-priority': '10'  // ❌ No alert structure
    }
  }
}
```

### ✅ CORRECT (What we need):
```javascript
{
  notification: {
    title: "Event Deleted",
    body: "An event has been deleted"
  },
  data: {
    type: 'event_delete',
    eventId: '123'
  },
  apns: {
    headers: {
      'apns-priority': '10'
    },
    payload: {
      aps: {
        alert: {
          title: "Event Deleted",  // ✅ Must be in aps.alert
          body: "An event has been deleted"  // ✅ Must be in aps.alert
        },
        sound: 'default',
        badge: 1
      }
    }
  }
}
```

## The Fix

### 1. Created iOS Helper Function

```javascript
function createIOSNotification(title, body, priority = '10', badge = 1) {
  return {
    headers: {
      'apns-priority': priority
    },
    payload: {
      aps: {
        alert: {
          title,
          body
        },
        sound: 'default',
        badge
      }
    }
  };
}
```

### 2. Updated All Notifications

Now every notification uses:
```javascript
android: createAndroidNotification(title, body, 'high'),
apns: createIOSNotification(title, body, '10', 1)
```

## Bonus: Moved to Firebase Functions Only

### Why?

You asked: "why are we using netlify functions? can't we use only firebase functions only"

**Answer:** YES! You're right. We should use Firebase Functions only for consistency.

### Changes Made:

1. **Created** `functions/sendTestNotification.js` (Firebase callable function)
2. **Updated** `functions/index.js` to export the test notification function
3. **Updated** `src/pages/UserManagement.jsx` to call Firebase function instead of Netlify

### Before (Netlify):
```javascript
const response = await fetch('/.netlify/functions/sendTestNotification', {
  method: 'POST',
  body: JSON.stringify({ tokens, userName, timestamp })
});
```

### After (Firebase):
```javascript
const functions = getFunctions();
const sendTestNotif = httpsCallable(functions, 'sendTestNotification');
const result = await sendTestNotif({ userId, userName });
```

### Benefits of Firebase Functions Only:

1. ✅ **Unified Backend** - Everything in one place
2. ✅ **Better Integration** - Direct Firestore access
3. ✅ **Easier Deployment** - Single deployment command
4. ✅ **Consistent Auth** - Firebase auth works seamlessly
5. ✅ **No Extra Services** - No need for Netlify functions

## Files Modified

### New Files:
1. ✅ `functions/sendTestNotification.js` - Firebase callable function for test notifications

### Updated Files:
2. ✅ `functions/index.js` - Added test notification export
3. ✅ `functions/eventChangeNotifications.js` - Added iOS helper, updated all notifications
4. ✅ `functions/eventNotifications.js` - Added iOS helper
5. ✅ `src/pages/UserManagement.jsx` - Switched from Netlify to Firebase callable function

## Testing on iPhone

### Steps to Verify Fix:

1. **Register iPhone Device:**
   - Open app on iPhone
   - Allow notifications when prompted
   - Check that device token is registered in Firestore

2. **Send Test Notification:**
   - Go to User Management page (as Admin)
   - Click the notification bell icon next to a user
   - Check iPhone receives formatted notification

3. **Expected Result:**
   ```
   Title: "Test Notification"
   Body: "Hi [User Name]! This is a test notification sent at [time]"
   ```
   **NOT:** Raw JSON data

4. **Trigger Real Notifications:**
   - Create an event
   - Update an event
   - Delete an event
   - All should show proper title/body on iPhone

## iOS vs Android Notification Structure

### iOS (APNS) Requirements:
- Must have `apns.payload.aps.alert.title`
- Must have `apns.payload.aps.alert.body`
- Can include `aps.sound` and `aps.badge`

### Android (FCM) Requirements:
- Must have `android.notification.title`
- Must have `android.notification.body`
- Can include `android.notification.sound` and `android.notification.icon`

### Web Push Requirements:
- Uses top-level `notification.title` and `notification.body`
- Handled by service worker

## Deployment Checklist

- [ ] Deploy Firebase functions: `firebase deploy --only functions`
- [ ] Deploy frontend: `npm run build && firebase deploy --only hosting`
- [ ] Test on iPhone device
- [ ] Test on Android device
- [ ] Test on web browser
- [ ] Verify test notification feature works

## Related Issues Fixed

1. ✅ Duplicate notifications - Fixed in previous update
2. ✅ Role-based filtering removed - All users get all notifications
3. ✅ iOS notification display - Fixed with proper APNS payload
4. ✅ Android notification display - Fixed with explicit notification object
5. ✅ Test notification feature - Now using Firebase functions

## Next Steps

1. Remove Netlify function (if not used for anything else)
2. Test thoroughly on iPhone
3. Monitor notification delivery rates
4. Consider adding notification categories for iOS (swipe actions)

## References

- [FCM APNS Payload Reference](https://firebase.google.com/docs/cloud-messaging/ios/message-payload)
- [APNS Notification Format](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/generating_a_remote_notification)
