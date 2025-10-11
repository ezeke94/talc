# Notification Debugging Guide

## How to Access Past Notifications

### 🔔 Using the Notification Bell (NEW!)

**In the app header/navbar:**
1. Look for the **bell icon** (🔔) in the top-right corner of the app
2. The bell shows a **red badge** with the count of unread notifications
3. Click the bell to open the **Notification History** dialog

**In the Notification History dialog, you can:**
- ✅ View all past notifications (last 100)
- ✅ See when each notification was received
- ✅ Click on a notification to navigate to the related page
- ✅ Mark individual notifications as read
- ✅ Mark all notifications as read
- ✅ Delete individual notifications
- ✅ Clear all notification history
- ✅ See which source sent the notification (background/foreground)

### 📊 Using Browser DevTools

**To inspect notification data directly:**

1. Open browser DevTools (F12 or right-click → Inspect)
2. Go to the **Console** tab
3. Run these commands:

```javascript
// View notification history
JSON.parse(localStorage.getItem('talc_notification_history'))

// View deduplication registry
JSON.parse(localStorage.getItem('talc_notification_dedup'))

// Count total notifications
JSON.parse(localStorage.getItem('talc_notification_history')).length

// Get unread count
JSON.parse(localStorage.getItem('talc_notification_history')).filter(n => !n.read).length

// View most recent notification
JSON.parse(localStorage.getItem('talc_notification_history'))[0]
```

---

## Debugging "Still Getting 2 Notifications"

### 🔍 Step 1: Open Browser Console

**Before triggering a test notification:**
1. Open DevTools (F12)
2. Go to **Console** tab
3. Clear the console (click 🚫 icon)
4. Keep console open and visible

### 📨 Step 2: Trigger a Test Notification

**From Firebase Cloud Functions:**
- Create a test event in Calendar
- Delete a test event
- Or use the notification test function

### 👀 Step 3: Watch the Debug Logs

**You should see detailed logs like this:**

#### If Working Correctly (1 notification):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Foreground] 📨 MESSAGE RECEIVED
[Foreground] Payload: {...}
[Foreground] Timestamp: 2025-10-12T...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[NotifHistory] Generated notification ID: {...}
[NotifHistory] Checking duplicate for: event_create-abc123-... from foreground
[NotifHistory] Current dedup registry: [...]
[NotifHistory] ✅ NEW notification registered: {...}
[Foreground] ✅ New notification - proceeding to show
```

#### If Getting Duplicates:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SW] 📨 BACKGROUND MESSAGE RECEIVED
[SW] Payload: {...}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SW] Generated ID: event_create-abc123-...
[SW] ✅ NEW notification recorded in service worker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Foreground] 📨 MESSAGE RECEIVED
[Foreground] Payload: {...}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[NotifHistory] Checking duplicate for: event_create-abc123-... from foreground
[NotifHistory] ⚠️ DUPLICATE DETECTED!
{
  notificationId: "event_create-abc123-...",
  currentSource: "foreground",
  previousSource: "background",
  timeSinceFirst: "123ms",
  windowLimit: "10000ms"
}
[Foreground] ❌ Duplicate notification BLOCKED
```

### 🎯 Step 4: Look at the Visual Debug Toast

**On-screen notification toast will appear showing:**
- ✅ Green toast = New notification (should show)
- ⚠️ Orange toast = Duplicate detected (blocked)

**Toast shows:**
- Notification title and body
- Source (background/foreground)
- Type and timestamp
- If duplicate: previous source and time since
- Notification ID for tracking

### 🔎 Step 5: Analyze the Pattern

**Questions to answer:**

1. **Do you see both logs?**
   - Both `[SW]` and `[Foreground]` logs → Both contexts receiving message
   - Only one → Single context (expected)

2. **Are the notification IDs the same?**
   - Same ID → Good, deduplication can work
   - Different IDs → BUG: ID generation inconsistent

3. **Is the duplicate being blocked?**
   - See "⚠️ DUPLICATE DETECTED" → Dedup working
   - See "✅ NEW" twice → Dedup NOT working

4. **What's the time difference?**
   - `timeSinceFirst: "50ms"` → Near-simultaneous (race condition)
   - `timeSinceFirst: "2000ms"` → Sequential delivery

5. **What are the sources?**
   - `background` then `foreground` → App was open when notification arrived
   - Both `foreground` → Service worker not handling background
   - Both `background` → Something wrong with foreground handler

---

## Common Issues & Solutions

