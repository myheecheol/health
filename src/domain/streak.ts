import { STREAK_MAX_GAP_DAYS, STREAK_MILESTONES } from '../config/gameConfig';
import { daysBetween } from '../data/ids';
import type { WorkoutSession } from '../data/types';

/**
 * 연속 운동(Streak) 계산 (요구사항 16절).
 *
 * 요구사항은 "달력상의 연속 날짜"가 아니라 "운동 세션 연속 횟수"를 쓰라고 했습니다.
 * 다만 그것만으로는 스트릭이 영원히 끊기지 않으므로, 공백일 상한을 함께 둡니다.
 * 마지막 운동일로부터 STREAK_MAX_GAP_DAYS 를 넘겨 쉬면 1부터 다시 셉니다.
 *
 * 근력과 러닝을 가리지 않고 모두 한 번의 운동으로 인정합니다.
 */
export function computeStreak(sessions: WorkoutSession[]): { current: number; best: number } {
  const done = sessions
    .filter((s) => s.completed && s.deletedAt === null)
    .sort((a, b) => a.startTime - b.startTime);

  if (done.length === 0) return { current: 0, best: 0 };

  let current = 0;
  let best = 0;
  let lastDate: string | null = null;

  for (const s of done) {
    if (lastDate === null || daysBetween(lastDate, s.date) <= STREAK_MAX_GAP_DAYS) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > best) best = current;
    lastDate = s.date;
  }

  return { current, best };
}

/** 홈 화면 "다음 목표" 표시용 */
export function nextStreakMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m > current) ?? null;
}

/** 오늘 운동하면 스트릭이 끊기는지 (경고 표시용) */
export function daysUntilStreakBreaks(lastDate: string | null, today: string): number | null {
  if (!lastDate) return null;
  const gap = daysBetween(lastDate, today);
  return Math.max(0, STREAK_MAX_GAP_DAYS - gap);
}
