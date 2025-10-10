// MOVED TO docs/archive/NOTIFICATION_REMINDER_SYSTEM.md
# 🔔 TALC Notification Reminder System

## How Users Are Reminded About Disabled Notifications

### 1. **Proactive Notification Prompt** 
   - **Component**: `NotificationPrompt.jsx`
   - **Location**: Appears as a top banner on all pages
   - **Triggers**: Shows when:
     - User has Admin, Quality, or Owner role (high importance)
     - Browser supports notifications but they're not enabled
     - User hasn't dismissed the prompt in the last 7 days
     - Notifications are in "default" (never asked) or "denied" state

### 2. **Smart Timing Logic**
   ```javascript
   const shouldShowNotificationPrompt = (status, userData) => {
     // Don't show if already enabled
     if (userData?.notificationsEnabled) return false;
     
     // Don't show if browser doesn't support
     if (!status.supported) return false;
     
     // Respect user dismissal (7-day cooldown)
     const lastDismissed = userData?.notificationPromptDismissed?.toDate();
     if (lastDismissed) {
       const daysSinceDismissed = (Date.now() - lastDismissed.getTime()) / (1000 * 60 * 60 * 24);
       if (daysSinceDismissed < 7) return false;
     }

     // Prioritize important roles
     const hasImportantRole = ['Admin', 'Quality', 'Owner'].includes(userData?.role);
     
     return hasImportantRole || status.permission === 'default';
   }
   ```

### 3. **Multi-Level Notification Guidance**

   #### **Level 1: Compact Banner Alert**
   - Non-intrusive top banner with "Enable" button
   - Shows notification status and quick action
   - Can be dismissed for 7 days

   #### **Level 2: Detailed Enable Dialog**
   - Explains benefits of notifications:
     - ✅ Event Reminders (24-hour advance notice)
     - ✅ KPI Deadlines (weekly reminders)
     - ✅ Event Changes (instant alerts)
     - ✅ System Updates (operational summaries)
   - One-click enable or guided browser settings

   #### **Level 3: Notifications Panel Warning**
   - Persistent warning in the notifications panel
   - "Push notifications are disabled" with link to settings
   - Visible every time user checks notifications

   #### **Level 4: Profile Settings Page**
   - Comprehensive notification settings management
   - Clear status indicators and browser instructions
   - Step-by-step guide for blocked notifications

### 4. **User Enablement Process**

   #### **For Default Permission (Never Asked):**
   ```
   1. User clicks "Enable" in prompt/dialog
   2. Browser shows permission dialog
   3. User clicks "Allow"
   4. FCM token generated and saved
   5. User preferences updated in Firestore
   ```

   #### **For Denied Permission (Previously Blocked):**
   ```
   1. User sees detailed browser instructions
   2. Must manually unblock in browser settings:
      - Click lock icon (🔒) in address bar
      - Change from "Block" to "Allow"
      - Refresh page
   3. Then follow normal enable process
   ```

### 5. **Where Users Can Enable Notifications**

   #### **Option 1: Notification Prompt Banner**
   - Appears automatically for eligible users
   - One-click enable button
   - Dismissible with 7-day cooldown

   #### **Option 2: User Profile Page**
   - Navigate to Profile → Notification Settings
   - Toggle switch with live status
   - Detailed preference controls

   #### **Option 3: Notifications Panel**
   - Warning message with "Enable in Settings" button
   - Direct link to profile page

### 6. **Smart Dismissal Logic**
   - Users can dismiss the prompt for 7 days
   - Dismissal is tracked in user document
   - Prompt reappears after cooldown period
   - High-priority roles get more frequent reminders

### 7. **Browser Support Detection**
   ```javascript
   export function getNotificationStatus() {
     return {
       supported: 'Notification' in window && 'serviceWorker' in navigator,
       permission: 'Notification' in window ? Notification.permission : 'default',
       messagingSupported: messaging !== null
     };
   }
   ```

### 8. **Role-Based Prioritization**
   - **Admin/Quality/Owner**: High priority - shown more frequently
   - **Regular users**: Standard reminders
   - **No role**: Basic browser permission prompts only

### 9. **User Experience Flow**
   ```
   User Login → Check Notification Status → 
   If Disabled & Important Role → Show Prompt →
   User Clicks Enable → Request Permission →
   Permission Granted → Generate FCM Token →
   Save to Firestore → Hide Prompt →
   Start Receiving Notifications
   ```

### 10. **Fallback Communication**
   - Even without push notifications enabled, users still see:
     - In-app notification panel with all messages
     - Email notifications (if configured)
     - Calendar reminders and dashboard alerts
     - Manual form status checking

## Key Benefits
- ✅ **Non-intrusive**: Smart timing prevents notification fatigue
- ✅ **Role-aware**: Prioritizes users who need notifications most
- ✅ **Educational**: Explains value before asking for permission
- ✅ **Persistent**: Multiple touchpoints ensure users are informed
- ✅ **Respectful**: Honors user dismissal preferences
- ✅ **Accessible**: Works across different browsers and devices