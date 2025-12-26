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

// Push notification support - handles server-sent push notifications
self.addEventListener('push', event => {
  let data = {
    title: 'Family Vault',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    data: {}
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {}
      };
    } catch (e) {
      // If not JSON, use as plain text
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    tag: data.tag,
    renotify: true,
    data: data.data,
    actions: getNotificationActions(data.data.category)
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Get appropriate actions based on notification category
function getNotificationActions(category) {
  switch (category) {
    case 'bill_reminder':
      return [
        { action: 'view', title: 'View Document' },
        { action: 'snooze', title: 'Remind Later' }
      ];
    case 'calendar_update':
      return [
        { action: 'view', title: 'View Calendar' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'urgent_item':
      return [
        { action: 'view', title: 'Take Action' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    default:
      return [
        { action: 'view', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
  }
}

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

  // Calendar update notification
  if (event.data && event.data.type === 'CALENDAR_UPDATE') {
    const { memberName, eventType, dates, action } = event.data;

    const eventIcons = {
      office: '🏢',
      wfh: '🏠',
      vacation: '🏖️',
      appointment: '📅',
      bill_due: '💰'
    };

    const icon = eventIcons[eventType] || '📅';
    const actionText = action === 'INSERT' ? 'added' : 'updated';

    const options = {
      body: `${memberName} ${actionText}: ${icon} ${eventType} on ${dates}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'calendar-update',
      renotify: true,
      data: {
        type: 'calendar',
        memberName,
        eventType,
        dates
      },
      actions: [
        { action: 'view', title: 'View Calendar' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    self.registration.showNotification('Family Calendar Updated', options);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Handle snooze action
  if (event.action === 'snooze') {
    // Could implement snooze logic here
    return;
  }

  if (event.action === 'dismiss') {
    return;
  }

  // Determine where to navigate based on notification data
  let targetUrl = '/';
  const data = event.notification.data || {};

  if (data.category === 'bill_reminder' || data.documentId) {
    targetUrl = '/?tab=documents';
  } else if (data.category === 'calendar_update' || data.calendarEventId) {
    targetUrl = '/?tab=calendar';
  } else if (data.category === 'urgent_item') {
    targetUrl = '/?tab=overview';
  } else if (data.url) {
    targetUrl = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if ((client.url.includes('localhost') || client.url.includes('vercel.app')) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data
            });
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});