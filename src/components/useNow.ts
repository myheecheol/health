import { useEffect, useState } from 'react';

/**
 * 일정 간격으로 현재 시각을 갱신합니다.
 * 타이머를 "카운트를 세는 변수"가 아니라 "startTime 기준 계산"으로 만들기 위한 장치라,
 * 탭이 백그라운드로 갔다 와도, 새로고침을 해도 경과 시간이 정확합니다.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
