/**
 * Service Worker for ExpenseTracker PWA
 */

const CACHE_NAME = 'expense-tracker-v1';
const STATIC_CACHE = 'expense-tracker-static-v1';

// Assets to cache
const STATIC_ASSETS = [
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
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );

  // Force activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and external requests
  if (event.request.method !== 'GET' ||
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle image requests (we'll add this later for blob URLs)
  if (event.request.url.includes('/api/image/')) {
    // Let the main thread handle image requests
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response.ok) {
              return response;
            }

            // Clone the response before caching
            const responseClone = response.clone();

            // Cache successful responses
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseClone);
              });

            return response;
          })
          .catch((error) => {
            console.error('Fetch failed:', error);
            // Return offline fallback for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'expense-sync') {
    event.waitUntil(syncExpenses());
  }
});

async function syncExpenses() {
  try {
    // Get pending sync data from IndexedDB
    const syncData = await getPendingSyncData();

    if (syncData && syncData.length > 0) {
      // Send data to sync service
      await sendSyncData(syncData);

      // Clear pending sync data
      await clearPendingSyncData();
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Placeholder functions for sync operations
async function getPendingSyncData() {
  // This would retrieve pending sync operations from IndexedDB
  return null;
}

async function sendSyncData(data) {
  // This would send data to sync service
  console.log('Sending sync data:', data);
}

async function clearPendingSyncData() {
  // This would clear processed sync data from IndexedDB
  console.log('Clearing pending sync data');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
