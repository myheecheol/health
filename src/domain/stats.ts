import { isRunningSession, isStrengthSession, type WorkoutSession } from '../data/types';
import { setsVolume } from './volume';

/**
 * 전체 기록을 한 번에 집계합니다.
 *
 * common / strength / running 을 객체 단위로 갈라둔 이유는,
 * 화면에서 실수로 "러닝 거리 + 웨이트 볼륨" 같은 합산을 할 수 없게 하기 위해서입니다.
 */
export interface Stats {
  common: {
    totalSessions: number;
    totalDuration: number;
    firstSessionDate: string | null;
    lastSessionDate: string | null;
  };
  strength: {
    total: number;
    countA: number;
    countB: number;
    totalSets: number;
    totalReps: number;
    totalVolume: number;
  };
  running: {
    total: number;
    totalDistanceKm: number;
    longestRunKm: number;
    monthlyDistanceKm: number;
    yearlyDistanceKm: number;
  };
}

export function computeStats(sessions: WorkoutSession[], now = new Date()): Stats {
  const done = sessions.filter((s) => s.completed && s.deletedAt === null);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearPrefix = String(now.getFullYear());

  const strength = done.filter(isStrengthSession);
  const running = done.filter(isRunningSession);
  const dates = done.map((s) => s.date).sort();

  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  for (const s of strength) {
    const sets = s.sets.filter((x) => x.completed);
    totalSets += sets.length;
    totalReps += sets.reduce((sum, x) => sum + x.reps, 0);
    totalVolume += setsVolume(sets);
  }

  const distances = running.map((s) => s.run.distanceKm);

  return {
    common: {
      totalSessions: done.length,
      totalDuration: done.reduce((sum, s) => sum + s.duration, 0),
      firstSessionDate: dates[0] ?? null,
      lastSessionDate: dates[dates.length - 1] ?? null,
    },
    strength: {
      total: strength.length,
      countA: strength.filter((s) => s.workoutType === 'STRENGTH_A').length,
      countB: strength.filter((s) => s.workoutType === 'STRENGTH_B').length,
      totalSets,
      totalReps,
      totalVolume,
    },
    running: {
      total: running.length,
      totalDistanceKm: round2(distances.reduce((sum, d) => sum + d, 0)),
      longestRunKm: distances.length ? Math.max(...distances) : 0,
      monthlyDistanceKm: round2(
        running.filter((s) => s.date.startsWith(monthPrefix)).reduce((sum, s) => sum + s.run.distanceKm, 0),
      ),
      yearlyDistanceKm: round2(
        running.filter((s) => s.date.startsWith(yearPrefix)).reduce((sum, s) => sum + s.run.distanceKm, 0),
      ),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
