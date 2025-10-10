# Device Registration UI for Notifications

## Overview
Enhanced notification settings to display all registered devices and allow users to name and manage their devices.

## Features Implemented

### 1. Device Naming
- **Enable Notifications with Name**: When users enable notifications, they are prompted to name their device
- **Auto-Generated Suggestions**: System suggests a default name based on OS and browser (e.g., "Windows - Chrome")
- **Optional Naming**: Users can skip naming and use the auto-generated name
- **Edit Device Names**: Users can edit device names after registration using the edit button

### 2. Device List Display
Shows all registered devices with:
- **Device Icon**: Visual indicator (Desktop, Mobile, or Tablet)
- **Device Name**: Custom name or auto-generated identifier
- **Current Device Badge**: Highlights the device currently being used
- **Last Active**: Shows when the device was last seen
- **Platform Info**: Displays the platform name

### 3. Device Management Actions
- **Enable/Disable**: Toggle notifications on/off per device
- **Edit Name**: Change device name anytime
- **Remove Device**: Delete devices no longer in use (with confirmation)
- **Refresh**: Reload device list to see latest updates

## User Interface Components

### Main Settings Card
```
┌─────────────────────────────────────────┐
│ Push Notifications                      │
├─────────────────────────────────────────┤
│ [Toggle] Notifications are ON/OFF      │
│ Description text                        │
├─────────────────────────────────────────┤
│ Registered Devices           [Refresh] │
├─────────────────────────────────────────┤
│ 🖥️ My Work Laptop        [This Device] │
│    Last active: 2 minutes ago           │
│    Platform: MacIntel                   │
│                   [Edit] [Toggle] [Del] │
├─────────────────────────────────────────┤
│ 📱 My iPhone                            │
│    Last active: 1 hour ago              │
│    Platform: iPhone                     │
│                   [Edit] [Toggle] [Del] │
└─────────────────────────────────────────┘
```

### Device Name Dialog
When enabling notifications or editing a device name:
```
┌─────────────────────────────────────────┐
│ Name This Device                        │
├─────────────────────────────────────────┤
│ Give this device a name to help you     │
│ identify it later.                      │
│                                         │
│ Device Name:                            │
│ ┌─────────────────────────────────────┐ │
│ │ My Laptop                           │ │
│ └─────────────────────────────────────┘ │
│ Leave blank to use auto-generated name  │
│                                         │
│              [Cancel] [Enable Notif...] │
└─────────────────────────────────────────┘
```

## Files Modified

### 1. `src/components/NotificationSettings.jsx`
**Changes:**
- Added device name dialog state management
- Added device naming flow when enabling notifications
- Added edit device name functionality
- Added device list UI with icons and management controls
- Added refresh functionality

**New Features:**
- Device name dialog (prompt and edit modes)
- Edit button for each device
- Visual device type indicators
- "This Device" badge for current device

### 2. `src/utils/notifications.js`
**Changes:**
- Updated `setupNotifications()` to accept optional `deviceName` parameter
- Stores device name in Firestore devices subcollection
- Stores FCM token in localStorage for device identification
- Removes token from localStorage when disabling notifications

### 3. `src/utils/deviceManager.js` (New File)
**Purpose:** Centralized device management utilities

**Functions:**
- `getUserDevices(userId)` - Fetch all devices for a user
- `parseDeviceInfo(userAgent)` - Parse browser, OS, and device type
- `getDeviceName(deviceData)` - Get friendly device name (custom or auto-generated)
- `updateDeviceName(userId, deviceToken, name)` - Update device name
- `toggleDevice(userId, deviceToken, enabled)` - Enable/disable device
- `removeDevice(userId, deviceToken)` - Delete device
- `isCurrentDevice(token)` - Check if token matches current device
- `formatDeviceDate(timestamp)` - Format timestamp as relative time

## Data Structure

