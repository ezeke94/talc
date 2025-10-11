# Notification Deduplication & History System

## Problem Solved
Users were receiving duplicate notifications on their devices because:
1. Notifications could be received by both background service worker AND foreground app
2. When app is opened, it might process a notification that was already shown
3. No tracking of which notifications have been displayed

## Solution Implemented

### 1. Client-Side Deduplication
**Location**: Service Worker + Foreground App

**How it works**:
- Generate unique ID for each notification based on type, eventId, title, and body
- Track notification IDs with timestamps in localStorage
- 10-second deduplication window
- If same notification arrives twice within 10 seconds, second one is blocked

**Files Modified**:
- `public/firebase-messaging-sw.js` - Background notification deduplication
- `src/utils/notifications.js` - Foreground notification deduplication
- `src/utils/notificationHistory.js` - NEW - Deduplication logic and history management

### 2. Notification History
**Storage**: LocalStorage (per device)

**Features**:
- Stores last 100 notifications received on this device
- Tracks: title, body, type, timestamp, read status, source
- Source tracking: 'background', 'foreground', 'app-open'
- Unread count
- Mark as read/unread
- Delete individual notifications
- Clear all history

### 3. User Interface
**Components Created**:
- `src/components/NotificationHistoryDialog.jsx` - Full notification history viewer
- `src/components/NotificationBell.jsx` - Bell icon with unread badge

**Features**:
- View all past notifications
- Click notification to navigate to related page
- Mark all as read
- Delete individual notifications
- Clear all history
- Shows time ago (e.g., "2h ago", "3d ago")
- Shows notification source (background/foreground)
- Unread badge on bell icon

## Technical Implementation

### Deduplication Flow

#### Background Notification (App Closed/Background):
```
1. Firebase sends notification
2. Service worker receives it
3. Generate notification ID
4. Check if duplicate (within 10s)
   - YES → Block, don't show
   - NO → Show notification + save to history
5. Post message to app (if open) about notification
```

#### Foreground Notification (App Open):
```
1. Firebase sends notification
2. onMessage handler receives it
3. Generate notification ID
4. Check if duplicate (within 10s)
   - YES → Block, don't show
   - NO → Save to history + forward to service worker
5. Service worker shows system notification
```

#### App Opens with Pending Notification:
```
1. User opens app
2. Notification might arrive simultaneously
3. Both background AND foreground might try to show it
4. Deduplication prevents double display
5. Only first one (within 10s window) is shown
```

### Notification ID Generation

Format: `{type}-{eventId}-{title}-{body}`

Example:
- `event_create-abc123-New Event Created-Event scheduled for tomorrow`
- `event_delete-xyz789-Event Deleted-Event Test Event removed`

### LocalStorage Structure

#### Deduplication Data
Key: `talc_notification_dedup`
```javascript
{
  "event_create-abc123-...": {
    "timestamp": 1697123456789,
    "source": "background"
  },
  "event_delete-xyz789-...": {
    "timestamp": 1697123460000,
    "source": "foreground"
  }
}
```

#### Notification History
Key: `talc_notification_history`
```javascript
[
  {
    "id": "event_create-abc123-...",
    "title": "New Event Created",
    "body": "Event scheduled for tomorrow",
    "type": "event_create",
    "eventId": "abc123",
    "url": "/calendar",
    "timestamp": 1697123456789,
    "read": false,
    "source": "background"
  },
  {
    "id": "event_delete-xyz789-...",
    "title": "Event Deleted",
    "body": "Event Test Event removed",
    "type": "event_delete",
    "eventId": "xyz789",
    "url": "/calendar",
    "timestamp": 1697123460000,
    "read": true,
    "source": "foreground"
  }
]
```

## Usage

### Add Notification Bell to Navbar

```jsx
import NotificationBell from './components/NotificationBell';

function Navbar() {
  return (
    <AppBar>
      <Toolbar>
        {/* Other navbar items */}
        <NotificationBell />
      </Toolbar>
    </AppBar>
  );
}
```

### Programmatically Access History

```javascript
import { 
  getNotificationHistory,
  getUnreadCount,
  markAsRead,
  saveNotificationToHistory 
} from './utils/notificationHistory';

// Get all notifications
const history = getNotificationHistory();

// Get unread count
const unread = getUnreadCount();

// Mark notification as read
markAsRead(notificationId);

// Manually save notification
saveNotificationToHistory({
  notification: { title: 'Test', body: 'Test body' },
  data: { type: 'test', eventId: '123', url: '/' },
  source: 'manual'
});
```

