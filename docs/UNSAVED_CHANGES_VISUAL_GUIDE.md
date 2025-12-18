# Calendar Tasks - Unsaved Changes UX Improvements

## Visual Summary

### DESKTOP VIEW
```
┌─────────────────────────────────────────────┐
│  Tasks from SOP                             │
│  ☑ Task 1 (completed)                      │
│  ☐ Task 2                          ← User checks this
│  ☐ Task 3                                  │
│                                             │
│  🟠🟠🟠 Unsaved changes  ✓ (pulsing button)│  
│  (with shake animation)            (bounces)│
│                                             │
└─────────────────────────────────────────────┘
```

**Desktop Features:**
- Orange warning badge with pulsing dot
- Small green checkmark button with bounce
- Takes up minimal space
- Tooltip on hover: "Click to save changes (required)"

---

### MOBILE VIEW
```
┌──────────────────────┐
│ Tasks from SOP       │
│ ☑ Task 1             │
│ ☐ Task 2  ← checked  │
│ ☐ Task 3             │
│                      │
│  [ 🟢✓ ]  ← Large   │
│ (glowing   green    │
│  button,  button    │
│  bouncing) with     │
│            shadow   │
└──────────────────────┘
```

**Mobile Features:**
- Large circular green button (easier to tap)
- Glowing shadow effect (very visible)
- Same bounce animation as desktop
- No separate badge (button IS the indicator)

---

### GLOBAL SNACKBAR (All Devices)
```
At bottom center of screen:

┌──────────────────────────────────────────────────────────┐
│ ⚠ Task changes detected! Remember to click the save      │
│   button to confirm.                                     │
└──────────────────────────────────────────────────────────┘

Auto-dismisses after 8 seconds or on user close
Orange/amber warning styling
```

---

## Animation Effects

### 1. Pulse-Glow (Unsaved Indicator Dot)
- Smooth pulse effect with expanding glow
- 2-second loop
- Draws immediate attention
- Stops pulsing after save

### 2. Bounce-Subtle (Save Button)
- Gentle vertical bounce
- 0.8-second loop
- Continuous subtle movement
- Suggests "click me" without being annoying
- Stops after save

### 3. Attention-Shake (Warning Badge - Desktop)
- Side-to-side gentle shake
- 0.6-second loop
- Only on desktop (space available)
- Stops after save

---

## User Flow

1. **User checks a todo checkbox**
   ↓
2. **Immediately see:**
   - (Desktop) Orange badge appears above tasks + pulsing dot
   - (Mobile) Green save button appears with glow
   - (All) Snackbar notification at bottom
   ↓
3. **Animations indicate action needed:**
   - Badge shakes (desktop)
   - Save button bounces
   - Snackbar warns about unsaved changes
   ↓
4. **User clicks save button (checkmark icon)**
   ↓
5. **Instant feedback:**
   - All indicators disappear
   - Snackbar closes
   - Changes saved to Firebase
   - Visual confirmation that task is complete

---

## Technical Implementation

**CSS Animations** (in `<style>` tag):
```css
@keyframes pulse-glow { /* 0-12px shadow expansion */ }
@keyframes bounce-subtle { /* Small vertical movement */ }
@keyframes attention-shake { /* Horizontal wobble */ }
```

**State Changes:**
- `todosChanged[eventId]` → triggers indicators
- `showUnsavedSnackbar` → snackbar visibility
- Save button click → clears all indicators

**Responsive:**
- Desktop: Badge + small button
- Mobile: Large green button only
- All: Snackbar notification

---

## Benefits

✅ **Prevents Data Loss**: Users don't forget to save
✅ **Clear Feedback**: Multiple visual cues
✅ **Mobile-Optimized**: Different UX for each size
✅ **Not Intrusive**: Animations are subtle and professional
✅ **Accessible**: Tooltips explain what to do
✅ **Fast**: CSS animations (no performance impact)
✅ **Works Everywhere**: Desktop, tablet, mobile
