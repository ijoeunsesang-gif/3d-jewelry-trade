const CACHE_NAME = 'jewelry-3d-v1';
const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // 절대 캐시하면 안 되는 것들 - 네트워크 직접 통신
  if (
    url.includes('supabase.co') ||
    url.includes('supabase.io') ||
    url.includes('/auth') ||
    url.includes('/api/') ||
    e.request.method !== 'GET'
  ) {
    return; // 서비스 워커 개입 안 함
  }

  // 정적 자산만 캐시
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request);
    })
  );
});
