const CACHE_VERSION = 'geocatalyst-v1.0.0'; // Update this version with each deployment

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_VERSION) {
                        console.log('Service Worker: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Network-first strategy for your app
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone the response
                const responseToCache = response.clone();
                
                // Cache the fetched response
                caches.open(CACHE_VERSION).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                
                return response;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});