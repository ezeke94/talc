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
        '/logo192.png',
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
    return;
  }
  // Allow app to request cache clearing for auth-related safety
  if (event.data && (event.data.type === 'CLEAR_AUTH_CACHE' || event.data === 'CLEAR_AUTH_CACHE')) {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys
        .filter(k => k.startsWith('talc-cache'))
        .map(k => caches.delete(k))
      )).catch(() => {})
    );
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
    // CRITICAL FIX: If the navigation URL contains OAuth / redirect query params,
    // ALWAYS go to the network and do NOT serve from cache. Returning the cached
    // index.html here would swallow the auth tokens and break the login flow.
    try {
      const url = new URL(event.request.url);
      const hasOAuthParams = /[?&](code|state|oauth_token|g_csrf_token)=/.test(url.search);
      const isAuthHandler = url.pathname.startsWith('/__/auth');

      if (isAuthHandler || hasOAuthParams) {
        console.log('Service Worker: Bypassing cache for OAuth navigation.', event.request.url, {
          hasOAuthParams,
          isAuthHandler,
          pathname: url.pathname,
          search: url.search
        });
        // Let the browser perform a full network navigation for redirect results.
        event.respondWith(fetch(event.request));
        return;
      }
    } catch (e) {
      // If URL parsing fails, fall back to the normal handling below.
      console.error('Service Worker: Failed to parse URL for OAuth check.', e);
    }

    event.respondWith(
      fetch(event.request)
        .then(response => {
          // For regular navigations, if it's a valid HTML response, cache it.
          const contentType = response?.headers?.get?.('content-type') || '';
          if (response && response.status === 200 && contentType.includes('text/html')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
            return response;
          }
          // If not, try to serve the cached index.html.
          return caches.match('/index.html').then(cached => cached || response);
        })
        .catch(() => caches.match('/index.html')) // On network failure, serve from cache.
    );
    return;
  }

  // For all other requests (CSS, JS, images), use a cache-first strategy.
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
