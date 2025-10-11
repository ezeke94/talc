/**
 * Notification History Manager
 * Tracks notifications received on this device to prevent duplicates
 * and provide notification history to users
 */

const STORAGE_KEY = 'talc_notification_history';
const DEDUP_KEY = 'talc_notification_dedup';
const MAX_HISTORY_ITEMS = 100; // Keep last 100 notifications
const DEDUP_WINDOW_MS = 10000; // 10 seconds deduplication window

/**
 * Generate unique notification ID
 */
export function generateNotificationId(payload) {
  const { type, eventId } = payload.data || {};
  const { title, body } = payload.notification || {};
  
  // Create unique ID from notification characteristics
  const idParts = [
    type || 'general',
    eventId || '',
    (title || '').substring(0, 50),
    (body || '').substring(0, 50)
  ].filter(Boolean);
  
  const id = idParts.join('-').replace(/[^a-zA-Z0-9-]/g, '');
  
  return id;
}

/**
 * Check if notification was already received recently
 * Returns true if duplicate, false if new
 */
export function isDuplicateNotification(notificationId, source = 'unknown', payload = {}) {
  try {
    const dedupData = JSON.parse(localStorage.getItem(DEDUP_KEY) || '{}');
    const now = Date.now();
    
    // Clean up old entries
    Object.keys(dedupData).forEach(id => {
      if (now - dedupData[id].timestamp > DEDUP_WINDOW_MS) {
        delete dedupData[id];
      }
    });
    
    // Check if this notification exists
    if (dedupData[notificationId]) {
      const timeSince = now - dedupData[notificationId].timestamp;
      // Duplicate detected - block it
      return true; // Duplicate
    }
    
    // Record this notification
    dedupData[notificationId] = {
      timestamp: now,
      source: source // 'background', 'foreground', 'app-open'
    };
    
    localStorage.setItem(DEDUP_KEY, JSON.stringify(dedupData));
    
    return false; // Not a duplicate
    
  } catch (error) {
    console.error('[NotifHistory] Error checking duplicate:', error);
    return false; // Fail open - allow notification
  }
}

/**
 * Save notification to history for user to view later
 */
export function saveNotificationToHistory(notification) {
  try {
    const history = getNotificationHistory();
    
    const historyItem = {
      id: notification.id || generateNotificationId(notification),
      title: notification.notification?.title || notification.title || 'Notification',
      body: notification.notification?.body || notification.body || '',
      type: notification.data?.type || 'general',
      eventId: notification.data?.eventId || null,
      url: notification.data?.url || '/',
      timestamp: Date.now(),
      read: false,
      source: notification.source || 'unknown' // background, foreground, app-open
    };
    
    // Add to beginning of array (most recent first)
    history.unshift(historyItem);
    
    // Keep only last MAX_HISTORY_ITEMS
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    
    console.log(`[NotifHistory] Saved to history: ${historyItem.title}`);
    
    // Dispatch custom event for UI to update
    window.dispatchEvent(new CustomEvent('notification-history-updated', { 
      detail: { notification: historyItem } 
    }));
    
    return historyItem;
    
  } catch (error) {
    console.error('[NotifHistory] Error saving to history:', error);
    return null;
  }
}

/**
 * Get all notification history
 */
export function getNotificationHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return history;
  } catch (error) {
    console.error('[NotifHistory] Error getting history:', error);
    return [];
  }
}

/**
 * Get unread notification count
 */
export function getUnreadCount() {
  const history = getNotificationHistory();
  return history.filter(n => !n.read).length;
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId) {
  try {
    const history = getNotificationHistory();
    const updated = history.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('notification-history-updated'));
    
    return true;
  } catch (error) {
    console.error('[NotifHistory] Error marking as read:', error);
    return false;
  }
}

/**
 * Mark all as read
 */
export function markAllAsRead() {
  try {
    const history = getNotificationHistory();
    const updated = history.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('notification-history-updated'));
    
    return true;
  } catch (error) {
    console.error('[NotifHistory] Error marking all as read:', error);
    return false;
  }
}

/**
 * Clear notification history
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DEDUP_KEY);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('notification-history-updated'));
    
    return true;
  } catch (error) {
    console.error('[NotifHistory] Error clearing history:', error);
    return false;
  }
}

/**
 * Delete specific notification from history
 */
export function deleteNotification(notificationId) {
  try {
    const history = getNotificationHistory();
    const filtered = history.filter(n => n.id !== notificationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('notification-history-updated'));
    
    return true;
  } catch (error) {
    console.error('[NotifHistory] Error deleting notification:', error);
    return false;
  }
}

/**
 * Clean up old deduplication data (call periodically)
 */
export function cleanupDedupData() {
  try {
    const dedupData = JSON.parse(localStorage.getItem(DEDUP_KEY) || '{}');
    const now = Date.now();
    
    let cleaned = false;
    Object.keys(dedupData).forEach(id => {
      if (now - dedupData[id].timestamp > DEDUP_WINDOW_MS) {
        delete dedupData[id];
        cleaned = true;
      }
    });
    
    if (cleaned) {
      localStorage.setItem(DEDUP_KEY, JSON.stringify(dedupData));
      console.log('[NotifHistory] Cleaned up old dedup data');
    }
  } catch (error) {
    console.error('[NotifHistory] Error cleaning dedup data:', error);
  }
}
