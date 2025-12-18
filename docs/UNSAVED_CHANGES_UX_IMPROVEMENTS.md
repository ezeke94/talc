# Unsaved Changes UX Improvements - Calendar Page

## Overview
Enhanced the user experience on the Calendar page to prevent users from forgetting to save task/todo changes after checking boxes.

## Changes Made

### 1. **Visual Indicators for Unsaved Changes**

#### Desktop View
- **Animated Badge**: Shows "Unsaved changes" label above the task list when changes are detected
- **Pulsing Dot**: A glowing orange dot pulses to draw attention to the warning
- **Attention Animation**: The badge gently shakes (attention-shake animation) to catch the user's eye

#### Mobile View
- **Save Button Prominence**: The save button (checkmark icon) becomes a prominent green circular button
- **No Badge**: On mobile, the save button itself serves as the visual indicator due to space constraints
- **Enhanced Shadows**: The button has a glowing shadow effect that indicates it needs action

### 2. **Improved Save Button UI**

#### Desktop
- **Subtle but Visible**: Small bordered button with green outline
- **Animated Bounce**: Continuously bounces slightly to draw attention
- **Hover Effect**: Scales up and intensifies shadow on hover
- **Tooltip**: Displays "Click to save changes (required)" on hover

#### Mobile
- **Prominent Green Button**: Larger circular button with filled green background
- **Persistent Glow**: Always shows with glowing shadow effect
- **Same Bounce Animation**: Continuously animated to indicate action needed
- **Tooltip**: Same helpful message as desktop

### 3. **Global Snackbar Notification**

- **Warning Alert**: Appears at the bottom center when any checkbox is changed
- **Clear Message**: "Task changes detected! Remember to click the save button to confirm."
- **Auto-dismiss**: Disappears after 8 seconds, but user can manually close
- **Styled Distinctly**: Orange/amber color scheme to indicate warning status
- **Always Visible**: Appears above other content (high z-index)

### 4. **CSS Animations**

Three new keyframe animations were added:

1. **pulse-glow**: Makes the unsaved indicator dot pulse with a glowing effect
2. **bounce-subtle**: Creates a subtle vertical bounce on the save button
3. **attention-shake**: Makes the warning badge shake side-to-side slightly

## Implementation Details

### State Management
- `showUnsavedSnackbar`: Controls visibility of the snackbar notification
- `unsavedEventId`: Tracks which event has unsaved changes
- `todosChanged`: Existing state, now triggers snackbar on toggle

### Component: UnsavedTasksIndicator
A new memoized component that conditionally renders:
- Warning badge (desktop only)
- Enhanced save button (both mobile and desktop, with different styles)

### Trigger Behavior
- User checks/unchecks a todo checkbox
- `handleToggleTodo` is called → sets `todosChanged[eventId] = true`
- Snackbar automatically appears
- `UnsavedTasksIndicator` component shows save button and badge
- User must click save button to persist changes and hide indicators

## User Benefits

1. **Clarity**: Users immediately see that their changes aren't saved
2. **Multiple Cues**: Visual indicators work together across desktop/mobile
3. **Not Intrusive**: Animations are subtle and don't interfere with work
4. **Accessibility**: Tooltip explains what needs to be done
5. **Mobile-Optimized**: Different UX tailored to each device size
6. **Responsive**: Animations stop after save, providing positive feedback

## Technical Notes

- All styling uses Material-UI theming system
- Animations are CSS-based (performant)
- No breaking changes to existing functionality
- Component is fully responsive with `isMobile` prop
- Works with both Firebase realtime updates and local state
