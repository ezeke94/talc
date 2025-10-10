// MOVED TO docs/archive/NOTIFICATIONS_IMPLEMENTATION_GUIDE.md
# TALC Notifications Implementation Guide

## Overview
This implementation adds cost-effective Firebase Cloud Functions notifications to improve user experience in your TALC management application.

## Features Added

### 1. **Critical Event Reminders** (4 PM UTC daily)
- **Owner Reminders**: 1 day before event at 4 PM for event owners/creators who are users
- **Quality Team & Owner Same-Day**: Same day at 4 PM for Quality team members and owners
- **Smart filtering**: Quality team filtered by assigned centers
- **Duplicate prevention**: Only sends for pending/in-progress events

### 2. **Weekly KPI Assessment Reminders** (Fridays 2 PM UTC)
- **Primary**: Assigned evaluators for each mentor receive targeted reminders
- **Fallback**: Admin/Quality team members for mentors without assigned evaluators
- **Smart tracking**: Checks for submissions based on assigned forms (not just default types)
- **Consolidated notifications**: Single notification per evaluator listing all pending assessments
- Checks for submissions in last 2 weeks
- Smart filtering by assigned centers

### 3. **Real-time Event Changes** (Document triggers)
- Instant notifications for event reschedules
- Event cancellation alerts
- Event completion notifications to supervisors

### 4. **Monthly Operational Summary** (1st of month, 8 AM UTC)
- Admin-only summary of key metrics
- Completion rates, overdue tasks, KPI submissions
- Budget-friendly monthly frequency

### 5. **Critical System Alerts** (Every 6 hours)
- High error rate detection
- Admin-only notifications
- Configurable threshold (default: 10+ errors/6 hours)

## Cost Optimization Strategies

### 1. **Scheduled Functions**
- Use time-based triggers instead of database triggers where possible
- Batch notifications to reduce function invocations
- Strategic timing (daily/weekly instead of hourly)

### 2. **Resource Limits**
- Max 10 concurrent containers globally
- 256MB memory for most functions (512MB for summaries)
- us-central1 region for cost efficiency

### 3. **Smart Batching**
- FCM batch size: 500 notifications per call
- Cache user tokens to avoid redundant queries
- Process in chunks to stay within limits

### 4. **Selective Notifications**
- Role-based filtering (admins only for summaries)
- Center-based filtering for assessors
- User preference controls

## Estimated Monthly Costs (Firebase Blaze Plan)

### Cloud Functions
- **Owner event reminders**: ~30 invocations/month × $0.0000004 = $0.000012
- **Quality team reminders**: ~30 invocations/month × $0.0000004 = $0.000012
- **KPI reminders**: ~4 invocations/month × $0.0000004 = $0.0000016
- **Event changes**: ~100 invocations/month × $0.0000004 = $0.00004
- **Monthly summaries**: ~1 invocation/month × $0.0000004 = $0.0000004
- **System alerts**: ~120 invocations/month × $0.0000004 = $0.000048

**Total Functions**: < $0.01/month

### Cloud Messaging (FCM)
- Free for unlimited messages
- No additional costs

### Firestore Reads/Writes
- **Additional reads**: ~1,000/month × $0.36/1M = $0.0004
- **Additional writes**: ~500/month × $1.08/1M = $0.0005

**Total Firestore**: < $0.001/month

### **Grand Total**: < $0.02/month

## Deployment Steps

### 1. **Update Environment Variables**
Add to your `.env` file:
```bash
VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
FRONTEND_URL=https://your-app-domain.com
```

Generate VAPID key:
```bash
firebase messaging:init
```

### 2. **Deploy Cloud Functions**
```bash
cd functions
npm install
firebase deploy --only functions
```

### 3. **Test Notification Setup**
1. Login to your app
2. Allow notifications when prompted
3. Check browser developer tools for FCM token
4. Test with Firebase Console messaging

### 4. **Verify Function Deployment**
```bash
firebase functions:log
```

## User Experience Improvements

### 1. **Enhanced Evaluator Assignment**
- **Individual evaluator per mentor**: Assign specific users to receive KPI reminders
- **Role flexibility**: Supports Admin, Quality, and Evaluator roles
- **Fallback system**: Auto-assigns to Admin/Quality if no evaluator specified
- **Visual indicator**: Shows assigned evaluator on mentor cards/table

### 2. **Color-Coded Form Status**
- **Green (filled)**: Form submitted this month
- **Grey (outlined)**: Form not submitted this month
- **Real-time updates**: Status updates based on current month submissions
- **Mobile responsive**: Works on both desktop and mobile views
- **Interactive legend**: Expandable guide explaining color meanings

### 3. **Improved Notification Targeting**
- Users get advance notice of deadlines
- No more missed events or assessments
- Automatic updates on schedule changes

### 3. **Improved Notification Targeting**
- **Personalized reminders**: Only assigned evaluators get notifications for their mentors
- **Reduced noise**: No more generic notifications to all admin users
- **Consolidated messages**: Single notification per evaluator listing all pending items

### 4. **Enhanced Mobile Experience**
- Push notifications work when app is closed
- PWA-compatible for mobile devices
- Persistent notifications for important items

### 3. **Role-Based Relevance**
- Mentors get event reminders
- Assessors get KPI reminders
- Admins get operational summaries
- Everyone gets critical alerts

### 4. **User Control**
- Notification preferences in profile settings
- Easy enable/disable toggle
- Granular control by notification type

## Monitoring & Analytics

### 1. **Function Logs**
```bash
firebase functions:log --only sendDailyEventReminders
```

### 2. **Success Metrics**
- Event completion rates
- KPI submission timeliness
- User engagement with notifications

### 3. **Cost Monitoring**
- Firebase Console usage dashboard
- Set billing alerts in Google Cloud Console
- Monitor function execution times

## Troubleshooting

### 1. **Notifications Not Received**
- Check browser notification permissions
- Verify VAPID key configuration
- Check service worker registration
- Verify FCM token in user document

### 2. **Function Errors**
- Check Firebase Functions logs
- Verify Firestore security rules
- Check authentication in functions

### 3. **High Costs**
- Review function execution frequency
- Check for infinite loops
- Monitor concurrent container usage

## Security Considerations

### 1. **FCM Token Security**
- Tokens stored securely in Firestore
- Regular token refresh handled automatically
- User-specific tokens prevent cross-user messaging

### 2. **Function Security**
- Admin SDK automatically authenticated
- Firestore rules still apply
- No sensitive data in notification payloads

### 3. **User Privacy**
- Users can disable notifications anytime
- No tracking beyond delivery status
- Minimal data in notification content

## Future Enhancements (Low Priority)

### 1. **Advanced Scheduling**
- Custom reminder times per user
- Time zone-aware notifications
- Smart scheduling based on user activity

### 2. **Rich Notifications**
- Action buttons (Mark Complete, Snooze)
- Images and progress bars
- Interactive elements

### 3. **Analytics Integration**
- Notification click-through rates
- User engagement metrics
- A/B testing for message content

## Support

For issues with this implementation:
1. Check Firebase Console for function errors
2. Review browser developer tools for client errors
3. Monitor FCM delivery status in Firebase Console
4. Check Firestore rules for permission issues