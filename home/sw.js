/* ===========================================================
   Service Worker — الحديدي للأسماك (Home Sub-App)
   - Professional PWA with full offline support
   - Cache-first for static assets
   - Network-first for API calls
   =========================================================== */

const CACHE_NAME = 'fish-home-v3.0-pro';
const STATIC_CACHE = 'fish-home-static-v3';
const DYNAMIC_CACHE = 'fish-home-dynamic-v3';

// Assets to cache on install
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Install event - Pre-cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW Home] Installing version:', CACHE_NAME);
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW Home] Some assets failed to cache:', err);
      });
    }).then(() => {
      console.log('[SW Home] App shell cached');
      return self.skipWaiting();
    })
  );
});

// Activate event - Clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW Home] Activating version:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => 
          key !== STATIC_CACHE && 
          key !== DYNAMIC_CACHE && 
          !key.startsWith('fish-home')
        ).map(key => {
          console.log('[SW Home] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[SW Home] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - Smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // Network-first for Firebase/API calls
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.pathname.includes('.json')) {
    
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, css, js)
  if (request.destination === 'image' || 
      request.destination === 'font' || 
      request.destination === 'style' || 
      request.destination === 'script' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|css|js)$/)) {
    
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Stale-while-revalidate: serve cache, update in background
          fetch(request).then(response => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then(cache => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for navigation (HTML documents)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Message handling
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_NAME });
  }
});

// Notify clients of updates
self.addEventListener('controllerchange', () => {
  console.log('[SW Home] New controller activated');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
    });
  });
});
