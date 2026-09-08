import { describe, expect, it } from 'vitest';
import { monthlyRunning, volumeTrend, weeklyActivity } from './series';
import type { WorkoutSession } from '../data/types';

let n = 0;
function strength(date: string, sets: { weight: number; reps: number }[] = []): WorkoutSession {
  const id = `s${n++}`;
  return {
    id, date, workoutType: 'STRENGTH_A', startTime: Date.parse(`${date}T09:00:00`) + n,
    endTime: null, duration: 100, notes: '', condition: null, completed: true,
    xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0,
    sets: sets.map((s, i) => ({
      id: `${id}-${i}`, sessionId: id, exerciseId: 'lat-pulldown', setNumber: i + 1,
      weight: s.weight, reps: s.reps, completed: true, createdAt: 0,
    })),
  };
}
function running(date: string, km: number): WorkoutSession {
  const id = `r${n++}`;
  return {
    id, date, workoutType: 'RUNNING', startTime: Date.parse(`${date}T09:00:00`) + n,
    endTime: null, duration: 100, notes: '', condition: null, completed: true,
    xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0,
    run: { id: `rr${id}`, sessionId: id, distanceKm: km, duration: 100, completed: true, createdAt: 0 },
  };
}

const NOW = new Date(2026, 8, 8); // 2026-09-08 (화)

describe('weeklyActivity — 주별 운동 횟수', () => {
  it('요청한 주 수만큼 구간을 만든다', () => {
    expect(weeklyActivity([], 12, NOW)).toHaveLength(12);
  });

  it('기록이 없는 주도 0으로 채운다 (그래프에 구멍이 안 생기게)', () => {
    const weeks = weeklyActivity([], 4, NOW);
    expect(weeks.every((w) => w.total === 0)).toBe(true);
  });

  it('주는 월요일에 시작한다', () => {
    // 2026-09-08은 화요일 → 그 주 월요일은 09-07
    const weeks = weeklyActivity([strength('2026-09-08')], 1, NOW);
    expect(weeks[0]!.key).toBe('2026-09-07');
  });

  it('일요일 운동은 그 주(직전 월요일) 에 들어간다', () => {
    // 2026-09-06은 일요일 → 월요일은 08-31
    const weeks = weeklyActivity([strength('2026-09-06')], 2, NOW);
    expect(weeks[0]!.key).toBe('2026-08-31');
    expect(weeks[0]!.strength).toBe(1);
    expect(weeks[1]!.strength).toBe(0);
  });

  it('근력과 러닝을 따로 센다', () => {
    const weeks = weeklyActivity(
      [strength('2026-09-08'), running('2026-09-08', 5), running('2026-09-09', 6)], 1, NOW);
    expect(weeks[0]).toMatchObject({ strength: 1, running: 2, total: 3 });
  });

  it('기간을 벗어난 오래된 기록은 넣지 않는다', () => {
    const weeks = weeklyActivity([strength('2020-01-01')], 4, NOW);
    expect(weeks.every((w) => w.total === 0)).toBe(true);
  });
});

describe('volumeTrend — 볼륨 추이', () => {
  it('러닝은 아예 들어가지 않는다', () => {
    const points = volumeTrend([running('2026-09-01', 10), strength('2026-09-02', [{ weight: 40, reps: 15 }])]);
    expect(points).toHaveLength(1);
    expect(points[0]!.volume).toBe(600);
  });

  it('오래된 순으로 정렬한다', () => {
    const points = volumeTrend([
      strength('2026-09-03', [{ weight: 50, reps: 10 }]),
      strength('2026-09-01', [{ weight: 40, reps: 10 }]),
    ]);
    expect(points.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('최근 N개만 남긴다', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      strength(`2026-09-${String(i + 1).padStart(2, '0')}`, [{ weight: 40, reps: 10 }]));
    expect(volumeTrend(many, 12)).toHaveLength(12);
  });
});

describe('monthlyRunning — 월별 러닝 거리', () => {
  it('요청한 개월 수만큼 구간을 만든다', () => {
    expect(monthlyRunning([], 6, NOW)).toHaveLength(6);
  });

  it('같은 달 러닝을 합산한다', () => {
    const months = monthlyRunning([running('2026-09-01', 6.8), running('2026-09-05', 5.2)], 1, NOW);
    expect(months[0]).toMatchObject({ km: 12, runs: 2 });
  });

  it('근력 운동은 거리에 섞이지 않는다', () => {
    const months = monthlyRunning([strength('2026-09-01'), running('2026-09-02', 5)], 1, NOW);
    expect(months[0]!.km).toBe(5);
    expect(months[0]!.runs).toBe(1);
  });

  it('해를 넘겨도 구간이 이어진다', () => {
    const months = monthlyRunning([], 3, new Date(2026, 1, 15)); // 2026-02
    expect(months.map((m) => m.key)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});