## Benefits

### For Users:
✅ **No More Duplicates**: Each notification shown only once
✅ **Notification History**: View all past notifications even if dismissed
✅ **Unread Tracking**: Know which notifications you haven't seen
✅ **Easy Navigation**: Click notification to go to related page
✅ **Device-Specific**: History stored per device (not synced across devices)

### For iPhone Users:
✅ **Works in Background**: Notifications work even when app is closed
✅ **Works in Foreground**: Notifications work when app is open
✅ **Proper iOS Format**: Uses correct APNS payload structure
✅ **No Duplicates**: Deduplication works across background/foreground

### For Android Users:
✅ **System Notifications**: Shows as native Android notifications
✅ **Background Support**: Works when app is closed
✅ **Foreground Support**: Works when app is open
✅ **No Duplicates**: Deduplication prevents double notifications

## Testing Checklist

### Test Duplicate Prevention:
- [ ] Send test notification with app closed → Should receive 1 notification
- [ ] Send test notification with app open → Should receive 1 notification (not 2)
- [ ] Open app while notification arrives → Should receive 1 notification (not 2)
- [ ] Send same notification twice quickly → Should receive 1 notification (second blocked)

### Test Notification History:
- [ ] Click bell icon → History dialog opens
- [ ] Receive notification → Appears in history
- [ ] Click notification in history → Navigates to correct page
- [ ] Mark as read → Notification marked read
- [ ] Delete notification → Removed from history
- [ ] Clear all → All history cleared
- [ ] Unread badge → Shows correct count

### Test Cross-Platform:
- [ ] iPhone (PWA) → Background notifications work
- [ ] iPhone (PWA) → Foreground notifications work
- [ ] iPhone (PWA) → No duplicates
- [ ] Android → Background notifications work
- [ ] Android → Foreground notifications work
- [ ] Android → No duplicates
- [ ] Desktop Web → Notifications work
- [ ] Desktop Web → No duplicates

## Configuration

### Deduplication Window
Default: 10 seconds

To change:
```javascript
// In src/utils/notificationHistory.js
const DEDUP_WINDOW_MS = 10000; // Change to desired milliseconds
```

### History Limit
Default: 100 notifications

To change:
```javascript
// In src/utils/notificationHistory.js
const MAX_HISTORY_ITEMS = 100; // Change to desired limit
```

## Troubleshooting

### Still Seeing Duplicates?
1. Check browser console for deduplication logs
2. Look for: `[NotifHistory] Duplicate detected` messages
3. Verify deduplication window is appropriate
4. Clear localStorage and test again

### History Not Saving?
1. Check localStorage isn't disabled
2. Verify localStorage quota (usually 5-10MB)
3. Check browser console for errors
4. Try clearing history and starting fresh

### Unread Count Wrong?
1. Open notification history dialog
2. Click "Mark all as read"
3. Refresh page
4. Check if count updates

## Future Enhancements

### Potential Features:
1. **Sync Across Devices**: Store history in Firestore instead of localStorage
2. **Notification Filters**: Filter by type, date range, read status
3. **Search**: Search notification history
4. **Export**: Export notification history as CSV/JSON
5. **Notification Groups**: Group related notifications (e.g., all event updates)
6. **Custom Sounds**: Different sounds for different notification types
7. **Quiet Hours**: Don't show notifications during specified hours
8. **Priority Levels**: Important notifications always show, others can be batched

## Related Files

### Core Files:
- `src/utils/notificationHistory.js` - History management and deduplication logic
- `public/firebase-messaging-sw.js` - Background notification handling
- `src/utils/notifications.js` - Foreground notification handling

### UI Components:
- `src/components/NotificationHistoryDialog.jsx` - History viewer dialog
- `src/components/NotificationBell.jsx` - Bell icon with badge

### Documentation:
- `docs/NOTIFICATION_DEDUP_COMPLETE.md` - This file
- `docs/IOS_NOTIFICATION_FIX.md` - iOS-specific notification fixes
- `docs/NOTIFICATION_SYSTEM_COMPLETE.md` - Overall notification system

## Deployment

```bash
# Build the app
npm run build

# Deploy to Firebase
firebase deploy

# Or just deploy hosting (if functions already deployed)
firebase deploy --only hosting
```

## Conclusion

This implementation solves the duplicate notification problem by tracking notifications on the client side, providing users with a complete notification history, and ensuring notifications work correctly across all platforms (iPhone, Android, Desktop) without duplicates.
