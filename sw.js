/**
 * Service Worker for ExpenseTracker PWA
 */

const CACHE_VERSION = 9;
const CACHE_NAME = `expense-tracker-v${CACHE_VERSION}`;

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/db.js',
  '/js/ui.js',
  '/js/camera.js',
  '/js/expenses.js',
  '/js/people.js',
  '/js/settlement.js',
  '/js/sync.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install - cache core assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('SW: Deleting old cache', key);
              return caches.delete(key);
            })
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - cache-first for assets, network-first for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.href.includes('unpkg.com')) return;

  // Network-first for HTML (to get updates)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request) || caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for other assets
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'expense-sync') {
    console.log('SW: Background sync triggered');
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'ExpenseTracker', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [100, 50, 100]
    })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
