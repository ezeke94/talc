import { db } from '../firebase/config';
import { collection, addDoc } from 'firebase/firestore';

// Send notification to user(s)
export async function sendNotification({ userId, type, message, eventId = null }) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      message,
      eventId,
      sentAt: new Date(),
      read: false
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

// Log audit action
export async function logAudit({ userId, userName, action, targetType, targetId, details }) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId,
      userName,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}
