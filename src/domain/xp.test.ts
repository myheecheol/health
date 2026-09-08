import { describe, expect, it } from 'vitest';
import { getExercisesFor } from '../config/routines';
import { computeSessionXp, xpToPoints } from './xp';
import type { SetRecord, StrengthSession, StrengthType, WorkoutSession } from '../data/types';

const EMPTY_CTX = { currentStreak: 1, totalSessions: 1, personalRecords: [] };

/** 루틴의 모든 종목·세트를 목표 반복수로 채운 완벽한 세션 */
function fullRoutine(type: StrengthType): StrengthSession {
  const sets: SetRecord[] = [];
  for (const ex of getExercisesFor(type)) {
    for (let n = 1; n <= ex.defaultSets; n++) {
      sets.push({
        id: `${ex.id}-${n}`, sessionId: 's', exerciseId: ex.id, setNumber: n,
        weight: 40, reps: ex.targetReps, completed: true, createdAt: 0,
      });
    }
  }
  return {
    id: 's', date: '2026-09-08', workoutType: type, startTime: 0, endTime: 1,
    duration: 3000, notes: '', condition: null, completed: true,
    xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0, sets,
  };
}

function run(km: number): WorkoutSession {
  return {
    id: 'r', date: '2026-09-08', workoutType: 'RUNNING', startTime: 0, endTime: 1,
    duration: 2400, notes: '', condition: null, completed: true,
    xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0,
    run: { id: 'rr', sessionId: 'r', distanceKm: km, duration: 2400, completed: true, createdAt: 0 },
  };
}

/** 이 앱의 보상 경제 기준선. 약속 = 300P */
const YAKSOK = 300;

describe('보상 밸런스 — 운동 2~3번이면 약속 한 번', () => {
  it('근력 A 루틴 2번이면 약속을 갈 수 있다', () => {
    const once = computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX).points;
    expect(once * 2).toBeGreaterThanOrEqual(YAKSOK);
  });

  it('근력 B 루틴 2번이면 약속을 갈 수 있다', () => {
    const once = computeSessionXp(fullRoutine('STRENGTH_B'), EMPTY_CTX).points;
    expect(once * 2).toBeGreaterThanOrEqual(YAKSOK);
  });

  it('근력 1번만으로는 약속을 갈 수 없다 (너무 쉬우면 안 됨)', () => {
    const once = computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX).points;
    expect(once).toBeLessThan(YAKSOK);
  });

  it('러닝 6.8km 3번이면 약속을 갈 수 있다', () => {
    const once = computeSessionXp(run(6.8), EMPTY_CTX).points;
    expect(once * 3).toBeGreaterThanOrEqual(YAKSOK);
  });

  it('러닝 6.8km 2번으로는 약속을 갈 수 없다', () => {
    const once = computeSessionXp(run(6.8), EMPTY_CTX).points;
    expect(once * 2).toBeLessThan(YAKSOK);
  });

  it('근력 1번 + 러닝 2번이면 약속을 갈 수 있다', () => {
    const a = computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX).points;
    const r = computeSessionXp(run(6.8), EMPTY_CTX).points;
    expect(a + r * 2).toBeGreaterThanOrEqual(YAKSOK);
  });

  it('운동 1회로 일반식(100P)은 바로 바꿀 수 있다', () => {
    expect(computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX).points).toBeGreaterThanOrEqual(100);
    expect(computeSessionXp(run(6.8), EMPTY_CTX).points).toBeGreaterThanOrEqual(100);
  });

  it('놀러가기(500P)는 서너 번 모아야 한다', () => {
    const a = computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX).points;
    expect(a * 2).toBeLessThan(500);
    expect(a * 4).toBeGreaterThanOrEqual(500);
  });
});

describe('XP 계산 규칙', () => {
  it('A 루틴을 완벽히 끝내면 항목별로 합산된다', () => {
    const r = computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX);
    // 26세트×5 + 26세트 목표달성×5 + 6종목×10 + 루틴완료 50
    expect(r.total).toBe(26 * 5 + 26 * 5 + 6 * 10 + 50);
    expect(r.lines.map((l) => l.reason)).toEqual([
      'SET_COMPLETE', 'TARGET_REPS_HIT', 'EXERCISE_COMPLETE', 'ROUTINE_COMPLETE',
    ]);
  });

  it('러닝은 거리에 비례한다', () => {
    expect(computeSessionXp(run(5), EMPTY_CTX).total).toBe(150);
    expect(computeSessionXp(run(6.8), EMPTY_CTX).total).toBe(204);
    expect(computeSessionXp(run(10), EMPTY_CTX).total).toBe(300);
  });

  it('아주 긴 러닝은 상한에서 잘린다', () => {
    expect(computeSessionXp(run(100), EMPTY_CTX).total).toBe(450);
  });

  it('러닝에는 루틴 완료나 세트 XP가 붙지 않는다', () => {
    const reasons = computeSessionXp(run(5), EMPTY_CTX).lines.map((l) => l.reason);
    expect(reasons).toEqual(['RUNNING_DISTANCE']);
  });

  it('개인 최고 기록마다 XP가 붙는다', () => {
    const base = computeSessionXp(fullRoutine('STRENGTH_A'), EMPTY_CTX).total;
    const withPr = computeSessionXp(fullRoutine('STRENGTH_A'), {
      ...EMPTY_CTX,
      personalRecords: [
        { exerciseId: 'lat-pulldown', kind: 'weight', previous: 40, current: 45 },
        { exerciseId: 'pec-deck', kind: 'reps', previous: 12, current: 15 },
      ],
    }).total;
    expect(withPr - base).toBe(60);
  });

  it('7회 연속마다 보너스가 붙는다', () => {
    const at7 = computeSessionXp(run(5), { ...EMPTY_CTX, currentStreak: 7 }).total;
    const at8 = computeSessionXp(run(5), { ...EMPTY_CTX, currentStreak: 8 }).total;
    const at14 = computeSessionXp(run(5), { ...EMPTY_CTX, currentStreak: 14 }).total;
    expect(at7 - at8).toBe(100);
    expect(at14 - at8).toBe(100);
  });

  it('누적 30회 보너스는 딱 한 번만 붙는다', () => {
    const at30 = computeSessionXp(run(5), { ...EMPTY_CTX, totalSessions: 30 }).total;
    const at31 = computeSessionXp(run(5), { ...EMPTY_CTX, totalSessions: 31 }).total;
    expect(at30 - at31).toBe(300);
  });

  it('포인트는 XP의 절반이다', () => {
    expect(xpToPoints(204)).toBe(102);
    expect(xpToPoints(370)).toBe(185);
  });

  it('세트를 덜 하면 XP도 줄어든다', () => {
    const full = fullRoutine('STRENGTH_A');
    const half: StrengthSession = { ...full, sets: full.sets.slice(0, 10) };
    expect(computeSessionXp(half, EMPTY_CTX).total)
      .toBeLessThan(computeSessionXp(full, EMPTY_CTX).total);
  });
});
