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

self.addEventListener('fetch', event => {
  // Navigation requests (page refresh / route entry) should fall back to index.html
  // to support client-side routing and offline refresh on mobile devices.
  const isNavigate = event.request.mode === 'navigate' ||
    (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'));

  if (isNavigate) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If we get a valid response, update the cache for index.html so offline works later
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)).catch(() => {});
          }
          return response;
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