### Issue 1: Both Logs Appear, No Duplicate Detection

**Symptoms:**
- See both `[SW]` and `[Foreground]` logs
- Both say "✅ NEW notification"
- No "⚠️ DUPLICATE DETECTED" warning

**Possible Causes:**
1. **Different Notification IDs:**
   - Check the generated IDs in both logs
   - If different → ID generation is inconsistent
   - **Fix:** Ensure both use same data for ID generation

2. **localStorage Not Shared:**
   - Service worker and main app should share localStorage
   - **Test:** In console, check if both can access:
     ```javascript
     localStorage.getItem('talc_notification_dedup')
     ```

3. **Timing Issue:**
   - Both receive message at exact same time
   - Both check dedup registry before either writes to it
   - **Expected:** One should be slightly faster and register first

### Issue 2: Only Seeing Foreground Logs

**Symptoms:**
- Only `[Foreground]` logs appear
- No `[SW]` logs
- Getting notification even when app is closed

**Diagnosis:**
- Service worker might not be registered
- Service worker might not be handling messages

**Solution:**
1. Check service worker registration:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(console.log)
   ```

2. Verify firebase-messaging-sw.js is active:
   ```javascript
   navigator.serviceWorker.ready.then(reg => console.log(reg.active))
   ```

3. Force update service worker:
   - DevTools → Application → Service Workers
   - Click "Update" next to firebase-messaging-sw.js
   - Refresh page

### Issue 3: Only Seeing Background Logs

**Symptoms:**
- Only `[SW]` logs appear when app is open
- No `[Foreground]` logs

**Diagnosis:**
- Foreground message handler might not be set up
- `onMessage` might not be registered

**Solution:**
1. Check if notifications.js is initialized:
   ```javascript
   // Should see this in console on page load
   console.log('Setting up Firebase notifications...')
   ```

2. Verify FCM token exists:
   ```javascript
   localStorage.getItem('fcmToken')
   ```

3. Check for errors in console during setup

### Issue 4: Different IDs Generated

**Symptoms:**
- Same notification generates different IDs in background vs foreground
- IDs visible in console logs

**Diagnosis:**
- Payload structure might be different in each context
- Missing fields in one context

**Solution:**
1. Compare payloads in console logs:
   ```javascript
   // Background payload
   [SW] Payload: { notification: {...}, data: {...} }
   
   // Foreground payload
   [Foreground] Payload: { notification: {...}, data: {...} }
   ```

2. Ensure both contexts receive same fields:
   - `notification.title`
   - `notification.body`
   - `data.type`
   - `data.eventId`

3. Check Cloud Function is sending consistent payload

### Issue 5: Dedup Registry Not Persisting

**Symptoms:**
- Duplicates occur on different pages
- Dedup registry empty or missing entries

**Diagnosis:**
- localStorage might be clearing
- Different origins/contexts

**Solution:**
1. Check localStorage quota:
   ```javascript
   navigator.storage.estimate().then(console.log)
   ```

2. Verify not in incognito/private mode

3. Check browser storage settings

---

## Manual Testing Checklist

### ✅ Test 1: App Closed, Notification Arrives

**Steps:**
1. Close the app completely
2. Send test notification
3. Open DevTools console BEFORE clicking notification
4. Click notification to open app

**Expected:**
- ✅ Only `[SW]` logs
- ✅ "✅ NEW notification" from background
- ✅ Notification visible in history when app opens

### ✅ Test 2: App Open, Notification Arrives

**Steps:**
1. Open app
2. Keep console visible
3. Send test notification

**Expected:**
- ✅ Both `[SW]` and `[Foreground]` logs (might appear)
- ✅ First one: "✅ NEW notification"
- ✅ Second one: "⚠️ DUPLICATE DETECTED" and "❌ BLOCKED"
- ✅ Only ONE notification appears on screen/system tray
- ✅ Visual debug toast shows duplicate detection

### ✅ Test 3: App Minimized/Background

**Steps:**
1. Open app
2. Minimize browser window
3. Send test notification
4. Wait for notification to appear
5. Click notification to open app

**Expected:**
- ✅ `[SW]` logs when notification arrives
- ✅ Possibly `[Foreground]` logs too
- ✅ If both: one should be blocked as duplicate
- ✅ Only ONE notification shows

### ✅ Test 4: Rapid Fire Notifications

**Steps:**
1. Open app with console
2. Send 3-5 test notifications rapidly
3. Watch console logs

**Expected:**
- ✅ Each notification gets unique ID (different content)
- ✅ All show successfully (different notifications)
- ✅ OR if same content: first shows, rest blocked as duplicates

### ✅ Test 5: Same Notification Twice

**Steps:**
1. Open app with console
2. Send test notification
3. Wait 5 seconds
4. Send SAME test notification again (same event, same title/body)

**Expected:**
- ✅ First: "✅ NEW notification"
- ✅ Second (within 10s): "⚠️ DUPLICATE DETECTED"
- ✅ Only first shows
- ✅ Debug toast shows duplicate

---

## Advanced Debugging

### Inspect Deduplication Registry

```javascript
// In console
const dedupData = JSON.parse(localStorage.getItem('talc_notification_dedup'));

