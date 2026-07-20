/* ===========================================================
   Service Worker — الحديدي للأسماك (Main App)
   - Professional PWA with full offline support
   - Cache-first strategy for static assets
   - Network-first for Firebase / live data
   - Background sync support
   =========================================================== */

const CACHE_VERSION = 'haddidi-fish-v3.0-pro';
const STATIC_CACHE = 'haddidi-static-v3';
const DYNAMIC_CACHE = 'haddidi-dynamic-v3';

// App Shell - Critical resources
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;900&display=swap'
];

// Install event - Cache App Shell
self.addEventListener('install', (e) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => {
      console.log('[SW] App shell cached successfully');
      return self.skipWaiting();
    })
  );
});

// Activate event - Clean old caches and claim clients immediately
self.addEventListener('activate', (e) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && !key.startsWith('haddidi'))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - Smart caching strategy
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Strategy 1: Network-first for Firebase and API calls
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') || 
      url.hostname.includes('identitytoolkit') ||
      url.pathname.includes('/firebase/') ||
      url.pathname.includes('.json')) {
    
    e.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Strategy 2: Cache-first for static assets (images, fonts, css, js)
  if (request.destination === 'image' || 
      request.destination === 'font' || 
      request.destination === 'style' || 
      request.destination === 'script' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|css|js)$/)) {
    
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Update cache in background (stale-while-revalidate)
          fetch(request).then(response => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then(cache => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Strategy 3: Network-first for HTML documents (navigation)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached index.html for offline
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Default: Network with cache fallback
  e.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Message handling
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (e.data && e.data.type === 'GET_VERSION') {
    e.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
  
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
});

// Notify clients when new SW takes over
self.addEventListener('controllerchange', () => {
  console.log('[SW] New controller activated');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
    });
  });
});

// Background sync for offline operations (if supported)
self.addEventListener('sync', (e) => {
  console.log('[SW] Background sync:', e.tag);
  if (e.tag === 'sync-invoices') {
    e.waitUntil(syncInvoices());
  }
});

async function syncInvoices() {
  // Placeholder for background sync logic
  console.log('[SW] Syncing invoices in background...');
}

// Push notification handling (if enabled later)
self.addEventListener('push', (e) => {
  if (!e.data) return;
  
  const data = e.data.json();
  const options = {
    body: data.body || 'تحديث جديد',
    icon: './icon-192.png',
    badge: './icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: data.url || './'
  };
  
  e.waitUntil(
    self.registration.showNotification(data.title || 'الحديدي للأسماك', options)
  );
};

// Notification click handler
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url.includes('./index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(e.notification.data || './');
      }
    })
  );
});
