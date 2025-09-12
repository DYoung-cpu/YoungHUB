// Service Worker for Family Finance Hub
// Handles background location tracking and offline functionality

const CACHE_NAME = 'family-hub-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Background sync for location updates
self.addEventListener('sync', event => {
  if (event.tag === 'location-update') {
    event.waitUntil(sendLocationUpdate());
  }
});

// Periodic background sync (when supported)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'track-location') {
    event.waitUntil(trackLocation());
  }
});

// Push notification support
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Location update',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Family Hub', options)
  );
});

// Send location update to server
async function sendLocationUpdate() {
  try {
    const position = await getCurrentPosition();
    
    // Send to Supabase
    const response = await fetch('/api/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send location:', error);
    return false;
  }
}

// Get current position using Geolocation API
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

// Track location in background
async function trackLocation() {
  try {
    // Request permission if needed
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    
    if (permission.state === 'granted') {
      await sendLocationUpdate();
      
      // Schedule next update
      if ('BackgroundFetch' in self) {
        await self.registration.backgroundFetch.fetch('location-track', ['/api/location'], {
          title: 'Tracking location',
          icons: [{
            sizes: '192x192',
            src: '/icon-192.png',
            type: 'image/png',
          }],
          downloadTotal: 0
        });
      }
    }
  } catch (error) {
    console.error('Background tracking failed:', error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'START_TRACKING') {
    // Start periodic location tracking
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.register('track-location', {
        minInterval: 5 * 60 * 1000 // 5 minutes
      });
    }
  }
  
  if (event.data && event.data.type === 'STOP_TRACKING') {
    // Stop tracking
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.unregister('track-location');
    }
  }
});