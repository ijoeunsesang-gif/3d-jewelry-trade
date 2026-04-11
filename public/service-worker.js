const CACHE_NAME = 'jewelry-3d-market-v3';

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

// 설치: 정적 에셋 캐시 후 즉시 대기 건너뜀
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // 새 SW 즉시 활성화 (waiting 단계 생략)
});

// 활성화: 구버전 캐시 삭제 → 모든 탭 제어 인수 → 탭 자동 갱신
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim()) // 열려있는 모든 탭을 새 SW가 즉시 제어
      .then(() =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      )
      .then(clients => {
        // 새 SW로 교체됐음을 탭에 알려 자동 새로고침
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      })
  );
});

// fetch: API·Supabase는 완전 우회, 나머지는 네트워크 우선
self.addEventListener('fetch', event => {
  const url = event.request.url;

  const shouldSkip = SKIP_CACHE.some(pattern => url.includes(pattern));
  if (shouldSkip) return;

  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
