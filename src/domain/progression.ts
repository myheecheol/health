import type { StrengthType, WorkoutSession } from '../data/types';

/**
 * 다음 근력 루틴을 결정하는 유일한 함수입니다 (요구사항 34절).
 * 홈, 프리뷰, 설정 화면 모두 이 함수 하나만 호출합니다.
 *
 * 핵심 규칙: 러닝은 A/B 순서에 어떤 영향도 주지 않습니다.
 * 정렬 이전에 RUNNING을 걸러내므로, 러닝을 몇 번 하든 결과가 바뀔 수 없습니다.
 */
export function getNextStrengthRoutine(
  sessions: WorkoutSession[],
  override: StrengthType | null = null,
): StrengthType {
  if (override) return override;

  let last: WorkoutSession | null = null;

  for (const s of sessions) {
    if (s.workoutType === 'RUNNING') continue; // ← 러닝 배제
    if (!s.completed) continue;
    if (s.deletedAt !== null) continue;
    const at = s.endTime ?? s.startTime;
    const lastAt = last ? (last.endTime ?? last.startTime) : -Infinity;
    if (at > lastAt) last = s;
  }

  if (!last) return 'STRENGTH_A'; // 근력 기록이 없는 첫 사용자
  return last.workoutType === 'STRENGTH_A' ? 'STRENGTH_B' : 'STRENGTH_A';
}

/** 화면 표시용 반대편 루틴 ("A로 변경" 버튼) */
export function otherRoutine(type: StrengthType): StrengthType {
  return type === 'STRENGTH_A' ? 'STRENGTH_B' : 'STRENGTH_A';
}
