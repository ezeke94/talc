// Basic service worker for TALC Management PWA
// Handles offline caching and notification setup

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('talc-cache-v1').then(cache => {
      const filesToCache = [
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico',
        '/apple-touch-icon.png',
        '/vite.svg',
      ];
      return cache.addAll(filesToCache).catch(err => {
        console.error('Cache addAll failed:', err);
      });
    })
  );
  self.skipWaiting();
});

const CACHE_NAME = 'talc-cache-v1';

self.addEventListener('activate', event => {
  // Clean up old caches if cache name changes in future releases
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Listen for messages from clients (pages) to trigger skipWaiting for smoother updates
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// When a new service worker takes control, notify clients so the app can prompt reload
self.addEventListener('controllerchange', () => {
  // This event isn't available inside the SW global scope in all browsers,
  // but we'll still attempt to message clients after activation below.
});

self.addEventListener('fetch', event => {
  // Navigation requests (page refresh / route entry) should fall back to index.html
  // to support client-side routing and offline refresh on mobile devices.
  const isNavigate = event.request.mode === 'navigate' ||
    (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'));

  if (isNavigate) {
    // If the navigation URL contains OAuth / redirect query params (common during
    // Firebase / Google redirect sign-in flows), prefer a network fetch and
    // do NOT fall back to the cached index.html. Returning the cached index at
    // that moment can swallow important query params or redirect responses and
    // prevent the Firebase SDK from handling the sign-in result.
    try {
      const url = new URL(event.request.url);
      const hasQuery = !!url.search;
      const oauthKeys = ['code', 'state', 'access_token', 'oauth_token', 'error', 'g_csrf_token'];
      const hasOAuthParams = oauthKeys.some(k => url.searchParams.has(k));

      if (hasQuery && hasOAuthParams) {
        // Let the browser perform a full network navigation for redirect results.
        event.respondWith(fetch(event.request));
        return;
      }
    } catch (e) {
      // If URL parsing fails for any reason, fall back to the normal handling below.
    }

    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Accept the network response only if it's a successful HTML document.
          const contentType = response?.headers?.get?.('content-type') || '';
          if (response && response.status === 200 && contentType.includes('text/html')) {
            // Save a copy of index.html so we can serve it while offline.
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)).catch(() => {});
            return response;
          }

          // Non-HTML or non-200 responses fall back to the cached index.html if available.
          return caches.match('/index.html').then(cached => cached || response);
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests prefer cache, fallback to network
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// Notification logic placeholder
self.addEventListener('push', event => {
  const data = event.data ? event.data.text() : 'New notification';
  event.waitUntil(
    self.registration.showNotification('TALC Management', {
      body: data,
      icon: '/logo192.png',
    })
  );
});
