// MOVED TO docs/archive/ANDROID_NOTIFICATION_TESTING.md
# Android System Notifications - Testing Guide

## Problem
Notifications are appearing as in-browser custom notifications instead of Android system notifications.

## Root Causes Fixed

### 1. **Foreground Message Handling**
- **Issue**: The `onMessage` handler in `notifications.js` was intercepting foreground messages and showing custom in-app notifications
- **Fix**: Updated to forward messages to the service worker so it can display them as system notifications

### 2. **Service Worker Registration**
- **Issue**: Service worker scope might not be properly set to root `/`
- **Fix**: Explicitly register firebase-messaging-sw.js with `scope: '/'`

### 3. **Missing Service Worker Message Handler**
- **Issue**: Service worker couldn't handle forwarded foreground messages
- **Fix**: Added `message` event listener in firebase-messaging-sw.js to handle `NOTIFICATION_RECEIVED` type messages

## Testing Steps

### Step 1: Clear Everything
On your Android device, do a complete reset:

1. **Uninstall the PWA** (if installed)
2. **Clear Browser Data**:
   - Open Chrome (or your browser)
   - Go to Settings → Privacy and security → Clear browsing data
   - Select "All time"
   - Check: Cookies, Cached images, Site settings
   - Click "Clear data"

### Step 2: Deploy the Updated Code
```bash
npm run build
# Then deploy to your hosting (Firebase, Netlify, etc.)
```

### Step 3: Test Service Worker Registration
1. Open the test page on your Android device:
   ```
   https://your-domain.com/test-android-notifications.html
   ```

2. Click "Check Service Worker" - should show:
   - ✅ `firebase-messaging-sw.js` registered
   - ✅ Scope: `https://your-domain.com/`
   - ✅ State: `active`

3. If not registered, click "Register SW" button

### Step 4: Test Notification Permission
1. Click "Request Permission"
2. Allow notifications when prompted
3. Status should show: `Permission: granted`

### Step 5: Test System Notification
1. Click "Show System Notification"
2. **Expected**: A notification appears in the Android notification tray (NOT in the browser)
3. **What to check**:
   - Pull down notification shade
   - Should see the notification there
   - Should NOT see an in-browser popup

### Step 6: Test Foreground Messages
1. Ensure you're on the test page and the app is in foreground
2. Click "Send Message to SW"
3. **Expected**: System notification appears (same as step 5)

### Step 7: Test in Main App
1. Navigate to the main app: `https://your-domain.com/`
2. Log in
3. Enable notifications when prompted
4. Send a test notification from your backend/Firebase console
5. **Expected**: System notification appears in Android notification tray

## Troubleshooting

### Issue: Service Worker Won't Register
**Symptoms**: "Check Service Worker" shows 0 registrations

**Solutions**:
1. Make sure you're accessing via HTTPS (required for service workers)
2. Check browser console for errors
3. Try manually registering from test page
4. Clear browser data and try again

### Issue: Notifications Still Appear In-Browser
**Symptoms**: Custom notification popup appears instead of system notification

**Solutions**:
1. Verify service worker is active (use test page)
2. Check browser console - look for:
   - "Foreground message received"
   - "Message sent to service worker" or similar
3. Make sure you're testing with the BUILT version (not dev server)
4. Try force-refreshing the page (Ctrl/Cmd + Shift + R)

### Issue: No Service Worker Controller
**Symptoms**: "Send Message to SW" shows error "No service worker controller active"

**Solutions**:
1. Refresh the page to let service worker take control
2. Check that service worker scope is `/` (not a subdirectory)
3. Close all tabs of the app and reopen

### Issue: Permission Denied
**Symptoms**: Can't request notification permission

**Solutions**:
1. Clear site data in browser settings
2. Check Chrome://settings/content/notifications
3. Make sure your domain isn't blocked

## Key Files Changed

1. **src/main.jsx**
   - Enhanced service worker registration with explicit scope
   - Better detection of firebase messaging SW

2. **src/utils/notifications.js**
   - Changed `onMessage` handler to forward to service worker
   - Updated service worker registration logic

3. **public/firebase-messaging-sw.js**
   - Added `message` event handler for foreground notifications
   - Ensures consistent notification display

## Expected Behavior

### Background (App Not Open)
- FCM message → Service worker `onBackgroundMessage` → System notification ✅

### Foreground (App Open)
- FCM message → `onMessage` in app → Forward to service worker → System notification ✅

### Android System Notifications Should:
- ✅ Appear in notification tray
- ✅ Show app icon and badge
- ✅ Play notification sound
- ✅ Persist until dismissed
- ✅ Support action buttons (View, Dismiss, etc.)
- ❌ NOT appear as in-browser popups

## Debug Console Logs

When working correctly, you should see:

```
Firebase Messaging initialized
Found existing firebase-messaging-sw.js registration: https://your-domain.com/
FCM registration token obtained: [token]
Foreground message received: [payload]
```

And in the Service Worker console:
```
[firebase-messaging-sw.js] Message received from app: {type: 'NOTIFICATION_RECEIVED', payload: {...}}
```

## Testing on Desktop (for comparison)

Desktop Chrome shows notifications as system notifications by default. Test there first to verify the flow works, then test on Android.

## Still Having Issues?

1. Share the console output from the test page
2. Check what happens when you click "Check Service Worker"
3. Try the test notification button - does it show in system tray?
4. Share any error messages from browser console
