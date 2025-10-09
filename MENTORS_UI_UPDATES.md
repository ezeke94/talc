# Mentors Page UI Updates - Summary

## Changes Made

### 1. **Button Updates**

#### Mobile View (Cards)
- **"View" → "Evaluate"**
  - Changed button label from "View" to "Evaluate"
  - Updated icon from `VisibilityIcon` to `AssessmentIcon` 
  - Remains as primary action button (full width, outlined variant)

- **Edit & Delete Buttons**
  - **Reduced size**: From 44x44px to 36x36px
  - **Changed size prop**: From default to `size="small"`
  - **Updated border radius**: From 2 (16px) to 1.5 (12px) for more compact look
  - **Icon size**: Changed to `fontSize="small"`
  - Maintains colored backgrounds (green for edit, red for delete)

#### Desktop View (Table)
- **"View Details" → "Evaluate"**
  - Changed tooltip and aria-label to "Evaluate"
  - Updated icon from `VisibilityIcon` to `AssessmentIcon`
  - Maintains small size for table row actions

### 2. **Navigation Updates**

#### Layout Component (`src/components/Layout.jsx`)
- **Changed navigation label**: "Mentors" → "Record KPIs"
- **Path remains the same**: `/mentors`
- **Applied to both**:
  - Mobile drawer navigation
  - Desktop top navigation bar

#### Page Title (`src/pages/Mentors.jsx`)
- **Changed page heading**: "Manage Mentors" → "Record KPIs"
- Maintains responsive typography (1.5rem mobile, 2rem desktop)

### 3. **Icon Import**
- **Added**: `AssessmentIcon` from `@mui/icons-material/Assessment`
- **Removed**: `VisibilityIcon` from `@mui/icons-material/Visibility`

## Visual Changes Summary

### Before:
```
Mobile Card Actions:
[      View Button (44px)      ] [Edit 44x44] [Delete 44x44]

Desktop Table Actions:
[👁 View] [✏️ Edit] [🗑️ Delete]

Navigation:
- Mentors

Page Title:
Manage Mentors
```

### After:
```
Mobile Card Actions:
[    Evaluate Button (44px)    ] [Edit 36x36] [Delete 36x36]

Desktop Table Actions:
[📊 Evaluate] [✏️ Edit] [🗑️ Delete]

Navigation:
- Record KPIs

Page Title:
Record KPIs
```

## Benefits

1. **Clearer Purpose**: "Record KPIs" and "Evaluate" better describe the actual function
2. **More Space**: Smaller edit/delete buttons leave more room for the primary action
3. **Better UX**: Primary action (Evaluate) is more prominent, secondary actions are appropriately de-emphasized
4. **Consistent Terminology**: Navigation, page title, and actions all align with the KPI recording purpose

## Files Modified

1. `src/pages/Mentors.jsx`
   - Updated imports (AssessmentIcon instead of VisibilityIcon)
   - Changed button sizes and labels (mobile cards)
   - Changed icon and tooltip (desktop table)
   - Updated page title

2. `src/components/Layout.jsx`
   - Changed navigation item text from "Mentors" to "Record KPIs"

## Testing Checklist

- [ ] Mobile: Evaluate button works and navigates to mentor detail
- [ ] Mobile: Edit and Delete buttons are smaller (36x36) but still tappable
- [ ] Desktop: Evaluate icon appears in table actions
- [ ] Navigation shows "Record KPIs" in both mobile drawer and desktop menu
- [ ] Page title displays "Record KPIs"
- [ ] All tooltips show correct text
- [ ] Icons render correctly (AssessmentIcon for Evaluate)
