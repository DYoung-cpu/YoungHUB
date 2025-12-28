// Service Worker for Family Finance Hub
// Handles push notifications only - location tracking handled in main app

const CACHE_NAME = 'family-hub-v3';

// Only cache static assets, NOT HTML or JS (to avoid stale content issues)
const urlsToCache = [
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    Promise.all([
      // Clean up all old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - NETWORK FIRST for HTML/JS, cache only for manifest
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache HTML or JS files - always get fresh from network
  if (event.request.destination === 'document' ||
      event.request.destination === 'script' ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Background sync - disabled since geolocation doesn't work in service workers
self.addEventListener('sync', event => {
  console.log('Service Worker: Sync event received', event.tag);
  // Location tracking is handled in the main app, not here
});

// Push notification support
self.addEventListener('push', event => {
  let data = {
    title: 'Family Vault',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    data: {}
  };

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

// Message handler for communication with main app
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data?.type);

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

  // Location tracking messages - just acknowledge, tracking done in main app
  if (event.data && (event.data.type === 'START_TRACKING' || event.data.type === 'STOP_TRACKING')) {
    console.log('Service Worker: Location tracking managed by main app');
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'snooze' || event.action === 'dismiss') {
    return;
  }

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
        for (const client of clientList) {
          if ((client.url.includes('localhost') || client.url.includes('vercel.app')) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data
            });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
