const CACHE_NAME = "gps-tracker-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/stylesheets/map.css",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "https://unpkg.com/leaflet/dist/leaflet.css",
  "https://unpkg.com/leaflet/dist/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/pouchdb@9.0.0/dist/pouchdb.min.js",
  "/tracker.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return resp || fetch(event.request);
    })
  );
});

// Background sync for location tracking
self.addEventListener('sync', event => {
  if (event.tag === 'background-location-sync') {
    event.waitUntil(handleBackgroundLocationSync());
  }
});

// Handle messages from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'START_BACKGROUND_TRACKING') {
    startBackgroundTracking();
  } else if (event.data && event.data.type === 'STOP_BACKGROUND_TRACKING') {
    stopBackgroundTracking();
  }
});

let backgroundTrackingInterval;

function startBackgroundTracking() {
  // Register for background sync
  self.registration.sync.register('background-location-sync');
  
  // Set up periodic tracking (limited by browser)
  backgroundTrackingInterval = setInterval(() => {
    self.registration.sync.register('background-location-sync');
  }, 30000); // Every 30 seconds
}

function stopBackgroundTracking() {
  if (backgroundTrackingInterval) {
    clearInterval(backgroundTrackingInterval);
    backgroundTrackingInterval = null;
  }
}

async function handleBackgroundLocationSync() {
  try {
    // Notify main thread to handle location update
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_TRIGGER'
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}
