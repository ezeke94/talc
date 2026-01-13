import { Timestamp } from 'firebase/firestore';

// Prepare a duplicated event object for Firestore create
export function prepareDuplicateEvent(event, newTitle, currentUser) {
  const copy = { ...event };
  delete copy.id;
  copy.title = newTitle;
  copy.createdBy = { userId: currentUser.uid, userName: currentUser.displayName };
  copy.lastModifiedBy = { userId: currentUser.uid, userName: currentUser.displayName };
  copy.notificationSent = false;
  copy.lastNotificationAt = new Date();

  // Normalize datetime fields to Firestore Timestamps (or null for empty)
  if (typeof copy.startDateTime === 'string') {
    copy.startDateTime = copy.startDateTime.trim() === '' ? null : Timestamp.fromDate(new Date(copy.startDateTime));
  } else if (copy.startDateTime instanceof Date) {
    copy.startDateTime = Timestamp.fromDate(copy.startDateTime);
  }

  if (typeof copy.endDateTime === 'string') {
    copy.endDateTime = copy.endDateTime.trim() === '' ? null : Timestamp.fromDate(new Date(copy.endDateTime));
  } else if (copy.endDateTime instanceof Date) {
    copy.endDateTime = Timestamp.fromDate(copy.endDateTime);
  }

  return copy;
}
