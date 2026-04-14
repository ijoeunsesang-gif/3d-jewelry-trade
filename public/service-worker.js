const STATIC_CACHE = 'jewelry-3d-static-v1';

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

  // 항상 네트워크로: supabase, auth, api, non-GET, HTML navigation
  if (
    url.includes('supabase.co') ||
    url.includes('supabase.io') ||
    url.includes('/auth') ||
    url.includes('/api/') ||
    e.request.method !== 'GET' ||
    e.request.mode === 'navigate'
  ) {
    return;
  }

  // /_next/static/ 경로만 cache-first
  if (url.includes('/_next/static/')) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // 나머지는 네트워크만
});
