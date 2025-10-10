// MOVED TO docs/archive/CALENDAR_UI_FIX.md
# Calendar Page Mobile UI Fix

## Changes Made

### Issue 1: Add Event Button Visibility
**Problem:** The "Add Event" button (FAB) was only visible to users with `canEditEvents` permission (Admin, Quality, Evaluator) on mobile devices.

**Solution:** Removed the `canEditEvents` check for both mobile and desktop views so **all authenticated users** can create events/tasks.

#### Before:
```jsx
// Desktop
{!isMobile && canEditEvents && (
  <Button>Create New Event/Task</Button>
)}

// Mobile
{isMobile && canEditEvents && (
  <Fab>+</Fab>
)}
```

#### After:
```jsx
// Desktop - all users can see the button
{!isMobile && (
  <Button>Create New Event/Task</Button>
)}

// Mobile - all users can see the FAB
{isMobile && (
  <Fab>+</Fab>
)}
```

**Rationale:** 
- All users should be able to create events/tasks for collaboration
- The Firestore security rules already handle write permissions appropriately
- Mobile users need the FAB for better UX (desktop has more space for the button)

### Issue 2: FCM Token Updates
**Status:** ✅ Already Working Correctly

The Firestore rules already allow all authenticated users to update their FCM tokens through two mechanisms:

#### 1. User Document Updates
Users can update notification-related fields in their own user document:
```javascript
function isSelfNotificationUpdate() {
  return request.resource.data.diff(resource.data).changedKeys().hasOnly([
    'fcmToken',
    'notificationsEnabled',
    'lastTokenUpdate',
    'notificationPreferences'
  ]);
}
```

#### 2. Devices Subcollection
Users can fully manage their device tokens in `/users/{userId}/devices/{deviceId}`:
```javascript
match /devices/{deviceId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**No changes needed** - all users can already store and update FCM tokens.

## UI Behavior Summary

### Desktop View
- **All Users:** See "Create New Event/Task" button in the header
- Button is always visible regardless of role

### Mobile View
- **All Users:** See floating action button (FAB) with "+" icon in bottom-right corner
- FAB is fixed position and always accessible for quick event creation

## Testing Instructions

### Test Add Event Button (All Roles)
1. Log in as different user roles:
   - Admin
   - Quality
   - Evaluator
   - Coordinator
   - Management

2. **On Desktop (width > 900px):**
   - Navigate to Calendar page
   - Verify "Create New Event/Task" button is visible in the header
   - Click button to open event creation dialog

3. **On Mobile (width ≤ 900px) or resize browser:**
   - Navigate to Calendar page
   - Verify floating "+" button appears in bottom-right corner
   - Click button to open event creation dialog
   - Verify button stays fixed when scrolling

### Test FCM Token Storage (All Roles)
1. Log in as any user role
2. Open browser console (F12)
3. Check for FCM token registration logs
4. Verify no permission errors when:
   - Requesting notification permission
   - Storing FCM token
   - Updating token on refresh

## Notes

- The event creation form will still respect backend validation and permissions
- Users can create events, but certain operations (edit, delete) may still be role-restricted
- This change improves collaboration by allowing all team members to add tasks/events
- The FAB on mobile matches the UX pattern used on the Mentors page
