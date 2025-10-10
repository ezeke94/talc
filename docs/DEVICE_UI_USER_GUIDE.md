# Device Registration UI - Quick Guide

## What's New

### Before
- Simple toggle switch for notifications ON/OFF
- No visibility into registered devices
- No way to manage multiple devices

### After
- **Device naming** when enabling notifications
- **Device list** showing all registered devices
- **Device management** (edit name, toggle, remove)
- **Visual indicators** (icons, badges, status)

## Screenshots Description

### 1. Notification Settings Page

When you open notification settings, you'll see:

```
┌────────────────────────────────────────────────────────────────┐
│  Push Notifications                                            │
│                                                                │
│  ⚠️ Notifications are blocked. Please allow notifications      │
│     in your browser settings.                                 │
│                                                                │
│  ○ Notifications are OFF                                      │
│  Toggle to receive or stop important reminders about events,  │
│  KPIs, and system updates.                                    │
│                                                                │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  Registered Devices                                    🔄      │
│                                                                │
│  🖥️  My Work Laptop                      [This Device]        │
│      Last active: Just now                                    │
│      Platform: Win32                                          │
│                                    ✏️  ⚪ ON                   │
│                                                                │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  📱  John's iPhone                                            │
│      Last active: 3 hours ago                                 │
│      Platform: iPhone                                         │
│                                    ✏️  ⚪ ON   🗑️             │
│                                                                │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│  🖥️  Windows - Chrome (Desktop)                               │
│      Last active: 2 days ago                                  │
│      Platform: Win32                                          │
│                                    ✏️  ⚪ OFF  🗑️             │
│                                                                │
│  You can enable/disable notifications per device or remove    │
│  devices you no longer use.                                   │
└────────────────────────────────────────────────────────────────┘
```

### 2. Enable Notifications Dialog

When you click to enable notifications, you see:

```
┌─────────────────────────────────────────────────────┐
│  Name This Device                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Give this device a name to help you identify it   │
│  later (e.g., "Work Laptop", "Home Desktop",       │
│  "iPhone").                                         │
│                                                     │
│  Device Name                                        │
│  ┌───────────────────────────────────────────────┐ │
│  │ Windows - Chrome                              │ │
│  └───────────────────────────────────────────────┘ │
│  Leave blank to use auto-generated name            │
│                                                     │
│                     [Cancel] [Enable Notifications] │
└─────────────────────────────────────────────────────┘
```

### 3. Edit Device Name Dialog

When you click the edit icon (✏️):

```
┌─────────────────────────────────────────────────────┐
│  Edit Device Name                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Update the name for this device to help you       │
│  identify it later.                                 │
│                                                     │
│  Device Name                                        │
│  ┌───────────────────────────────────────────────┐ │
│  │ My Work Laptop                                │ │
│  └───────────────────────────────────────────────┘ │
│  Leave blank to use auto-generated name            │
│                                                     │
│                              [Cancel] [Update]      │
└─────────────────────────────────────────────────────┘
```

## Usage Instructions

### Enable Notifications on a New Device
1. Go to **Settings** or **Profile Settings**
2. Find the **Push Notifications** card
3. Click the toggle switch to enable
4. A dialog will appear asking you to name the device
5. Enter a custom name (e.g., "My Laptop") or use the suggested name
6. Click **Enable Notifications**
7. Allow notifications in your browser when prompted
8. The device will appear in the "Registered Devices" list

### Edit Device Name
1. Find the device in the "Registered Devices" list
2. Click the **edit icon** (✏️) next to the device
3. Update the name in the dialog
4. Click **Update**

### Disable Notifications on a Device
1. Find the device in the list
2. Toggle the switch next to it to **OFF**
3. The device stays registered but won't receive notifications

### Remove a Device
1. Find the device in the list (cannot be the current device)
2. Click the **delete icon** (🗑️)
3. Confirm the removal
4. The device is permanently removed

### Identify Your Current Device
- Your current device will have a **"This Device"** badge
- The current device cannot be removed (you can disable it instead)

## Icons Reference

- **🖥️ Desktop Icon**: Windows, Mac, Linux computers
- **📱 Phone Icon**: Smartphones (Android, iPhone)
- **📱 Tablet Icon**: Tablets and iPads
- **✏️ Edit Icon**: Click to edit device name
- **🗑️ Delete Icon**: Click to remove device
- **🔄 Refresh Icon**: Click to reload device list
- **⚪ Switch**: Toggle notifications on/off for that device

## Tips

### Good Device Names
✅ "Work Laptop"
✅ "Home Desktop"  
✅ "iPhone 14"
✅ "Kitchen Tablet"
✅ "Gaming PC"

### Not Recommended
❌ "Device 1"
❌ "asdfgh"
❌ Just numbers
❌ Very long names

### Best Practices
- Use descriptive names that help you identify the device
- Include location or purpose (Work, Home, Travel)
- Update names if you repurpose a device
- Remove old devices you no longer use
- Keep at least one device enabled to receive notifications

## Troubleshooting

### Can't see my device
- Click the refresh icon (🔄)
- Make sure notifications are enabled
- Check that you're logged in

### Device shows "Unknown"
- This means the device information couldn't be parsed
- You can edit the name to something more descriptive

### Can't remove current device
- The device you're currently using cannot be removed
- If you want to stop notifications, toggle it off instead
- Remove it from another device

### Last active shows "Unknown"
- The device was registered before this feature was added
- It will update when the device next receives a notification

## Privacy & Security

- Only you can see your registered devices
- Device information includes browser and OS (for identification)
- Tokens are securely stored in Firebase
- Removing a device permanently deletes its data
- No personal information is exposed

## Mobile vs Desktop

### Desktop Browsers
- Usually show as "Desktop" devices
- Icons: 🖥️ Computer icon
- Platform: Win32, MacIntel, Linux, etc.

### Mobile Browsers
- Show as "Mobile" or "Tablet"
- Icons: 📱 Phone or Tablet icon
- Platform: iPhone, Android, iPad, etc.

### PWA (Progressive Web App)
- If installed as PWA, appears as separate device
- Can have different name than browser version
- Recommended to name distinctly (e.g., "iPhone - PWA")

## Common Scenarios

### Multiple Work Devices
```
🖥️ Office Desktop
💻 Work Laptop
📱 Work iPhone
```

### Home and Work
```
🖥️ Home PC [This Device]
💻 Work Laptop
📱 Personal Phone
```

### Shared Device
```
💻 Shared Family Laptop
📱 My Personal Phone [This Device]
```

## Keyboard Shortcuts

- **Enter** in device name dialog: Submit
- **Escape**: Close dialog
- **Tab**: Navigate between fields

## What Happens When...

### You enable notifications
1. Dialog appears to name device
2. Permission requested (if first time)
3. FCM token generated
4. Device saved to database
5. Notifications start working

### You disable notifications
1. Notifications stop immediately
2. Device stays in list (disabled)
3. Can re-enable anytime

### You remove a device
1. Confirmation dialog appears
2. Device permanently deleted
3. Cannot receive notifications
4. Must re-enable to add back

### You edit device name
1. Dialog with current name appears
2. Update and save
3. Name changes immediately
4. No impact on notifications
