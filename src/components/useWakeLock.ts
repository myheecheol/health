import { useEffect, useRef, useState } from 'react';

/**
 * 운동하는 동안 화면이 꺼지지 않게 합니다 (Screen Wake Lock).
 *
 * 이게 없으면 휴식 알림이 제때 오지 않습니다.
 * 화면이 꺼지면 브라우저가 이 탭의 타이머를 멈추거나 크게 늦추기 때문에,
 * 60초 뒤에 울려야 할 알림이 폰을 다시 켤 때까지 오지 않습니다.
 *
 * 잠금은 화면을 가리면 브라우저가 자동으로 풀어버리므로,
 * 다시 돌아왔을 때 스스로 다시 겁니다.
 *
 * 지원하지 않는 기기(구형 iOS 등)에서는 조용히 넘어갑니다 —
 * 이 기능이 없다고 운동 기록이 안 되지는 않습니다.
 */
export function useWakeLock(enabled: boolean): { supported: boolean; active: boolean } {
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    async function acquire() {
      if (cancelled || sentinel.current || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel.current = lock;
        setActive(true);
        lock.addEventListener('release', () => {
          sentinel.current = null;
          setActive(false);
        });
      } catch {
        // 배터리 절약 모드 등으로 거부될 수 있습니다. 앱 동작에는 영향이 없습니다.
        setActive(false);
      }
    }

    function release() {
      const lock = sentinel.current;
      sentinel.current = null;
      setActive(false);
      void lock?.release().catch(() => {});
    }

    function onVisibility() {
      if (document.visibilityState === 'visible' && enabled) void acquire();
    }

    if (enabled) void acquire();
    else release();

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [enabled, supported]);

  return { supported, active };
}