console.table(
  Object.entries(dedupData).map(([id, data]) => ({
    id: id.substring(0, 60) + '...',
    source: data.source,
    ageMs: Date.now() - data.timestamp,
    timestamp: new Date(data.timestamp).toLocaleTimeString()
  }))
);
```

### Monitor Dedup Registry Changes

```javascript
// In console
setInterval(() => {
  const dedup = JSON.parse(localStorage.getItem('talc_notification_dedup') || '{}');
  console.log('Dedup registry size:', Object.keys(dedup).length);
  console.table(
    Object.entries(dedup).map(([id, data]) => ({
      id: id.substring(0, 40),
      source: data.source,
      ageSeconds: Math.round((Date.now() - data.timestamp) / 1000)
    }))
  );
}, 3000); // Every 3 seconds
```

### Test localStorage Access from Service Worker

```javascript
// In main app console
navigator.serviceWorker.controller.postMessage({
  type: 'TEST_LOCALSTORAGE'
});

// Add to firebase-messaging-sw.js temporarily:
self.addEventListener('message', (event) => {
  if (event.data.type === 'TEST_LOCALSTORAGE') {
    // Service workers can't access localStorage directly
    // They need to communicate with main app
    console.log('[SW] Cannot access localStorage directly');
    console.log('[SW] Using Map() for deduplication instead');
  }
});
```

---

## What to Report When Still Seeing Duplicates

**Please provide:**

1. **Console logs screenshot** showing:
   - Both notification receptions
   - Notification IDs generated
   - Duplicate check results

2. **Payload comparison:**
   ```javascript
   // Copy from console
   [SW] Payload: { ... }
   [Foreground] Payload: { ... }
   ```

3. **Dedup registry state:**
   ```javascript
   JSON.parse(localStorage.getItem('talc_notification_dedup'))
   ```

4. **Timing information:**
   - Time between first and second notification (from logs)
   - Whether app was open/closed

5. **Browser information:**
   - Browser name and version
   - Device (iPhone, Android, Desktop)
   - Operating system

6. **Screenshot of debug toast** if it appears

---

## Quick Diagnosis Commands

Run these in console to get diagnostic info:

```javascript
// Full diagnostic report
console.log('=== NOTIFICATION SYSTEM DIAGNOSTIC ===');
console.log('Notification History:', JSON.parse(localStorage.getItem('talc_notification_history') || '[]').length, 'items');
console.log('Dedup Registry:', Object.keys(JSON.parse(localStorage.getItem('talc_notification_dedup') || '{}')).length, 'tracked');
console.log('FCM Token:', localStorage.getItem('fcmToken') ? 'Present' : 'Missing');
console.log('Service Worker:', navigator.serviceWorker.controller ? 'Active' : 'Inactive');

// Recent notifications
console.table(
  JSON.parse(localStorage.getItem('talc_notification_history') || '[]')
    .slice(0, 5)
    .map(n => ({
      title: n.title,
      source: n.source,
      read: n.read,
      time: new Date(n.timestamp).toLocaleTimeString()
    }))
);
```

---

## Expected Behavior Summary

### ✅ CORRECT: Single notification shown
- Console shows ONE "✅ NEW notification" log
- OR shows TWO logs but second is "⚠️ DUPLICATE DETECTED" and blocked
- User sees/hears notification ONCE
- Debug toast shows "New notification" (green)
- Notification appears in history ONCE

### ❌ INCORRECT: Duplicate notifications
- Console shows TWO "✅ NEW notification" logs
- User sees/hears notification TWICE
- No "⚠️ DUPLICATE DETECTED" warning
- Two debug toasts appear (both green)
- Notification appears in history TWICE

If you're seeing the INCORRECT behavior, the debug logs will help identify WHERE the deduplication is failing.
