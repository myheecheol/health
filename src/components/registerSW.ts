/**
 * 서비스 워커 등록.
 *
 * 개발 중에는 등록하지 않습니다 — 캐시 때문에 고친 내용이 안 보이는 일이 잦습니다.
 * 실패해도 앱 동작에는 영향이 없어야 하므로 조용히 넘어갑니다.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    // base 가 /health/ 이므로 그 경로 기준으로 등록해야 범위가 맞습니다.
    const url = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(url, { scope: './' }).catch((err) => {
      console.warn('[sw] 등록 실패 — 앱은 정상 동작합니다', err);
    });
  });
}
