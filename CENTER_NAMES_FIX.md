// MOVED TO docs/archive/CENTER_NAMES_FIX.md
# Calendar Page - Center Names Display Fix

## Problem
The Calendar page was only showing center names correctly for Admin users. Other users (Evaluator, Coordinator, Quality) were seeing "Unknown Center (ID)" instead of the actual center names.

## Root Cause
The Firestore security rules did not explicitly define read access for the `centers` collection. While there was a catch-all rule `match /{document=**}` that should have allowed authenticated users to read all collections, Firebase Firestore security rules are evaluated top-to-bottom, and explicit rules take precedence.

## Changes Made

### 1. Updated Firestore Security Rules (`firestore.rules`)
Added explicit rules for the `centers` collection and other collections:

```javascript
// Centers collection - all authenticated users can read
match /centers/{centerId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}

// Mentors collection - accessible to all authenticated users
match /mentors/{mentorId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}
```

This ensures that **all authenticated users** can read center data, which is necessary for displaying center names in chips throughout the application.

### 2. Updated `firebase.json`
Added the Firestore configuration to enable rule deployment:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": [...]
}
```

### 3. Enhanced Error Handling in Calendar Component
Added better error logging and user feedback in the `loadData` function:

```javascript
const centersData = centersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
console.log('Centers loaded:', centersData.length, centersData);
setCenters(centersData);
```

Also added detailed error messages:
```javascript
catch (error) {
  console.error('Error fetching data:', error);
  console.error('Error details:', error.code, error.message);
  alert(`Failed to load calendar data: ${error.message}. Please check your permissions or contact support.`);
}
```

### 4. Added Debug Logging to centerMap
Added console logging to track center mapping:

```javascript
const map = Object.fromEntries(pairs);
console.log('Center map created:', map, 'from centers:', centers);
return map;
```

## Testing Instructions

### 1. Test as Non-Admin User (Evaluator/Coordinator)
1. Log in as an Evaluator or Coordinator user
2. Navigate to the Calendar page
3. Open browser console (F12)
4. Look for the log: `Centers loaded: X [...]` - should show the centers array with data
5. Look for the log: `Center map created: {...}` - should show the mapping
6. Verify that center names appear as colored chips (not "Unknown Center (ID)")

### 2. Verify Firestore Rules
1. Go to Firebase Console → Firestore Database → Rules
2. Verify that the rules include explicit `centers` collection access
3. Check that the rules were deployed successfully (timestamp should be recent)

### 3. Check Browser Console for Errors
If center names still don't show:
- Check for permission errors: `FirebaseError: Missing or insufficient permissions`
- Check the centers array: it should contain objects with `id` and `name` properties
- Verify that events have a `centers` array with valid center IDs

## Expected Behavior After Fix

### Before Fix
- Admin users: ✅ Center names display correctly
- Other users: ❌ Shows "Unknown Center (ID)"

### After Fix
- All authenticated users: ✅ Center names display correctly as colored chips
- Events show center names like "Nairobi", "Mombasa", etc. instead of "Unknown Center (abc123)"

## Rollback Instructions
If you need to rollback:
```bash
# Revert to previous rules
git checkout HEAD~1 firestore.rules firebase.json
firebase deploy --only firestore:rules
```

## Additional Notes
- The `centerMap` logic already handles various center ID formats (id, code, centerCode, shortCode, codeName)
- The fix also improves error visibility so any future permission issues will be immediately apparent in the console
- All users need to be authenticated - unauthenticated users still cannot read centers (by design)
