const CACHE_NAME = 'manousha-v9-live';
const ASSETS = [
  './',
  './index.html',
  './manousha.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => cached || caches.match('./manousha.html') || caches.match('./index.html'));
      })
  );
});

// Handle Background Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'منوشة 💜', body: 'وصلتك نبضة جديدة في تطبيق منوشة!' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'منوشة 💜', {
      body: data.body || data.message || 'نبضة قلب جديدة 💜',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [300, 150, 300, 150, 500],
      tag: 'manousha-alert',
      renotify: true,
      requireInteraction: true,
      data: { url: './manousha.html' }
    })
  );
});

// Handle Direct PostMessage from Page to Service Worker for Background Notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'منوشة 💜', {
        body: body || 'نبضة قلب جديدة 💜',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [300, 150, 300, 150, 500],
        tag: tag || 'manousha-alert',
        renotify: true,
        requireInteraction: true,
        data: { url: './manousha.html' }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('manousha') || client.url.includes('index')) {
          if ('focus' in client) return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./manousha.html');
    })
  );
});
