// Basic service worker for TALC Management PWA
// Handles offline caching, notification setup, and PWA state management

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open('talc-cache-v2').then(cache => {
      const filesToCache = [
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico',
        '/apple-touch-icon.png',
        '/logo192.png',
        '/logo512.png'
      ];
      console.log('Caching files:', filesToCache);
      return cache.addAll(filesToCache).catch(err => {
        console.error('Cache addAll failed:', err);
        // Don't fail the install if caching fails
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Add PWA focus detection
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'PWA_FOCUS') {
    // Notify all clients that the PWA has gained focus
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'PWA_FOCUS_DETECTED' });
      });
    });
  }
});

const CACHE_NAME = 'talc-cache-v2';

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  // Clean up old caches if cache name changes in future releases
  event.waitUntil(
    caches.keys().then(keys => {
      console.log('Existing caches:', keys);
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) {
            console.log('Deleting old cache:', k);
            return caches.delete(k);
          }
          return null;
        })
      );
    }).then(() => {
      console.log('Service Worker claiming clients...');
      return self.clients.claim();
    })
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
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip requests to different origins
  if (url.origin !== location.origin) {
    return;
  }
  
  // Navigation requests (page refresh / route entry) should fall back to index.html
  // to support client-side routing and offline refresh on mobile devices.
  const isNavigate = event.request.mode === 'navigate' ||
    (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'));

  if (isNavigate) {
    console.log('Navigation request:', event.request.url);
    
    // If the navigation URL contains OAuth / redirect query params (common during
    // Firebase / Google redirect sign-in flows), prefer a network fetch and
    // do NOT fall back to the cached index.html. Returning the cached index at
    // that moment can swallow important query params or redirect responses and
    // prevent the Firebase SDK from handling the sign-in result.
    try {
      const hasQuery = !!url.search;
      const oauthKeys = ['code', 'state', 'access_token', 'oauth_token', 'error', 'g_csrf_token'];
      const hasOAuthParams = oauthKeys.some(k => url.searchParams.has(k));

      if (hasQuery && hasOAuthParams) {
        console.log('OAuth redirect detected, bypassing cache');
        // Let the browser perform a full network navigation for redirect results.
        event.respondWith(fetch(event.request));
        return;
      }
    } catch (e) {
      console.error('URL parsing failed:', e);
      // If URL parsing fails for any reason, fall back to the normal handling below.
    }

    event.respondWith(
      fetch(event.request)
        .then(response => {
          console.log('Network response for navigation:', response.status, response.statusText);
          // Accept the network response only if it's a successful HTML document.
          const contentType = response?.headers?.get?.('content-type') || '';
          if (response && response.status === 200 && contentType.includes('text/html')) {
            // Save a copy of index.html so we can serve it while offline.
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              console.log('Caching navigation response');
              cache.put('/', copy);
              cache.put('/index.html', copy.clone());
            }).catch(err => console.error('Failed to cache navigation:', err));
            return response;
          }

          // Non-HTML or non-200 responses fall back to the cached index.html if available.
          console.log('Falling back to cached index.html');
          return caches.match('/index.html').then(cached => {
            if (cached) {
              console.log('Serving cached index.html');
              return cached;
            }
            console.log('No cached index.html, returning network response');
            return response;
          });
        })
        .catch(err => {
          console.log('Network failed, serving cached index.html:', err.message);
          return caches.match('/index.html').then(cached => {
            if (cached) {
              console.log('Serving cached index.html from catch');
              return cached;
            }
            console.error('No cached fallback available');
            return new Response('App offline and no cached content available', { 
              status: 503, 
              statusText: 'Service Unavailable' 
            });
          });
        })
    );
    return;
  }

  // For other requests (assets, API calls), try cache first, then network
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        console.log('Serving from cache:', event.request.url);
        return response;
      }
      console.log('Fetching from network:', event.request.url);
      return fetch(event.request).then(networkResponse => {
        // Cache successful responses for future use
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          }).catch(err => console.error('Failed to cache resource:', err));
        }
        return networkResponse;
      });
    })
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
