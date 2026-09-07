import { getExercise } from '../config/routines';
import { isStrengthSession } from '../data/types';
import type { ExerciseStats, SetRecord, StrengthSession, WorkoutSession } from '../data/types';
import { setVolume, setsVolume } from './volume';

/**
 * 완료된 근력 세션을 반영해 종목별 캐시를 갱신합니다.
 * 이 캐시가 "지난 기록 흐릿하게 보여주기"와 PR 판정의 원천입니다.
 */
export function applySessionToStats(
  stats: Record<string, ExerciseStats>,
  session: WorkoutSession,
): { stats: Record<string, ExerciseStats>; personalRecords: PersonalRecord[] } {
  if (!isStrengthSession(session)) return { stats, personalRecords: [] };

  const next = { ...stats };
  const prs: PersonalRecord[] = [];
  const byExercise = groupByExercise(session);

  for (const [exerciseId, sets] of byExercise) {
    const done = sets.filter((s) => s.completed);
    if (done.length === 0) continue;

    const prev = stats[exerciseId];
    const maxWeight = Math.max(...done.map((s) => s.weight));
    const maxReps = Math.max(...done.map((s) => s.reps));
    const maxSetVolume = Math.max(...done.map(setVolume));
    const sessionVolume = setsVolume(done);

    if (prev) {
      if (maxWeight > prev.maxWeight) {
        prs.push({ exerciseId, kind: 'weight', previous: prev.maxWeight, current: maxWeight });
      }
      if (maxReps > prev.maxReps) {
        prs.push({ exerciseId, kind: 'reps', previous: prev.maxReps, current: maxReps });
      }
      if (sessionVolume > prev.maxSessionVolume) {
        prs.push({ exerciseId, kind: 'volume', previous: prev.maxSessionVolume, current: sessionVolume });
      }
    }

    next[exerciseId] = {
      exerciseId,
      lastSets: done
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((s) => ({ weight: s.weight, reps: s.reps })),
      lastSessionId: session.id,
      lastDate: session.date,
      maxWeight: Math.max(prev?.maxWeight ?? 0, maxWeight),
      maxReps: Math.max(prev?.maxReps ?? 0, maxReps),
      maxSetVolume: Math.max(prev?.maxSetVolume ?? 0, maxSetVolume),
      maxSessionVolume: Math.max(prev?.maxSessionVolume ?? 0, sessionVolume),
      updatedAt: Date.now(),
    };
  }

  return { stats: next, personalRecords: prs };
}

export interface PersonalRecord {
  exerciseId: string;
  kind: 'weight' | 'reps' | 'volume';
  previous: number;
  current: number;
}

export function prLabel(pr: PersonalRecord): string {
  const name = getExercise(pr.exerciseId)?.name ?? pr.exerciseId;
  const unit = pr.kind === 'weight' ? 'kg' : pr.kind === 'reps' ? '회' : 'kg';
  const kindLabel = pr.kind === 'weight' ? '최고 중량' : pr.kind === 'reps' ? '최고 반복' : '최고 볼륨';
  return `${name} ${kindLabel} ${pr.previous}${unit} → ${pr.current}${unit}`;
}

function groupByExercise(session: StrengthSession): Map<string, SetRecord[]> {
  const map = new Map<string, SetRecord[]>();
  for (const set of session.sets) {
    const list = map.get(set.exerciseId);
    if (list) list.push(set);
    else map.set(set.exerciseId, [set]);
  }
  return map;
}

/**
 * 세트 완료 직후 보여줄 비교 피드백 (요구사항 6절).
 * 지난 같은 번호 세트와 비교합니다.
 */
export function compareWithLast(
  stats: ExerciseStats | undefined,
  setNumber: number,
  weight: number,
  reps: number,
): string | null {
  const prev = stats?.lastSets[setNumber - 1];
  if (!prev) return null;

  const dw = weight - prev.weight;
  const dr = reps - prev.reps;
  const parts: string[] = [];
  if (dw > 0) parts.push(`+${round1(dw)}kg`);
  else if (dw < 0) parts.push(`${round1(dw)}kg`);
  if (dr > 0) parts.push(`+${dr}회`);
  else if (dr < 0) parts.push(`${dr}회`);

  if (parts.length === 0) return null;
  const improved = dw > 0 || (dw === 0 && dr > 0);
  return `${improved ? '지난번보다 ' : '지난번보다 '}${parts.join(' ')}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
