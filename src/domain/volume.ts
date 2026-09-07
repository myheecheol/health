import { isStrengthSession } from '../data/types';
import type { SetRecord, WorkoutSession } from '../data/types';

/** 세트 하나의 볼륨 = 중량 × 반복수 (요구사항 19절) */
export function setVolume(set: Pick<SetRecord, 'weight' | 'reps'>): number {
  return set.weight * set.reps;
}

export function setsVolume(sets: Pick<SetRecord, 'weight' | 'reps'>[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0);
}

/**
 * 웨이트 세션 요약.
 * 러닝 세션에는 볼륨 개념을 적용하지 않으므로 이 함수는 웨이트만 받습니다.
 */
export function summarizeStrength(session: WorkoutSession) {
  if (!isStrengthSession(session)) {
    throw new TypeError('summarizeStrength는 근력 세션에만 사용합니다');
  }
  const done = session.sets.filter((s) => s.completed);
  return {
    totalSets: done.length,
    totalReps: done.reduce((sum, s) => sum + s.reps, 0),
    totalVolume: setsVolume(done),
    exerciseCount: new Set(done.map((s) => s.exerciseId)).size,
  };
}

/** 볼륨/중량 표시 포맷 */
export function formatKg(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function formatVolume(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

/** 초 → "52분" / "1시간 12분" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분`;
  return `${total}초`;
}

/** 초 → "00:41:25" (진행 중 타이머용) */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

/** 초 → "01:24" (휴식 타이머용) */
export function formatMMSS(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 60))}:${p(total % 60)}`;
}

export function formatKm(km: number): string {
  return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(km * 100 % 10 === 0 ? 1 : 2)}km`;
}
