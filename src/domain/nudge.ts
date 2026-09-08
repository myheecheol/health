import { STREAK_MAX_GAP_DAYS } from '../config/gameConfig';
import { daysBetween, toDateKey } from '../data/ids';
import type { Reward, User, WorkoutSession } from '../data/types';
import { getLevelProgress } from './level';

/**
 * 홈 화면에 띄울 한 줄 알림 (요구사항 27절).
 *
 * 여러 개를 한꺼번에 띄우지 않고 가장 급한 것 하나만 고릅니다.
 * 매번 잔소리하면 앱을 열기 싫어집니다.
 */
export type NudgeTone = 'urgent' | 'warn' | 'good' | 'info';

export interface Nudge {
  id: string;
  tone: NudgeTone;
  icon: string;
  text: string;
  /** 누르면 이동할 곳 */
  to?: string;
}

export interface NudgeInput {
  user: User;
  sessions: WorkoutSession[];
  rewards: Reward[];
  today?: string;
}

export function pickNudge({ user, sessions, rewards, today = toDateKey() }: NudgeInput): Nudge | null {
  const done = sessions
    .filter((s) => s.completed && s.deletedAt === null)
    .sort((a, b) => a.startTime - b.startTime);

  // 첫 사용자
  if (done.length === 0) {
    return { id: 'first', tone: 'info', icon: '🏋️', text: '첫 운동을 기록해보세요. 여기서 시작합니다.' };
  }

  const lastDate = done[done.length - 1]!.date;
  const gap = daysBetween(lastDate, today);

  // 1순위 — 스트릭이 오늘내일 끊길 때
  if (user.currentStreak >= 2 && gap === STREAK_MAX_GAP_DAYS) {
    return {
      id: 'streak-last-day', tone: 'urgent', icon: '🔥',
      text: `오늘 운동하지 않으면 연속 ${user.currentStreak}회가 끊깁니다`,
      to: '/workout',
    };
  }
  if (user.currentStreak >= 2 && gap === STREAK_MAX_GAP_DAYS - 1) {
    return {
      id: 'streak-warn', tone: 'warn', icon: '🔥',
      text: `연속 ${user.currentStreak}회 유지까지 하루 남았습니다`,
      to: '/workout',
    };
  }

  // 2순위 — 오래 쉰 경우
  if (gap > STREAK_MAX_GAP_DAYS) {
    return {
      id: 'idle', tone: 'warn', icon: '💤',
      text: `${gap}일째 운동 기록이 없습니다. 가볍게 러닝은 어때요?`,
      to: '/workout/running',
    };
  }

  // 3순위 — 지금 바꿀 수 있는 보상이 생겼을 때
  const affordable = rewards
    .filter((r) => r.active && r.cost <= user.rewardPoints)
    .sort((a, b) => b.cost - a.cost)[0];
  if (affordable) {
    return {
      id: `reward-${affordable.id}`, tone: 'good', icon: affordable.emoji,
      text: `${affordable.name} 교환할 수 있습니다 (${affordable.cost}P)`,
      to: '/rewards',
    };
  }

  // 4순위 — 레벨업이 코앞일 때
  const progress = getLevelProgress(user.xp);
  if (progress.remaining > 0 && progress.remaining <= 400) {
    return {
      id: 'levelup-near', tone: 'info', icon: '⚡',
      text: `${progress.remaining} XP만 더 모으면 Lv.${progress.level + 1}`,
      to: '/workout',
    };
  }

  // 5순위 — 오늘 이미 운동했으면 칭찬하고 끝
  if (gap === 0) {
    return { id: 'done-today', tone: 'good', icon: '✅', text: '오늘 운동을 마쳤습니다. 잘하고 있어요.' };
  }

  return null;
}
