const CACHE_NAME = 'artiatech-portal-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/screenshot-desktop.png',
  '/screenshot-mobile.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of urlsToCache) {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            const isAsset = url.endsWith('.png') || url.endsWith('.ico') || url.endsWith('.json');
            if (isAsset && contentType.includes('text/html')) {
              continue;
            }
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn('SW cache notice:', url, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const reqUrl = new URL(event.request.url);
  const isImage = reqUrl.pathname.match(/\.(png|jpg|jpeg|ico|svg|webp)$/i);
  const isJson = reqUrl.pathname.endsWith('.json');

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const contentType = response.headers.get('content-type') || '';
        if ((isImage || isJson) && contentType.includes('text/html')) {
          // If Netlify returned SPA index.html for a missing asset, do NOT cache or serve as image/json
          return caches.match(event.request).then((cached) => {
            return cached || new Response('Asset not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
          });
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// Web Push / FCM Push Handler (Runs 24/7 in Background)
self.addEventListener('push', (event) => {
  let data = { title: 'أرتياتك - تنبيه جديد 🔔', body: 'لديك إشعار جديد في بوابة استوديو أرتياتك' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'لديك إشعار جديد في البوابة',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || 'artiatech-push-notification',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'أرتياتك 🔔', options)
  );
});

// Notification Click Handler - Brings User back to App
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
