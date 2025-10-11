# Device Visibility & Test Notification Feature

## Overview
This feature allows administrators to view all registered devices for each user and send test notifications while seeing exactly which devices will receive them.

## Implementation Date
October 11, 2024

## Components Updated

### 1. Frontend - UserManagement.jsx
**Location**: `src/pages/UserManagement.jsx`

**New Features**:
- Device visibility dialog
- Device icon indicators (iPhone, Android, Desktop/Laptop)
- Device status display (enabled/disabled)
- Test notification functionality integrated with device display

**New State**:
```javascript
const [deviceDialog, setDeviceDialog] = useState({ 
  open: false, 
  userId: null, 
  userName: '', 
  devices: [] 
});
```

**New Functions**:
1. `handleOpenDeviceDialog(userId, userName)` - Fetches and displays user's devices
2. `handleCloseDeviceDialog()` - Closes the device dialog
3. `handleSendTestNotification()` - Sends test notification to all user's devices
4. `getDeviceIcon(deviceType, os)` - Returns appropriate icon based on device type/OS

**New Imports**:
```javascript
// Material-UI Components
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';

// Icons
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import LaptopIcon from '@mui/icons-material/Laptop';
import DevicesIcon from '@mui/icons-material/Devices';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
```

### 2. Backend - sendTestNotification.js
**Location**: `functions/sendTestNotification.js`

**Function Type**: Firebase Callable Function (onCall)

**Features**:
- Multi-device support
- iOS APNS payload formatting
- Android FCM notification formatting
- Fallback to legacy fcmToken field
- Returns success/failure counts

**Usage**:
```javascript
const functions = getFunctions();
const sendTestNotif = httpsCallable(functions, 'sendTestNotification');
const result = await sendTestNotif({ userId, userName });
```

## User Flow

### For Administrators:
1. Navigate to User Management page
2. Locate user in the list (mobile card or desktop table)
3. Click notification bell icon next to user's name
4. **Device Dialog Opens** showing:
   - All registered devices
   - Device type icons (iPhone/Android/Desktop)
   - Device details (OS, browser, status)
   - Enabled/Disabled status
   - Last used timestamp
5. Click "Send Test Notification" button
6. Dialog closes and notification is sent
7. Success message shows how many devices received the notification

### Device Information Displayed:
- **Device Type**: Mobile (iPhone/Android) or Desktop/Laptop
- **Operating System**: iOS, Android, Windows, macOS, etc.
- **Browser**: Chrome, Safari, Firefox, etc.
- **Status**: Enabled ✓ or Disabled ✗
- **Last Used**: Timestamp of last device activity

## Technical Details

### Device Detection Logic
```javascript
const getDeviceIcon = (deviceType, os) => {
  const osLower = (os || '').toLowerCase();
  const typeLower = (deviceType || '').toLowerCase();
  
  if (osLower.includes('ios') || osLower.includes('iphone') || osLower.includes('ipad')) {
    return <PhoneIphoneIcon />;
  } else if (osLower.includes('android')) {
    return <PhoneAndroidIcon />;
  } else if (typeLower.includes('mobile')) {
    return <PhoneAndroidIcon />;
  } else if (typeLower.includes('desktop') || typeLower.includes('laptop')) {
    return <LaptopIcon />;
  }
  return <DevicesIcon />;
};
```

### Device Fetching Process
1. Query `users/{userId}/devices` subcollection
2. Extract device information:
   - Token (document ID)
   - Enabled status (default: true)
   - Device type
   - Browser
   - OS
   - Registration timestamp
   - Last used timestamp
3. If no devices found, check legacy `fcmToken` field
4. Display all devices in dialog

### Notification Sending Process
1. User clicks "Send Test Notification" in dialog
2. Frontend calls Firebase callable function
3. Backend retrieves all enabled tokens
4. Creates platform-specific notification payloads:
   - **iOS**: APNS format with `apns.payload.aps.alert`
   - **Android**: FCM format with `android.notification`
   - **Web**: Standard FCM with webpush config
5. Sends notifications via FCM
6. Returns success/failure counts
7. Frontend displays result to user

## Firestore Structure

### User Document
```
users/{userId}
├── fcmToken: "legacy-token" (optional, deprecated)
├── role: "Admin"
├── email: "user@example.com"
└── devices (subcollection)
    ├── {token1}
    │   ├── enabled: true
    │   ├── deviceType: "Mobile"
    │   ├── os: "iOS 17.1"
    │   ├── browser: "Safari"
    │   ├── registeredAt: Timestamp
    │   └── lastUsed: Timestamp
    └── {token2}
        ├── enabled: true
        ├── deviceType: "Desktop"
        ├── os: "Windows 11"
        ├── browser: "Chrome"
        ├── registeredAt: Timestamp
        └── lastUsed: Timestamp
```

## Benefits

### For Administrators:
- **Visibility**: See exactly which devices a user has registered
- **Debugging**: Identify device issues (disabled devices, stale tokens)
- **Testing**: Verify notifications work before sending real alerts
- **Transparency**: Know which devices will receive notifications

