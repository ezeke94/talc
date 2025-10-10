// MOVED TO docs/archive/EVENT_CREATION_PERMISSIONS_FIX.md
# Calendar Event Creation Fix - All Users

## Problem
The "Create Event" button was visible to all users on the Calendar page, but only Admin users could actually create events. Other users (Evaluator, Coordinator, Quality, Management) would get permission errors when trying to save events.

## Root Cause
The Firestore security rules had overly restrictive conditions:

### Old Rules (Problematic)
```javascript
// Events collection
match /events/{eventId} {
  allow update: if isEvaluator() && isTickUpdate();
  allow update, delete: if !isEvaluator();  // ❌ This was failing
  allow create: if request.auth != null;
  allow read: if request.auth != null;
}
```

**Issue:** The `allow update, delete: if !isEvaluator();` rule was too broad and would fail for users whose role couldn't be looked up, or who didn't have Admin permissions to read the users collection.

## Solution

### Updated Firestore Rules

#### Events Collection
```javascript
// Events collection
match /events/{eventId} {
  // All authenticated users can read events
  allow read: if request.auth != null;
  
  // All authenticated users can create events ✅
  allow create: if request.auth != null;
  
  // Users can update events they created OR admins/quality can update any ✅
  allow update: if request.auth != null && 
    (resource.data.createdBy.userId == request.auth.uid || isAdmin() || isQuality());
  
  // Only admins and quality can delete events ✅
  allow delete: if request.auth != null && (isAdmin() || isQuality());
}
```

**Benefits:**
- ✅ **All users can create events** - Encourages collaboration
- ✅ **Users can edit their own events** - Allows self-service updates
- ✅ **Admins/Quality have full control** - Can edit/delete any event
- ✅ **Prevents accidental deletions** - Only admins can delete

#### SOPs Collection
Also updated for consistency:
```javascript
// SOPs collection
match /sops/{sopId} {
  // All authenticated users can read SOPs
  allow read: if request.auth != null;
  
  // All authenticated users can create SOPs
  allow create: if request.auth != null;
  
  // Only admins and quality can update/delete SOPs
  allow update, delete: if request.auth != null && (isAdmin() || isQuality());
}
```

### Helper Functions Added
```javascript
function isAdmin() { /* checks for Admin role */ }
function isQuality() { /* checks for Quality role */ }
function isCoordinator() { /* checks for Coordinator role */ }
function isEvaluator() { /* checks for Evaluator role */ }
function isManagement() { /* checks for Management role */ }
```

## Permissions Matrix

### Events Collection

| User Role    | Create | Read | Update Own | Update Any | Delete Any |
|--------------|--------|------|------------|------------|------------|
| Admin        | ✅     | ✅   | ✅         | ✅         | ✅         |
| Quality      | ✅     | ✅   | ✅         | ✅         | ✅         |
| Coordinator  | ✅     | ✅   | ✅         | ❌         | ❌         |
| Evaluator    | ✅     | ✅   | ✅         | ❌         | ❌         |
| Management   | ✅     | ✅   | ✅         | ❌         | ❌         |

### SOPs Collection

| User Role    | Create | Read | Update | Delete |
|--------------|--------|------|--------|--------|
| Admin        | ✅     | ✅   | ✅     | ✅     |
| Quality      | ✅     | ✅   | ✅     | ✅     |
| Coordinator  | ✅     | ✅   | ❌     | ❌     |
| Evaluator    | ✅     | ✅   | ❌     | ❌     |
| Management   | ✅     | ✅   | ❌     | ❌     |

## Testing Instructions

### Test Event Creation (All Roles)

1. **Log in as different roles:**
   - Coordinator
   - Evaluator
   - Management
   - Quality
   - Admin

2. **Create an event:**
   - On mobile: Click the floating "+" button (bottom-right)
   - On desktop: Click "Create New Event/Task" button
   - Fill out the event form
   - Click Save

3. **Expected Result:**
   - ✅ Event should save successfully
   - ✅ Should appear in the calendar list
   - ✅ No permission errors in console

### Test Event Updates

1. **As the event creator (non-admin):**
   - Open an event you created
   - Modify the title or description
   - Save changes
   - ✅ Should save successfully

2. **Try to edit someone else's event (non-admin):**
   - Open an event created by another user
   - Try to save changes
   - ❌ Should see a permission error (expected behavior)

3. **As Admin/Quality:**
   - Open any event
   - Modify and save
   - ✅ Should save successfully (can edit any event)

### Test Event Deletion

1. **As non-admin user:**
   - Try to delete an event
   - ❌ Delete button should not be visible (or fail if accessed)

2. **As Admin/Quality:**
   - Delete button should be visible
   - Click delete
   - ✅ Event should be deleted successfully

## Browser Console Verification

After creating an event, check the browser console (F12):
- ✅ No "permission-denied" errors
- ✅ Should see the event document created
- ✅ Should see `createdBy` field with your user ID

## Rollback Instructions

If you need to revert these changes:

```bash
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules
```

## Notes

- The rules now properly allow collaborative event creation
- Users can manage their own events
- Admins/Quality maintain oversight with full edit/delete permissions
- The UI already had the buttons visible - we just fixed the backend permissions
- FCM token updates were already working correctly (no changes needed)
