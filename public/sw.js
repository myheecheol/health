/*
 * 서비스 워커 — 앱을 즉시 띄우고, 신호가 끊겨도 열리게 합니다.
 *
 * 전략을 자원 종류에 따라 다르게 씁니다.
 *  - 화면 이동(HTML): 네트워크 먼저. 새 버전이 배포되면 바로 반영되어야 합니다.
 *  - 해시가 붙은 자원(js/css): 캐시 먼저. 내용이 바뀌면 파일 이름이 바뀌므로 안전합니다.
 *  - 그 외(아이콘 등): 캐시 먼저, 뒤에서 갱신.
 *
 * 운동 기록은 절대 여기 담기지 않습니다. 기록은 localStorage와 Firestore에 있습니다.
 */

const VERSION = 'v1';
const CACHE = `fitrpg-${VERSION}`;

self.addEventListener('install', (event) => {
  // 새 워커가 곧바로 일을 넘겨받게 합니다.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 파이어베이스 등 외부 요청은 건드리지 않습니다

  // 화면 이동 — 네트워크 먼저, 실패하면 캐시
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => (await caches.match(request)) ?? caches.match('./index.html')),
    );
    return;
  }

  // 그 외 — 캐시 먼저, 없으면 받아서 저장
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
