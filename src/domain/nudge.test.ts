import { describe, expect, it } from 'vitest';
import { pickNudge } from './nudge';
import type { Reward, User, WorkoutSession } from '../data/types';

function user(patch: Partial<User> = {}): User {
  return {
    id: 'me', name: '나', level: 1, xp: 0, rewardPoints: 0,
    currentStreak: 0, bestStreak: 0, nextRoutineOverride: null,
    settings: { restSeconds: 60, soundEnabled: true, browserNotification: false },
    dataVersion: 2, createdAt: 0, updatedAt: 0, ...patch,
  };
}
let n = 0;
function session(date: string): WorkoutSession {
  const id = `s${n++}`;
  return {
    id, date, workoutType: 'STRENGTH_A', startTime: Date.parse(`${date}T09:00:00`) + n,
    endTime: null, duration: 100, notes: '', condition: null, completed: true,
    xpEarned: 360, pointsEarned: 180, deletedAt: null, updatedAt: 0, sets: [],
  };
}
const reward = (cost: number): Reward => ({
  id: `r${cost}`, name: '약속가기', emoji: '🍺', description: '', cost, category: '', active: true,
});

describe('홈 알림 고르기', () => {
  it('기록이 없으면 첫 운동을 권한다', () => {
    expect(pickNudge({ user: user(), sessions: [], rewards: [] })?.id).toBe('first');
  });

  it('연속 기록이 오늘 끊길 상황을 가장 먼저 알린다', () => {
    const n = pickNudge({
      user: user({ currentStreak: 5, rewardPoints: 9999 }),
      sessions: [session('2026-09-05')], rewards: [reward(300)], today: '2026-09-08',
    });
    expect(n?.id).toBe('streak-last-day');
    expect(n?.tone).toBe('urgent');
  });

  it('끊기기 하루 전에도 알린다', () => {
    expect(pickNudge({
      user: user({ currentStreak: 4 }), sessions: [session('2026-09-06')],
      rewards: [], today: '2026-09-08',
    })?.id).toBe('streak-warn');
  });

  it('오래 쉬면 며칠째인지 알려준다', () => {
    const n = pickNudge({
      user: user(), sessions: [session('2026-09-01')], rewards: [], today: '2026-09-08',
    });
    expect(n?.id).toBe('idle');
    expect(n?.text).toContain('7일째');
  });

  it('바꿀 수 있는 보상이 있으면 알려준다', () => {
    const n = pickNudge({
      user: user({ rewardPoints: 350 }), sessions: [session('2026-09-07')],
      rewards: [reward(300)], today: '2026-09-08',
    });
    expect(n?.id).toContain('reward');
    expect(n?.text).toContain('300P');
  });

  it('포인트가 모자라면 보상 알림을 띄우지 않는다', () => {
    const n = pickNudge({
      user: user({ rewardPoints: 100 }), sessions: [session('2026-09-07')],
      rewards: [reward(300)], today: '2026-09-08',
    });
    // 알림이 아예 없을 수도 있으므로 빈 문자열로 받아 비교합니다
    expect(n?.id ?? '').not.toContain('reward');
  });

  it('레벨업이 가까우면 알려준다', () => {
    const n = pickNudge({
      user: user({ xp: 400 }), sessions: [session('2026-09-07')], rewards: [], today: '2026-09-08',
    });
    expect(n?.id).toBe('levelup-near');
    expect(n?.text).toContain('Lv.2');
  });

  it('오늘 이미 운동했으면 칭찬한다', () => {
    const n = pickNudge({
      user: user({ xp: 5000 }), sessions: [session('2026-09-08')], rewards: [], today: '2026-09-08',
    });
    expect(n?.id).toBe('done-today');
  });

  it('한 번에 하나만 고른다', () => {
    const n = pickNudge({
      user: user({ currentStreak: 5, rewardPoints: 9999, xp: 400 }),
      sessions: [session('2026-09-05')], rewards: [reward(300)], today: '2026-09-08',
    });
    expect(n).not.toBeNull();
    expect(typeof n!.id).toBe('string');
  });
});
