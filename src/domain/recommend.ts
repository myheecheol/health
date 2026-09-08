import type { Exercise, ExerciseStats } from '../data/types';

/**
 * 점진적 과부하 추천 (요구사항 35절).
 *
 * 지난 운동에서 모든 세트를 목표 반복수 이상으로 끝냈다면 중량을 올릴 때입니다.
 * 자동으로 채우지 않고 제안만 합니다 — 몸 상태는 본인만 압니다.
 */
export interface WeightSuggestion {
  suggested: number;
  previous: number;
  message: string;
}

export function recommendWeight(
  exercise: Exercise,
  stats: ExerciseStats | undefined,
): WeightSuggestion | null {
  const lastSets = stats?.lastSets ?? [];
  if (lastSets.length === 0) return null;

  // 정해진 세트를 다 채우지 못했으면 아직 올릴 때가 아닙니다.
  if (lastSets.length < exercise.defaultSets) return null;
  if (!lastSets.every((s) => s.reps >= exercise.targetReps)) return null;

  const previous = Math.max(...lastSets.map((s) => s.weight));
  const suggested = Math.round((previous + exercise.weightIncrement) * 100) / 100;

  return {
    suggested,
    previous,
    message: `지난번 ${exercise.targetReps}회를 전 세트 채웠습니다`,
  };
}

/** 프리뷰 화면에서 "중량을 올려볼 종목"을 세는 데 씁니다. */
export function countReadyToIncrease(
  exercises: Exercise[],
  stats: Record<string, ExerciseStats>,
): number {
  return exercises.filter((ex) => recommendWeight(ex, stats[ex.id]) !== null).length;
}
