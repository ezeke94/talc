# Mentor Evaluator Save Error Fix

## Problem
When saving a mentor with an assigned evaluator, a 400 Bad Request error occurred:
```
POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/... 400 (Bad Request)
```

## Root Cause
The `assignedEvaluator` object from the Autocomplete component contained Firestore-specific metadata and references that cannot be serialized when saving to Firestore. This happens because:

1. The evaluators are loaded directly from Firestore using `onSnapshot`
2. The Autocomplete stores the entire user object including Firestore internals
3. When attempting to save this object back to Firestore, it contains non-serializable data

## Solution
Serialize the `assignedEvaluator` to a plain JavaScript object containing only the necessary fields before saving:

```javascript
// Before (causes error)
await onSave({ 
    name, 
    assignedCenters, 
    assignedFormIds,
    assignedEvaluator  // Contains Firestore metadata
});

// After (works correctly)
const evaluatorData = assignedEvaluator ? {
    id: assignedEvaluator.id,
    name: assignedEvaluator.name,
    role: assignedEvaluator.role,
    email: assignedEvaluator.email
} : null;

await onSave({ 
    name, 
    assignedCenters, 
    assignedFormIds,
    assignedEvaluator: evaluatorData  // Plain object
});
```

## What Changed

### File: `src/components/MentorForm.jsx`

**Function**: `handleSave()`

**Change**: Added serialization step before calling `onSave()`:
- Extract only the necessary fields: `id`, `name`, `role`, `email`
- Create a plain JavaScript object without Firestore metadata
- Handle null case when no evaluator is selected
- Added error logging for better debugging

## Data Structure

### Before (Problematic)
```javascript
assignedEvaluator: {
    id: "user123",
    name: "John Doe",
    role: "Quality",
    email: "john@example.com",
    label: "John Doe (Quality)",
    // Plus Firestore internal metadata (causes error)
    _firestore: {...},
    _converter: {...},
    // etc.
}
```

### After (Clean)
```javascript
assignedEvaluator: {
    id: "user123",
    name: "John Doe",
    role: "Quality",
    email: "john@example.com"
}
```

## Benefits

1. **Fixes the 400 error** - Firestore can now save the data
2. **Cleaner data** - Only stores necessary fields
3. **Better performance** - Smaller document size
4. **Consistent structure** - Predictable data format
5. **Better debugging** - Added console.error for failures

## Testing

### To verify the fix works:
1. Navigate to Record KPIs page
2. Click "Add Mentor" or edit an existing mentor
3. Fill in mentor name and center(s)
4. Select an evaluator from the dropdown
5. Click "Save"
6. ✅ Should save successfully without 400 error
7. ✅ Evaluator info should display correctly on mentor card
8. ✅ Edit the mentor again - evaluator should be pre-selected

### Edge cases covered:
- ✅ No evaluator selected (saves as `null`)
- ✅ Evaluator selected then cleared
- ✅ Changing from one evaluator to another
- ✅ Editing existing mentor with evaluator
- ✅ Creating new mentor with evaluator

## Related Code

The fix is compatible with how the evaluator data is displayed:

```javascript
// In Mentors.jsx - Display evaluator info
{mentor.assignedEvaluator && (
    <Box>
        <Typography variant="caption">EVALUATOR</Typography>
        <Typography variant="body2">
            {mentor.assignedEvaluator.name}
        </Typography>
    </Box>
)}
```

The saved structure (`{ id, name, role, email }`) provides all the information needed for display and notifications.

## Impact

- ✅ No breaking changes to existing data
- ✅ Works with existing mentor documents
- ✅ Compatible with notification system (uses evaluator ID and name)
- ✅ UI continues to work as expected

## Additional Improvements

Added error logging to help diagnose future issues:
```javascript
catch (err) {
    console.error('Error saving mentor:', err);
    setErrors({ form: 'Failed to save. Please try again.' });
    setSaving(false);
}
```

This will help identify the specific error if something goes wrong in the future.
