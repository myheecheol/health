import type { Stats } from '../domain/stats';

/**
 * 업적 정의 (요구사항 17절).
 * 새 업적을 추가하려면 이 배열에 한 줄 넣기만 하면 됩니다.
 * id는 해금 기록과 영구히 연결되므로 한번 정하면 바꾸지 않습니다.
 */

export interface AchievementContext {
  stats: Stats;
  currentStreak: number;
  bestStreak: number;
  /** 지금까지 세운 개인 최고 기록 수 */
  personalRecordCount: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** 이 조건이 참이 되는 순간 해금됩니다 */
  check: (c: AchievementContext) => boolean;
  /** 진행률 표시용 (현재값, 목표값) */
  progress?: (c: AchievementContext) => [number, number];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-workout', name: '첫 운동', description: '첫 운동 완료', emoji: '🏅',
    check: (c) => c.stats.common.totalSessions >= 1,
    progress: (c) => [c.stats.common.totalSessions, 1],
  },
  {
    id: 'first-run', name: '첫 러닝', description: '첫 러닝 완료', emoji: '🏃',
    check: (c) => c.stats.running.total >= 1,
    progress: (c) => [c.stats.running.total, 1],
  },
  {
    id: 'workouts-10', name: '10회 운동', description: '총 10회 운동', emoji: '🏅',
    check: (c) => c.stats.common.totalSessions >= 10,
    progress: (c) => [c.stats.common.totalSessions, 10],
  },
  {
    id: 'workouts-30', name: '꾸준함의 왕', description: '총 30회 운동', emoji: '👑',
    check: (c) => c.stats.common.totalSessions >= 30,
    progress: (c) => [c.stats.common.totalSessions, 30],
  },
  {
    id: 'workouts-50', name: '50회 운동', description: '총 50회 운동', emoji: '🏅',
    check: (c) => c.stats.common.totalSessions >= 50,
    progress: (c) => [c.stats.common.totalSessions, 50],
  },
  {
    id: 'workouts-100', name: '100회 운동', description: '총 100회 운동', emoji: '🏆',
    check: (c) => c.stats.common.totalSessions >= 100,
    progress: (c) => [c.stats.common.totalSessions, 100],
  },
  {
    id: 'first-pr', name: '첫 PR', description: '개인 최고 기록 달성', emoji: '🔥',
    check: (c) => c.personalRecordCount >= 1,
    progress: (c) => [c.personalRecordCount, 1],
  },
  {
    id: 'streak-7', name: '연속 7회', description: '7회 연속 운동', emoji: '🔥',
    check: (c) => c.bestStreak >= 7,
    progress: (c) => [c.bestStreak, 7],
  },
  {
    id: 'streak-10', name: '연속 10회', description: '10회 연속 운동', emoji: '🔥',
    check: (c) => c.bestStreak >= 10,
    progress: (c) => [c.bestStreak, 10],
  },
  {
    id: 'run-5km', name: '첫 5km', description: '누적 러닝 거리 5km', emoji: '🏃',
    check: (c) => c.stats.running.totalDistanceKm >= 5,
    progress: (c) => [c.stats.running.totalDistanceKm, 5],
  },
  {
    id: 'run-10km', name: '10km 러너', description: '누적 러닝 거리 10km', emoji: '🥉',
    check: (c) => c.stats.running.totalDistanceKm >= 10,
    progress: (c) => [c.stats.running.totalDistanceKm, 10],
  },
  {
    id: 'run-50km', name: '50km 러너', description: '누적 러닝 거리 50km', emoji: '🥈',
    check: (c) => c.stats.running.totalDistanceKm >= 50,
    progress: (c) => [c.stats.running.totalDistanceKm, 50],
  },
  {
    id: 'run-100km', name: '100km 러너', description: '누적 러닝 거리 100km', emoji: '🥇',
    check: (c) => c.stats.running.totalDistanceKm >= 100,
    progress: (c) => [c.stats.running.totalDistanceKm, 100],
  },
  {
    id: 'run-500km', name: '500km 러너', description: '누적 러닝 거리 500km', emoji: '🏆',
    check: (c) => c.stats.running.totalDistanceKm >= 500,
    progress: (c) => [c.stats.running.totalDistanceKm, 500],
  },
];
