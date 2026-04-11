const CACHE_NAME = 'jewelry-3d-market-v2';

// Next.js에 실제로 존재하는 정적 파일만 캐시
const ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 캐시에서 제외할 요청 패턴 (API, Supabase, 인증 등)
const SKIP_CACHE = [
  'supabase.co',
  '/api/',
  '/auth/',
  'storage.googleapis.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // API·Supabase·인증 요청은 캐시 완전 우회 (항상 네트워크 직접 요청)
  const shouldSkip = SKIP_CACHE.some(pattern => url.includes(pattern));
  if (shouldSkip) return;

  // GET 요청이 아니면 우회
  if (event.request.method !== 'GET') return;

  // 나머지: 네트워크 우선, 실패 시 캐시 사용
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // 정상 응답만 캐시에 저장
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
