// Cache management utilities for TALC PWA
// Allows clearing Cache Storage and refreshing Service Workers from inside the app

const TALC_CACHE_PREFIX = 'talc-cache';

function isFirebaseMessagingSW(scriptURL) {
  if (!scriptURL) return false;
  try {
    const path = new URL(scriptURL).pathname;
    return path.endsWith('/firebase-messaging-sw.js');
  } catch {
    return scriptURL.includes('/firebase-messaging-sw.js');
  }
}

export async function clearCaches(prefixes = [TALC_CACHE_PREFIX]) {
  if (!('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => prefixes.some(p => k.startsWith(p)))
        .map(k => caches.delete(k))
    );
  } catch (e) {
    console.warn('Cache clear failed:', e);
  }
}

export async function messageActiveServiceWorker(message) {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    } else {
      // Attempt to get any registration and post to its active worker
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const sw = reg.active || reg.waiting || reg.installing;
        if (sw) {
          sw.postMessage(message);
        }
      }
    }
  } catch (e) {
    console.warn('SW message failed:', e);
  }
}

export async function refreshServiceWorkers({ unregisterNonMessaging = false } = {}) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(async (reg) => {
      const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL;
      const isFCM = isFirebaseMessagingSW(scriptUrl);
      if (unregisterNonMessaging && !isFCM) {
        try { await reg.unregister(); } catch {}
      } else {
        try { await reg.update(); } catch {}
      }
    }));
  } catch (e) {
    console.warn('SW refresh/unregister failed:', e);
  }
}

export async function resetAppCache({ deep = false } = {}) {
  // Ask SW to clear its caches (handles auth-related cache names safely)
  await messageActiveServiceWorker({ type: 'CLEAR_AUTH_CACHE' });

  // Clear app caches from the page as well
  await clearCaches();

  // Optionally perform a deeper reset: unregister non-FCM SWs and clear local dedup/history
  await refreshServiceWorkers({ unregisterNonMessaging: deep });

  if (deep) {
    try {
      localStorage.removeItem('talc_notification_history');
      localStorage.removeItem('talc_notification_dedup');
      // Do NOT remove auth keys or FCM token by default to avoid sign-outs
    } catch {}
  }
}