### For Users:
- **Accountability**: Admins can see and verify device registrations
- **Support**: Easier troubleshooting when notifications don't work
- **Testing**: Admins can test notifications without sending fake alerts

### For Support Teams:
- **Diagnostics**: Quickly identify device registration issues
- **Validation**: Verify notifications work on specific device types
- **Troubleshooting**: See device status, OS, browser information

## UI Screenshots Description

### Desktop View:
- Table with user rows
- Notification bell icon in rightmost column
- Tooltip: "View Devices & Send Test Notification"
- Loading spinner while sending

### Mobile View:
- Card layout with user information
- Notification bell icon in top-right of card
- Same tooltip and functionality as desktop

### Device Dialog:
- Title: "Devices for {userName}"
- List of devices with:
  - Icon (iPhone/Android/Laptop)
  - Device type and OS
  - Enabled/Disabled status icon
  - Browser information
  - Last used timestamp
- Buttons:
  - Cancel (close dialog)
  - Send Test Notification (primary action)

## Testing Checklist

- [ ] Desktop view shows notification icon
- [ ] Mobile view shows notification icon
- [ ] Click icon opens device dialog
- [ ] Dialog shows all user devices
- [ ] Correct icons display for iPhone/Android/Desktop
- [ ] Enabled/Disabled status shows correctly
- [ ] Device details (OS, browser, last used) display
- [ ] "Send Test Notification" button works
- [ ] Loading state shows while sending
- [ ] Success message shows correct device count
- [ ] Test notification received on iPhone
- [ ] Test notification received on Android
- [ ] Test notification received on Web
- [ ] iOS notification shows title and body (not raw JSON)
- [ ] Android notification formatted correctly
- [ ] No duplicate notifications sent
- [ ] Dialog closes after sending
- [ ] Error handling works for users with no devices

## Future Enhancements

### Potential Features:
1. **Selective Device Notification**: Allow sending test to specific device instead of all
2. **Device Management**: Enable/disable devices directly from dialog
3. **Device Removal**: Delete stale/invalid tokens
4. **Device Naming**: Let users name their devices ("iPhone 14", "Work Laptop")
5. **Notification History**: Show which notifications were sent to which devices
6. **Device Statistics**: Show notification delivery success rate per device
7. **Push Token Validation**: Verify tokens are still valid before sending
8. **Bulk Testing**: Send test notification to multiple users at once

## Related Files

### Frontend:
- `src/pages/UserManagement.jsx` - Main component with device dialog

### Backend:
- `functions/sendTestNotification.js` - Callable function for test notifications
- `functions/index.js` - Exports sendTestNotification

### Documentation:
- `docs/DUPLICATE_NOTIFICATION_FIX.md` - Original notification fix
- `docs/NOTIFICATION_UPDATES_OCT11.md` - Role filtering removal
- `docs/IOS_NOTIFICATION_FIX.md` - iOS APNS payload fix

## Security Considerations

1. **Authentication**: Function requires authenticated user (Firebase Auth)
2. **Authorization**: Only admins can access User Management page
3. **Rate Limiting**: Firebase callable functions have built-in rate limiting
4. **Token Privacy**: Device tokens not exposed in UI (only device info shown)
5. **Data Validation**: Function validates userId parameter before execution

## Performance Considerations

1. **Batch Processing**: Sends notifications to all devices in single batch
2. **Lazy Loading**: Devices only fetched when dialog opened
3. **Caching**: Device data not cached (always fetched fresh)
4. **Memory**: Limited to 256MiB for sendTestNotification function
5. **Concurrent Instances**: Global limit of 10 concurrent function instances

## Error Handling

### Frontend:
- Shows snackbar error if device fetch fails
- Shows snackbar error if notification send fails
- Displays "No devices registered" if user has no devices
- Disables "Send" button if no devices available

### Backend:
- Validates userId parameter
- Handles missing device tokens gracefully
- Falls back to legacy fcmToken if devices subcollection empty
- Returns detailed error messages
- Logs errors to Firebase Functions logs

## Deployment

### Deploy Functions:
```bash
firebase deploy --only functions:sendTestNotification
```

### Deploy Full App:
```bash
npm run build
firebase deploy
```

### Verify Deployment:
1. Check Firebase Console > Functions
2. Verify `sendTestNotification` is deployed
3. Test from User Management page
4. Check Firebase Functions logs for errors

## Support & Troubleshooting

### Common Issues:

**Dialog doesn't open**:
- Check browser console for errors
- Verify Firebase initialized correctly
- Check user permissions

**No devices shown**:
- User may not have registered any devices
- Check Firestore console for devices subcollection
- Verify user has enabled notifications

**Notification not received**:
- Check device has notifications enabled
- Verify FCM token is valid
- Check Firebase Functions logs
- Verify device status is "enabled"

**iOS shows raw JSON**:
- Ensure using latest version with APNS fix
- Check sendTestNotification.js has createIOSNotification helper
- Verify apns.payload structure is correct

## Conclusion

This feature provides essential visibility into the notification system, helping administrators understand which devices are registered, verify notification delivery, and troubleshoot issues effectively. It integrates seamlessly with the existing notification infrastructure while providing enhanced user experience for both administrators and end users.
