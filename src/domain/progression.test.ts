import { describe, expect, it } from 'vitest';
import { getNextStrengthRoutine } from './progression';
import type { StrengthType, WorkoutSession, WorkoutType } from '../data/types';

let clock = 1_000;

function session(type: WorkoutType, completed = true): WorkoutSession {
  const t = (clock += 1000);
  const base = {
    id: `s${t}`,
    date: '2026-09-07',
    startTime: t,
    endTime: t + 100,
    duration: 100,
    notes: '',
    condition: null,
    completed,
    xpEarned: 0,
    pointsEarned: 0,
    deletedAt: null,
    updatedAt: t,
  };
  if (type === 'RUNNING') {
    return {
      ...base,
      workoutType: 'RUNNING',
      run: { id: `r${t}`, sessionId: base.id, distanceKm: 6.4, duration: 100, completed, createdAt: t },
    };
  }
  return { ...base, workoutType: type as StrengthType, sets: [] };
}

describe('getNextStrengthRoutine — 러닝은 A/B 순서에 영향을 주지 않는다', () => {
  it('기록이 없으면 A를 추천한다', () => {
    expect(getNextStrengthRoutine([])).toBe('STRENGTH_A');
  });

  it('러닝만 여러 번 했어도 여전히 A를 추천한다', () => {
    const sessions = [session('RUNNING'), session('RUNNING'), session('RUNNING')];
    expect(getNextStrengthRoutine(sessions)).toBe('STRENGTH_A');
  });

  it('A 다음은 B다', () => {
    expect(getNextStrengthRoutine([session('STRENGTH_A')])).toBe('STRENGTH_B');
  });

  it('A → 러닝 6km → 러닝 8km 이후에도 다음은 B다', () => {
    const sessions = [session('STRENGTH_A'), session('RUNNING'), session('RUNNING')];
    expect(getNextStrengthRoutine(sessions)).toBe('STRENGTH_B');
  });

  it('B → 러닝 8.5km 이후에도 다음은 A다', () => {
    const sessions = [session('STRENGTH_B'), session('RUNNING')];
    expect(getNextStrengthRoutine(sessions)).toBe('STRENGTH_A');
  });

  it('A → 러닝 → B → 러닝 → A 이후 다음은 B다', () => {
    const sessions = [
      session('STRENGTH_A'),
      session('RUNNING'),
      session('STRENGTH_B'),
      session('RUNNING'),
      session('STRENGTH_A'),
    ];
    expect(getNextStrengthRoutine(sessions)).toBe('STRENGTH_B');
  });

  it('배열 순서가 뒤섞여 있어도 시간 기준으로 판단한다', () => {
    const a = session('STRENGTH_A');
    const run = session('RUNNING');
    const b = session('STRENGTH_B');
    expect(getNextStrengthRoutine([b, run, a])).toBe('STRENGTH_A');
  });

  it('완료하지 않은 근력 세션은 무시한다', () => {
    const sessions = [session('STRENGTH_A'), session('STRENGTH_B', false)];
    expect(getNextStrengthRoutine(sessions)).toBe('STRENGTH_B');
  });

  it('삭제된 세션은 무시한다', () => {
    const a = session('STRENGTH_A');
    const b = { ...session('STRENGTH_B'), deletedAt: Date.now() };
    expect(getNextStrengthRoutine([a, b])).toBe('STRENGTH_B');
  });

  it('사용자가 직접 지정하면 그 값을 따른다', () => {
    const sessions = [session('STRENGTH_A')];
    expect(getNextStrengthRoutine(sessions, 'STRENGTH_A')).toBe('STRENGTH_A');
  });
});
