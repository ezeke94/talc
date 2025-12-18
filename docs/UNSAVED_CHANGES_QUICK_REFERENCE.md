# Quick Reference: Unsaved Changes UX

## What Changed?
Users checking todo boxes now see **multiple visual indicators** that changes aren't saved until they click the save button.

## For Users

### Desktop Users See:
```
✓ Orange warning badge with pulsing dot above task list
✓ "Unsaved changes" message that shakes gently
✓ Small green checkmark button that bounces
✓ Orange warning notification at bottom of screen
```
**Action**: Click the bouncing green checkmark button to save

### Mobile Users See:
```
✓ Large green circular save button (very prominent)
✓ The button has a glowing shadow that pulses
✓ The button bounces up and down continuously
✓ Orange warning notification at bottom of screen
```
**Action**: Tap the large green button to save

## Animations Explained

### 1. **Pulsing Dot** (Desktop only)
- The orange dot next to "Unsaved changes" expands and contracts
- Like a subtle heartbeat
- Says: "Hey, you have work to do!"

### 2. **Bouncing Button** (Desktop + Mobile)
- Save button moves up and down slightly
- Continuous gentle bounce
- Says: "Click me to save"

### 3. **Shaking Badge** (Desktop only)
- The warning message wobbles side-to-side
- Gentle shake, not annoying
- Says: "Attention needed here"

## Why These Changes?

**Problem**: Users checked todo boxes and thought changes were automatically saved, forgetting to click the save button. This caused work to be lost.

**Solution**: 
- Made the save button impossible to miss
- Added a snackbar notification as backup
- Used animations to naturally draw attention
- Different styles for mobile vs desktop (mobile gets bigger button)

## What if I Accidentally Check a Box?

1. The unsaved indicators appear
2. **Don't panic!** Just uncheck the box back
3. Click save when you're done with all changes
4. If you close the page before saving, changes are lost (currently - could add auto-save later)

## Testing the Feature

### Desktop:
1. Go to Calendar → Events and Tasks
2. Find any task with checkboxes
3. Click one checkbox
4. You should see:
   - Orange warning badge appear
   - Save button appear with bounce
   - Snackbar notification at bottom
5. Click the green checkmark button
6. Everything disappears = Save successful!

### Mobile:
1. Go to Calendar → Events and Tasks
2. Scroll to a task list
3. Check/uncheck a box
4. You should see:
   - Large green button appear with glow
   - Snackbar notification
5. Tap the green button
6. Changes saved!

## Technical Details for Developers

### Key Files
- `src/pages/Calendar.jsx` - Main implementation

### New Components
- `UnsavedTasksIndicator` - Handles desktop/mobile variants

### New State
- `showUnsavedSnackbar` - Controls snackbar
- `unsavedEventId` - Tracks active event

### New Animations
- `pulse-glow` - Expanding glow on indicator
- `bounce-subtle` - Button bounce animation
- `attention-shake` - Badge wobble

### Key Functions Modified
- `handleToggleTodo()` - Now triggers snackbar
- `handleSaveTodos()` - Now hides snackbar on save

## Future Improvements

Possible enhancements:
- [ ] Auto-save after 10 seconds of no changes
- [ ] Keyboard shortcut (Ctrl/Cmd + S) to save
- [ ] Show "Saved!" confirmation after save
- [ ] Add haptic feedback on mobile
- [ ] Undo/Revert button
- [ ] Show what changed (diff view)

## Troubleshooting

**Q: The animations aren't smooth**
A: Check browser performance. Try refreshing the page. CSS animations should be GPU-accelerated.

**Q: The save button isn't visible**
A: Make sure you checked a box. It only appears when `todosChanged` is true.

**Q: The snackbar is covering content**
A: It auto-dismisses after 8 seconds, or you can click X to close it.

**Q: Changes didn't save**
A: Make sure you clicked the save button (checkmark). The snackbar says you need to click it.

**Q: Mobile button is too small to tap**
A: It should be large on mobile (44x44px minimum). If not, that's a bug - report it!

## Summary Table

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| **Badge** | Yes (orange) | No |
| **Save Button** | Small outlined | Large filled |
| **Animations** | Badge shake + button bounce | Button bounce + glow |
| **Color** | Green borders | Green filled |
| **Snackbar** | Yes | Yes |
| **Tap/Click Target** | 32-44px | 64px |
| **Feedback** | Visual animations | Large button + glow |
