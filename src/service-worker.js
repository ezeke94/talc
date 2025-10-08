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
        // Optionally, you can filter out missing files and try again
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Notification logic placeholder
// Notifications removed from service worker
