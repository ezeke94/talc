import { setDoc } from 'firebase/firestore';
/**
 * Remove all device tokens for a user and add a new one
 * @param {string} userId
 * @param {string} newToken
 * @param {object} deviceData (optional)
 */
export async function replaceAllDevicesWithToken(userId, newToken, deviceData = {}) {
  if (!userId || !newToken) return false;
  try {
    // Remove all existing devices
    const devices = await getUserDevices(userId);
    await Promise.all(devices.map(d => deleteDoc(doc(db, 'users', userId, 'devices', d.token))));
    // Add the new device
    await setDoc(doc(db, 'users', userId, 'devices', newToken), {
      ...deviceData,
      token: newToken,
      enabled: true,
      lastSeenAt: new Date(),
      createdAt: new Date(),
    });
    return true;
  } catch (e) {
    console.error('replaceAllDevicesWithToken failed:', e);
    return false;
  }
}
// Device management utilities for notification devices
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Get all registered devices for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of device objects
 */
export async function getUserDevices(userId) {
  if (!userId) {
    console.warn('deviceManager.getUserDevices: No userId provided');
    return [];
  }

  console.log('deviceManager.getUserDevices: Fetching devices for user:', userId);

  try {
    const devicesRef = collection(db, 'users', userId, 'devices');
    const q = query(devicesRef, orderBy('lastSeenAt', 'desc'));
    const snapshot = await getDocs(q);
    
    console.log('deviceManager.getUserDevices: Found', snapshot.size, 'devices');
    
    const devices = [];
    snapshot.forEach((docSnap) => {
      const deviceData = {
        id: docSnap.id,
        token: docSnap.id, // token is the document ID
        ...docSnap.data()
      };
      console.log('deviceManager.getUserDevices: Device:', deviceData);
      devices.push(deviceData);
    });

    console.log('deviceManager.getUserDevices: Returning', devices.length, 'devices');
    return devices;
  } catch (error) {
    console.error('deviceManager.getUserDevices: Error fetching user devices:', error);
    
    // If it's an ordering error, try without ordering
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      try {
        console.log('deviceManager.getUserDevices: Retrying without orderBy...');
        const devicesRef = collection(db, 'users', userId, 'devices');
        const snapshot = await getDocs(devicesRef);
        
        console.log('deviceManager.getUserDevices: Retry found', snapshot.size, 'devices');
        
        const devices = [];
        snapshot.forEach((docSnap) => {
          const deviceData = {
            id: docSnap.id,
            token: docSnap.id,
            ...docSnap.data()
          };
          console.log('deviceManager.getUserDevices: Device (retry):', deviceData);
          devices.push(deviceData);
        });

        console.log('deviceManager.getUserDevices: Retry returning', devices.length, 'devices');
        return devices;
      } catch (retryError) {
        console.error('deviceManager.getUserDevices: Retry also failed:', retryError);
        return [];
      }
    }
    
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

/**
 * Clean up duplicate devices (keeps the most recent one for each unique token)
 * @param {string} userId - The user ID
 * @returns {Promise<number>} Number of duplicates removed
 */
export async function cleanupDuplicateDevices(userId) {
  if (!userId) {
    console.warn('deviceManager.cleanupDuplicateDevices: No userId provided');
    return 0;
  }

  console.log('deviceManager.cleanupDuplicateDevices: Cleaning up for user:', userId);

  try {
    const devices = await getUserDevices(userId);
    console.log('deviceManager.cleanupDuplicateDevices: Found', devices.length, 'total devices');

    // Group devices by token
    const tokenMap = new Map();
    devices.forEach(device => {
      const token = device.token || device.id;
      if (!tokenMap.has(token)) {
        tokenMap.set(token, []);
      }
      tokenMap.get(token).push(device);
    });

    let duplicatesRemoved = 0;

    // For each token, keep only the most recent device (by lastSeenAt)
    for (const [token, deviceList] of tokenMap.entries()) {
      if (deviceList.length > 1) {
        console.log(`deviceManager.cleanupDuplicateDevices: Found ${deviceList.length} duplicates for token:`, token.substring(0, 20) + '...');
        
        // Sort by lastSeenAt (most recent first)
        deviceList.sort((a, b) => {
          const aTime = a.lastSeenAt?.toMillis?.() || a.lastSeenAt?.seconds * 1000 || 0;
          const bTime = b.lastSeenAt?.toMillis?.() || b.lastSeenAt?.seconds * 1000 || 0;
          return bTime - aTime;
        });

        // Keep the first (most recent), delete the rest
        for (let i = 1; i < deviceList.length; i++) {
          const deviceToRemove = deviceList[i];
          try {
            const deviceRef = doc(db, 'users', userId, 'devices', deviceToRemove.id);
            await deleteDoc(deviceRef);
            duplicatesRemoved++;
            console.log('deviceManager.cleanupDuplicateDevices: Removed duplicate device:', deviceToRemove.id.substring(0, 20) + '...');
          } catch (error) {
            console.error('deviceManager.cleanupDuplicateDevices: Failed to remove device:', error);
          }
        }
      }
    }

    console.log(`deviceManager.cleanupDuplicateDevices: Removed ${duplicatesRemoved} duplicate devices`);
    return duplicatesRemoved;
  } catch (error) {
    console.error('deviceManager.cleanupDuplicateDevices: Error:', error);
    return 0;
  }
}
