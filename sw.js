/* ===========================================================
   Service Worker — الحديدي للأسماك
   - Caches app shell + runtime caching
   - Network-first for Firebase / live data
   - Auto-update via SKIP_WAITING message
   =========================================================== */
const CACHE_VERSION = 'haddidi-fish-v2.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;900&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Skip non-GET
  if (e.request.method !== 'GET') return;

  // Network-first for Firebase and live data
  if (url.includes('firebase') || url.includes('googleapis') || url.includes('identitytoolkit')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for app shell, network fallback with runtime cache
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (e.request.destination === 'document') return caches.match('./index.html');
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Notify clients when a new SW takes over (triggers update toast in app)
self.addEventListener('controllerchange', () => {
  self.clients.matchAll().then(clients =>
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
  );
});
