import { describe, expect, it } from 'vitest';
import { computeStreak, nextStreakMilestone } from './streak';
import type { WorkoutSession, WorkoutType } from '../data/types';

let seq = 0;
function s(date: string, type: WorkoutType = 'STRENGTH_A', completed = true): WorkoutSession {
  const id = `s${seq++}`;
  const base = {
    id, date, startTime: Date.parse(`${date}T09:00:00`) + seq, endTime: null,
    duration: 100, notes: '', condition: null, completed,
    xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0,
  };
  if (type === 'RUNNING') {
    return { ...base, workoutType: 'RUNNING',
      run: { id: `r${id}`, sessionId: id, distanceKm: 5, duration: 100, completed, createdAt: 0 } };
  }
  return { ...base, workoutType: type, sets: [] };
}

describe('연속 운동 계산', () => {
  it('기록이 없으면 0이다', () => {
    expect(computeStreak([])).toEqual({ current: 0, best: 0 });
  });

  it('매일 운동하면 계속 쌓인다', () => {
    const r = computeStreak([s('2026-09-01'), s('2026-09-02'), s('2026-09-03')]);
    expect(r.current).toBe(3);
  });

  it('근력과 러닝을 가리지 않고 모두 센다', () => {
    const r = computeStreak([
      s('2026-09-01', 'STRENGTH_A'),
      s('2026-09-02', 'RUNNING'),
      s('2026-09-03', 'STRENGTH_B'),
    ]);
    expect(r.current).toBe(3);
  });

  it('사흘까지 쉬어도 이어진다', () => {
    // 9/01 → 9/04 는 3일 공백
    expect(computeStreak([s('2026-09-01'), s('2026-09-04')]).current).toBe(2);
  });

  it('나흘 넘게 쉬면 1부터 다시 센다', () => {
    expect(computeStreak([s('2026-09-01'), s('2026-09-06')]).current).toBe(1);
  });

  it('끊겨도 최고 기록은 남는다', () => {
    const r = computeStreak([
      s('2026-09-01'), s('2026-09-02'), s('2026-09-03'), // 3연속
      s('2026-09-20'),                                    // 끊김
    ]);
    expect(r.current).toBe(1);
    expect(r.best).toBe(3);
  });

  it('하루에 두 번 운동하면 둘 다 센다', () => {
    expect(computeStreak([s('2026-09-01'), s('2026-09-01', 'RUNNING')]).current).toBe(2);
  });

  it('완료하지 않은 운동은 세지 않는다', () => {
    expect(computeStreak([s('2026-09-01'), s('2026-09-02', 'STRENGTH_A', false)]).current).toBe(1);
  });

  it('삭제된 운동은 세지 않는다', () => {
    const deleted = { ...s('2026-09-02'), deletedAt: Date.now() };
    expect(computeStreak([s('2026-09-01'), deleted]).current).toBe(1);
  });

  it('해를 넘겨도 정확하다', () => {
    expect(computeStreak([s('2025-12-31'), s('2026-01-02')]).current).toBe(2);
  });
});

describe('다음 목표', () => {
  it('현재보다 큰 첫 목표를 알려준다', () => {
    expect(nextStreakMilestone(0)).toBe(3);
    expect(nextStreakMilestone(4)).toBe(7);
    expect(nextStreakMilestone(7)).toBe(14);
  });
  it('마지막 목표를 넘으면 없다', () => {
    expect(nextStreakMilestone(200)).toBeNull();
  });
});
