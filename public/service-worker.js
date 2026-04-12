const CACHE_NAME = 'jewelry-3d-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  if (
    url.includes('supabase.co') ||
    url.includes('supabase.io') ||
    url.includes('/auth') ||
    url.includes('/api/') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request);
    })
  );
});
