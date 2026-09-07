import { describe, expect, it } from 'vitest';
import { formatDuration, formatKm, setVolume, setsVolume, summarizeStrength } from './volume';
import type { WorkoutSession } from '../data/types';

describe('볼륨 계산 (요구사항 19절)', () => {
  it('세트 볼륨 = 중량 × 반복수', () => {
    expect(setVolume({ weight: 40, reps: 15 })).toBe(600);
  });

  it('총 볼륨은 모든 세트의 합', () => {
    expect(setsVolume([
      { weight: 40, reps: 15 },
      { weight: 40, reps: 15 },
      { weight: 45, reps: 13 },
    ])).toBe(1785);
  });

  it('맨몸 운동(0kg)은 볼륨 0으로 계산된다', () => {
    expect(setVolume({ weight: 0, reps: 20 })).toBe(0);
  });

  it('러닝 세션에 볼륨 요약을 쓰면 예외를 던진다 (데이터 혼선 방지)', () => {
    const run: WorkoutSession = {
      id: 's1', date: '2026-09-07', workoutType: 'RUNNING',
      startTime: 0, endTime: 100, duration: 100, notes: '', condition: null,
      completed: true, xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0,
      run: { id: 'r1', sessionId: 's1', distanceKm: 6.8, duration: 100, completed: true, createdAt: 0 },
    };
    expect(() => summarizeStrength(run)).toThrow();
  });

  it('완료하지 않은 세트는 집계에서 빠진다', () => {
    const session: WorkoutSession = {
      id: 's2', date: '2026-09-07', workoutType: 'STRENGTH_A',
      startTime: 0, endTime: 100, duration: 100, notes: '', condition: null,
      completed: true, xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0,
      sets: [
        { id: 'a', sessionId: 's2', exerciseId: 'lat-pulldown', setNumber: 1, weight: 40, reps: 15, completed: true, createdAt: 0 },
        { id: 'b', sessionId: 's2', exerciseId: 'lat-pulldown', setNumber: 2, weight: 40, reps: 15, completed: false, createdAt: 0 },
      ],
    };
    expect(summarizeStrength(session)).toEqual({
      totalSets: 1, totalReps: 15, totalVolume: 600, exerciseCount: 1,
    });
  });
});

describe('표시 형식', () => {
  it('거리를 읽기 좋게 만든다', () => {
    expect(formatKm(5)).toBe('5km');
    expect(formatKm(6.8)).toBe('6.8km');
    expect(formatKm(6.25)).toBe('6.25km');
  });
  it('시간을 읽기 좋게 만든다', () => {
    expect(formatDuration(3120)).toBe('52분');
    expect(formatDuration(4320)).toBe('1시간 12분');
    expect(formatDuration(45)).toBe('45초');
  });
});
