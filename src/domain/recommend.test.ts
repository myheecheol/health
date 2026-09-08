import { describe, expect, it } from 'vitest';
import { getExercise } from '../config/routines';
import { recommendWeight } from './recommend';
import type { ExerciseStats } from '../data/types';

const lat = getExercise('lat-pulldown')!;   // 목표 15회 × 5세트, 증가폭 2.5kg
const legPress = getExercise('leg-press')!; // 목표 15회 × 4세트, 증가폭 5kg

function stats(sets: { weight: number; reps: number }[]): ExerciseStats {
  return {
    exerciseId: 'x', lastSets: sets, lastSessionId: 's', lastDate: '2026-09-01',
    maxWeight: Math.max(0, ...sets.map((s) => s.weight)),
    maxReps: Math.max(0, ...sets.map((s) => s.reps)),
    maxSetVolume: 0, maxSessionVolume: 0, updatedAt: 0,
  };
}

describe('점진적 과부하 추천', () => {
  it('기록이 없으면 추천하지 않는다', () => {
    expect(recommendWeight(lat, undefined)).toBeNull();
  });

  it('모든 세트를 목표 반복수로 채웠으면 중량을 올리라고 한다', () => {
    const r = recommendWeight(lat, stats(Array(5).fill({ weight: 45, reps: 15 })));
    expect(r).toMatchObject({ previous: 45, suggested: 47.5 });
  });

  it('한 세트라도 목표에 못 미치면 추천하지 않는다', () => {
    const sets = [...Array(4).fill({ weight: 45, reps: 15 }), { weight: 45, reps: 12 }];
    expect(recommendWeight(lat, stats(sets))).toBeNull();
  });

  it('세트를 다 못 채웠으면 추천하지 않는다', () => {
    expect(recommendWeight(lat, stats(Array(3).fill({ weight: 45, reps: 15 })))).toBeNull();
  });

  it('목표를 넘겨도 추천한다', () => {
    const r = recommendWeight(lat, stats(Array(5).fill({ weight: 45, reps: 18 })));
    expect(r?.suggested).toBe(47.5);
  });

  it('하체는 더 큰 폭(5kg)으로 올린다', () => {
    const r = recommendWeight(legPress, stats(Array(4).fill({ weight: 100, reps: 15 })));
    expect(r?.suggested).toBe(105);
  });

  it('세트마다 중량이 달랐으면 가장 무거운 값을 기준으로 올린다', () => {
    const sets = [
      { weight: 40, reps: 15 }, { weight: 40, reps: 15 }, { weight: 45, reps: 15 },
      { weight: 45, reps: 15 }, { weight: 50, reps: 15 },
    ];
    expect(recommendWeight(lat, stats(sets))?.suggested).toBe(52.5);
  });
});
