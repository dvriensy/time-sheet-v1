/**
 * WORKSPACE Service Worker (public/sw.js)
 * Handles background push alerts, shift reminders, and offline caching
 */

const CACHE_NAME = 'workspace-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo.jpg'
];

// Install Event: cache core app shell and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some assets could not be precached:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: clean older caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push Event: Handle background push notifications when the site/tab is closed
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'WORKSPACE Alert', body: event.data.text() };
    }
  }

  const title = data.title || 'WORKSPACE • 5:00 PM Shift Reminder';
  const options = {
    body: data.body || "Your workday shift has ended! Tap here to open the shift logger and record your hours.",
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/?tab=timesheet&action=log-shift',
      dateOfArrival: Date.now(),
      tag: data.tag || 'workday-shift-reminder-5pm'
    },
    actions: [
      { action: 'open_logger', title: 'Open Shift Logger' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: data.tag || 'workday-shift-reminder-5pm',
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event: Opens the shift logger directly when tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/?tab=timesheet&action=log-shift';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window client matching the origin is already open, focus and navigate it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'OPEN_SHIFT_LOGGER' });
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // If no window is currently open, open a new window pointing directly to the shift logger
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message Event: Allow web page to interact with service worker directly
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(
      title || 'WORKSPACE • 5:00 PM Shift Reminder',
      options || {
        body: "Your workday shift has ended! Tap here to open the shift logger and record your hours.",
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: '/?tab=timesheet&action=log-shift' },
        actions: [
          { action: 'open_logger', title: 'Open Shift Logger' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      }
    );
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
