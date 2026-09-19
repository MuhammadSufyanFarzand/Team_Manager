const CACHE_NAME = 'group-chat-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json'
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch network first, fallback to cache for offline support
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and avoid extension scripts or third-party APIs
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Exclude Supabase API and hot reload/dev server paths
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('@vite') || url.pathname.includes('node_modules')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If valid response, clone and save in cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline: attempt to retrieve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the main document failed, return index.html shell
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