### Firestore: `users/{userId}/devices/{token}`
```javascript
{
  token: "fcm_token_string",
  name: "My Work Laptop",           // Optional, user-provided name
  platform: "MacIntel",              // Navigator platform
  userAgent: "Mozilla/5.0...",       // Full user agent string
  createdAt: Timestamp,              // When device was first registered
  lastSeenAt: Timestamp,             // Last time device was active
  enabled: true                      // Whether notifications are enabled
}
```

### LocalStorage
```javascript
fcmToken: "fcm_token_string"  // Current device's FCM token
```

## User Workflow

### Enabling Notifications
1. User clicks notification toggle switch
2. Dialog appears asking for device name
3. System suggests default name (e.g., "Windows - Chrome")
4. User can customize name or leave as-is
5. User clicks "Enable Notifications"
6. Permission requested (if needed)
7. FCM token generated and saved
8. Device registered with name
9. Device list updates showing new device

### Editing Device Name
1. User clicks edit icon next to device
2. Dialog appears with current name
3. User updates the name
4. Clicks "Update"
5. Device name updated in Firestore
6. UI refreshes showing new name

### Managing Multiple Devices
- Users can enable notifications on multiple devices
- Each device appears in the list with its custom name
- Current device is highlighted with "This Device" badge
- Users can disable/remove old devices independently

## Benefits

### User Experience
- **Easy Identification**: Users can identify which device is which
- **Better Control**: Manage notifications per device
- **Clarity**: Know which devices are receiving notifications
- **Security**: Remove old/lost devices from notification list

### Technical
- **Multi-Device Support**: Full support for users with multiple devices
- **Audit Trail**: Track when devices were added and last active
- **Flexible Naming**: Auto-generated names with custom override
- **Clean Architecture**: Separated device management logic

## Device Icons
- 🖥️ **Desktop**: ComputerIcon (Windows, macOS, Linux desktops)
- 📱 **Mobile**: PhoneAndroidIcon (Mobile phones)
- 📱 **Tablet**: TabletIcon (Tablets, iPads)

## Auto-Generated Names

### Format
`{OS} - {Browser} ({Device Type})`

### Examples
- "Windows - Chrome (Desktop)"
- "Android - Chrome (Mobile)"
- "macOS - Safari (Desktop)"
- "iOS - Safari (Mobile)"

## Testing Checklist

- [ ] Enable notifications with custom name
- [ ] Enable notifications with default name
- [ ] Enable notifications without name (blank)
- [ ] Edit device name
- [ ] Toggle device on/off
- [ ] Remove device (not current)
- [ ] Remove device (current device)
- [ ] Multiple devices show correctly
- [ ] Current device badge appears
- [ ] Refresh updates device list
- [ ] Device icons match device type
- [ ] Last active time updates
- [ ] Dialog keyboard navigation (Enter to submit)

## Future Enhancements

### Potential Features
1. **Device Groups**: Group devices by location (Home, Work, etc.)
2. **Notification Preferences Per Device**: Different settings per device
3. **Device Sync Status**: Show if device is online/offline
4. **Push Test**: Send test notification to specific device
5. **Device Limits**: Limit number of devices per user
6. **Auto-Cleanup**: Remove devices not seen in 90+ days
7. **Device Verification**: Require re-verification after long inactivity

## Security Considerations

- Device tokens are stored securely in Firestore
- Users can only view/manage their own devices
- Current device cannot be removed (prevents lockout)
- Confirmation required before device removal
- Device data includes audit timestamps

## Accessibility

- All buttons have aria-labels
- Icons have tooltips
- Keyboard navigation supported
- Enter key submits dialog
- Focus management in dialogs
- Screen reader friendly labels

## Browser Compatibility

Works on all browsers that support:
- Firebase Cloud Messaging
- Web Push API
- Service Workers
- LocalStorage

## Performance

- Devices loaded once on component mount
- Manual refresh available
- Efficient Firestore queries with ordering
- Minimal re-renders with proper state management
