# How to View Registered Devices in the UI

## Access the Notification Settings Page

### Method 1: Via Profile Page
1. Log in to your TALC application
2. Navigate to `/profile` in the browser or click on your profile icon
3. Scroll down to the **"Push Notifications"** section
4. Below the notification toggle, you should see **"Registered Devices"**

### Method 2: Via URL
- Direct URL: `https://your-app-domain.com/profile`
- Or for local development: `http://localhost:5173/profile`

## What You Should See

### If You Have Devices Registered:
```
┌─────────────────────────────────────────┐
│  Push Notifications                     │
│  ○ Notifications are ON/OFF             │
│  ───────────────────────────────────── │
│  Registered Devices              🔄     │
│                                         │
│  🖥️  My Laptop      [This Device]       │
│      Last active: Just now              │
│      Platform: Win32                    │
│                      ✏️  ⚪ ON           │
└─────────────────────────────────────────┘
```

### If No Devices Are Registered:
```
┌─────────────────────────────────────────┐
│  Registered Devices              🔄     │
│                                         │
│  ℹ️  No devices registered for          │
│     notifications. Enable notifications │
│     on this device to get started.      │
└─────────────────────────────────────────┘
```

### If It's Still Loading:
```
┌─────────────────────────────────────────┐
│  Registered Devices              🔄     │
│                                         │
│           ⏳ Loading...                 │
│                                         │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Issue: "Registered Devices" section not showing at all

**Solution 1: Check Console for Errors**
1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Look for errors related to:
   - `NotificationSettings`
   - `deviceManager`
   - `getUserDevices`
   - Firestore errors

**Solution 2: Check if you're on the correct page**
- Make sure you're on `/profile` page
- The NotificationSettings component should be visible below your profile information

### Issue: Shows "No devices registered" but you enabled notifications

**Possible Causes:**
1. **Firestore Index Missing**: The orderBy query might need an index
2. **Subcollection Not Created**: Devices subcollection wasn't created when you enabled notifications
3. **Permission Issues**: Firestore security rules might be blocking reads

**Solutions:**

#### Check Firestore Data:
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find your user document: `users/{your-user-id}`
4. Look for a subcollection called `devices`
5. You should see documents with token IDs as names

#### Check Console Logs:
Look for these messages in the browser console:
```
NotificationSettings: Loading devices for user: [your-user-id]
deviceManager.getUserDevices: Fetching devices for user: [your-user-id]
deviceManager.getUserDevices: Found X devices
```

#### If you see "Firestore index required" error:
1. Click the link in the error message to create the index
2. Wait 2-3 minutes for the index to build
3. Refresh the page

OR the code will automatically retry without ordering:
```
deviceManager.getUserDevices: Retrying without orderBy...
deviceManager.getUserDevices: Retry found X devices
```

### Issue: Error message appears

**Check the error message**:
- If it says "Failed to load devices. Please refresh the page."
  - Click the refresh icon (🔄) next to "Registered Devices"
  - Or reload the entire page

**Check Firestore Rules**:
Make sure your Firestore rules allow reading device subcollection:
```javascript
match /users/{userId}/devices/{deviceId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

### Issue: Devices show but can't edit/delete

**Check Console**:
- Look for permission errors
- Check if the buttons are clickable
- Verify you're logged in

## Testing Steps

### 1. Enable Notifications
1. Go to `/profile`
2. Toggle "Notifications" to ON
3. Give your device a name (e.g., "My Laptop")
4. Allow notifications in the browser
5. The device should appear in the list immediately

### 2. Check Multiple Devices
1. Open the app on another device/browser
2. Enable notifications with a different name (e.g., "My Phone")
3. Both devices should appear in the list when you visit `/profile` on either device

### 3. Edit Device Name
1. Click the edit icon (✏️) next to a device
2. Change the name
3. Click "Update"
4. Name should update immediately

### 4. Disable/Enable Device
1. Toggle the switch next to a device
2. It should change from ON to OFF
3. When OFF, the device won't receive notifications

### 5. Remove Device
1. Click the delete icon (🗑️) next to a device (not current device)
2. Confirm the deletion
3. Device should disappear from the list

## Expected Console Output (Normal Operation)

```
NotificationSettings: Loading devices for user: abc123xyz
deviceManager.getUserDevices: Fetching devices for user: abc123xyz
deviceManager.getUserDevices: Found 2 devices
deviceManager.getUserDevices: Device: {id: "token1...", name: "My Laptop", enabled: true, ...}
deviceManager.getUserDevices: Device: {id: "token2...", name: "My Phone", enabled: true, ...}
NotificationSettings: Loaded devices: (2) [{...}, {...}]
```

## Common Console Errors and Fixes

### Error: "orderBy() requires an index"
```
Error: The query requires an index. You can create it here: https://console.firebase.google.com/...
```
**Fix**: 
- Click the link to create the index, OR
- The code will automatically retry without orderBy

### Error: "Missing or insufficient permissions"
```
Error: Missing or insufficient permissions.
```
**Fix**: Update Firestore security rules to allow reading devices subcollection

### Error: "getUserDevices is not defined"
```
ReferenceError: getUserDevices is not defined
```
**Fix**: Make sure `deviceManager.js` is properly imported in `NotificationSettings.jsx`

## Visual Debugging Checklist

- [ ] Can you see the "Push Notifications" card?
- [ ] Can you see the "Registered Devices" heading?
- [ ] Can you see the refresh icon (🔄)?
- [ ] Do you see a loading spinner or message?
- [ ] Do you see the "No devices" alert or device list?
- [ ] Check browser console for any red errors
- [ ] Check Network tab for failed Firestore requests

## Quick Test Commands

### In Browser Console:
```javascript
// Check if component loaded
document.querySelector('[data-testid="notification-settings"]')

// Check if deviceManager is available
import('./src/utils/deviceManager.js').then(m => console.log(m))

// Check current user
firebase.auth().currentUser

// Manually fetch devices
import { collection, getDocs } from 'firebase/firestore';
import { db } from './src/firebase/config';
const userId = 'your-user-id';
getDocs(collection(db, 'users', userId, 'devices')).then(snap => {
  console.log('Devices:', snap.size);
  snap.forEach(doc => console.log(doc.id, doc.data()));
});
```

## Next Steps

If devices still don't show:
1. Share the console errors/logs
2. Check Firestore Database directly
3. Verify the user has enabled notifications at least once
4. Check if the app is using the latest deployed code
