import { POINT_RATE, XP_RULES } from '../config/gameConfig';
import { getExercise, getExercisesFor } from '../config/routines';
import { isStrengthSession, type WorkoutSession } from '../data/types';
import type { PersonalRecord } from './records';

/**
 * 세션 하나로 얻는 XP와 보상 포인트를 계산합니다 (요구사항 10절).
 *
 * 계산에 쓰인 항목을 breakdown 으로 함께 돌려주기 때문에,
 * 완료 화면에서 "어디서 몇 점을 받았는지"를 그대로 보여줄 수 있습니다.
 * 사용자가 점수의 근거를 볼 수 있어야 규칙을 신뢰합니다.
 */

export type XPReason =
  | 'SET_COMPLETE' | 'TARGET_REPS_HIT' | 'EXERCISE_COMPLETE' | 'ROUTINE_COMPLETE'
  | 'PERSONAL_RECORD' | 'RUNNING_DISTANCE' | 'STREAK_BONUS' | 'MILESTONE_BONUS';

export interface XpLine {
  reason: XPReason;
  label: string;
  detail: string;
  amount: number;
}

export interface XpResult {
  total: number;
  points: number;
  lines: XpLine[];
}

export interface XpContext {
  /** 이 세션을 포함해 계산한 연속 운동 횟수 */
  currentStreak: number;
  /** 이 세션을 포함한 총 운동 횟수 */
  totalSessions: number;
  personalRecords: PersonalRecord[];
}

export function computeSessionXp(session: WorkoutSession, ctx: XpContext): XpResult {
  const lines: XpLine[] = [];
  const add = (reason: XPReason, label: string, detail: string, amount: number) => {
    if (amount > 0) lines.push({ reason, label, detail, amount });
  };

  if (isStrengthSession(session)) {
    const sets = session.sets.filter((s) => s.completed);

    add('SET_COMPLETE', '세트 완료', `${sets.length}세트 × ${XP_RULES.SET_COMPLETE}`,
      sets.length * XP_RULES.SET_COMPLETE);

    const onTarget = sets.filter((s) => {
      const ex = getExercise(s.exerciseId);
      return ex ? s.reps >= ex.targetReps : false;
    }).length;
    add('TARGET_REPS_HIT', '목표 반복 달성', `${onTarget}세트 × ${XP_RULES.TARGET_REPS_HIT}`,
      onTarget * XP_RULES.TARGET_REPS_HIT);

    // 종목별로 정해진 세트를 다 채웠는지 확인합니다.
    const counts = new Map<string, number>();
    for (const s of sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);

    const routineExercises = getExercisesFor(session.workoutType);
    const finished = routineExercises.filter((ex) => (counts.get(ex.id) ?? 0) >= ex.defaultSets);
    add('EXERCISE_COMPLETE', '운동 완료', `${finished.length}종목 × ${XP_RULES.EXERCISE_COMPLETE}`,
      finished.length * XP_RULES.EXERCISE_COMPLETE);

    if (finished.length === routineExercises.length && routineExercises.length > 0) {
      add('ROUTINE_COMPLETE', '루틴 전체 완료',
        session.workoutType === 'STRENGTH_A' ? 'A 루틴' : 'B 루틴', XP_RULES.ROUTINE_COMPLETE);
    }
  } else {
    // 러닝은 실제 달린 거리로만 계산합니다. 상한을 넘으면 잘립니다.
    const raw = Math.round(session.run.distanceKm * XP_RULES.RUNNING_PER_KM);
    const capped = XP_RULES.RUNNING_SESSION_MAX === null
      ? raw
      : Math.min(raw, XP_RULES.RUNNING_SESSION_MAX);
    add('RUNNING_DISTANCE', '러닝 거리',
      `${session.run.distanceKm}km × ${XP_RULES.RUNNING_PER_KM}${capped < raw ? ' (상한 적용)' : ''}`,
      capped);
  }

  // 개인 최고 기록은 근력에서만 나옵니다.
  if (ctx.personalRecords.length > 0) {
    add('PERSONAL_RECORD', '개인 최고 기록',
      `${ctx.personalRecords.length}개 × ${XP_RULES.PERSONAL_RECORD}`,
      ctx.personalRecords.length * XP_RULES.PERSONAL_RECORD);
  }

  // 지속성 보너스 — 7의 배수마다
  if (ctx.currentStreak > 0 && ctx.currentStreak % 7 === 0) {
    add('STREAK_BONUS', '연속 운동 보너스', `${ctx.currentStreak}회 연속`, XP_RULES.STREAK_7);
  }
  // 누적 30회 보너스 — 딱 한 번
  if (ctx.totalSessions === 30) {
    add('MILESTONE_BONUS', '누적 운동 보너스', '30회 달성', XP_RULES.TOTAL_30);
  }

  let total = lines.reduce((sum, l) => sum + l.amount, 0);
  if (XP_RULES.DAILY_MAX !== null) total = Math.min(total, XP_RULES.DAILY_MAX);

  return { total, points: Math.round(total * POINT_RATE), lines };
}

/** XP → 보상 포인트. 이 변환은 여기 한 곳에서만 합니다. */
export function xpToPoints(xp: number): number {
  return Math.round(xp * POINT_RATE);
}
