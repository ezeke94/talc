// Device management utilities for notification devices
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Get all registered devices for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of device objects
 */
export async function getUserDevices(userId) {
  if (!userId) return [];

  try {
    const devicesRef = collection(db, 'users', userId, 'devices');
    const q = query(devicesRef, orderBy('lastSeenAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const devices = [];
    snapshot.forEach((doc) => {
      devices.push({
        id: doc.id,
        token: doc.id, // token is the document ID
        ...doc.data()
      });
    });

    return devices;
  } catch (error) {
    console.error('Error fetching user devices:', error);
    return [];
  }
}

/**
 * Get device info from user agent string
 * @param {string} userAgent - The user agent string
 * @returns {object} Device info
 */
export function parseDeviceInfo(userAgent) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

  // Parse browser
  let browser = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera';

  // Parse OS
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // Parse device type
  let device = 'Desktop';
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = 'Tablet';

  return { browser, os, device };
}

/**
 * Get a friendly device name
 * @param {object} deviceData - The device data from Firestore
 * @returns {string} Friendly device name
 */
export function getDeviceName(deviceData) {
  // If user has set a custom name, use that
  if (deviceData.name) {
    return deviceData.name;
  }
  
  // Otherwise, generate a name from user agent
  const info = parseDeviceInfo(deviceData.userAgent);
  return `${info.os} - ${info.browser} (${info.device})`;
}

/**
 * Update device name
 * @param {string} userId - The user ID
 * @param {string} deviceToken - The device token
 * @param {string} name - The new device name
 */
export async function updateDeviceName(userId, deviceToken, name) {
  if (!userId || !deviceToken) return false;

  try {
    const deviceRef = doc(db, 'users', userId, 'devices', deviceToken);
    await updateDoc(deviceRef, { name: name || null });
    return true;
  } catch (error) {
    console.error('Error updating device name:', error);
    return false;
  }
}

/**
 * Disable/Enable a specific device
 * @param {string} userId - The user ID
 * @param {string} deviceToken - The device token
 * @param {boolean} enabled - Whether to enable or disable
 */
export async function toggleDevice(userId, deviceToken, enabled) {
  if (!userId || !deviceToken) return false;

  try {
    const deviceRef = doc(db, 'users', userId, 'devices', deviceToken);
    await updateDoc(deviceRef, { enabled });
    return true;
  } catch (error) {
    console.error('Error toggling device:', error);
    return false;
  }
}

/**
 * Remove a device
 * @param {string} userId - The user ID
 * @param {string} deviceToken - The device token
 */
export async function removeDevice(userId, deviceToken) {
  if (!userId || !deviceToken) return false;

  try {
    const deviceRef = doc(db, 'users', userId, 'devices', deviceToken);
    await deleteDoc(deviceRef);
    return true;
  } catch (error) {
    console.error('Error removing device:', error);
    return false;
  }
}

/**
 * Check if a token is the current device's token
 * @param {string} token - The token to check
 * @returns {boolean} True if it's the current device
 */
export function isCurrentDevice(token) {
  // Try to get the current token from localStorage or check against FCM token
  const currentToken = localStorage.getItem('fcmToken');
  return currentToken === token;
}

/**
 * Format timestamp for display
 * @param {any} timestamp - Firestore timestamp
 * @returns {string} Formatted date string
 */
export function formatDeviceDate(timestamp) {
  if (!timestamp) return 'Unknown';
  
  try {
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown';
  }
}
