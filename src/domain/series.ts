import { getExercise } from '../config/routines';
import { isRunningSession, isStrengthSession, type ExerciseStats, type WorkoutSession } from '../data/types';
import { setsVolume } from './volume';

/**
 * 그래프에 넣을 데이터를 만듭니다.
 * 날짜 묶기와 빈 구간 채우기가 실수 나기 쉬운 부분이라 화면과 분리했습니다.
 * 기록이 없는 주·달도 0으로 채워야 그래프에 구멍이 생기지 않습니다.
 */

const DAY = 86_400_000;

function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 그 날이 속한 주의 월요일 */
function mondayOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  const offset = (d.getDay() + 6) % 7; // 월요일=0
  return new Date(d.getTime() - offset * DAY);
}

export interface WeekPoint {
  key: string;
  label: string;
  strength: number;
  running: number;
  total: number;
}

/** 최근 N주의 주별 운동 횟수. 근력과 러닝을 나눠서 셉니다. */
export function weeklyActivity(sessions: WorkoutSession[], weeks = 12, now = new Date()): WeekPoint[] {
  const done = sessions.filter((s) => s.completed && s.deletedAt === null);
  const thisMonday = mondayOf(dateKey(now));

  const buckets: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday.getTime() - i * 7 * DAY);
    buckets.push({
      key: dateKey(start),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      strength: 0,
      running: 0,
      total: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));

  for (const s of done) {
    const bucket = index.get(dateKey(mondayOf(s.date)));
    if (!bucket) continue; // 기간 밖
    if (isRunningSession(s)) bucket.running += 1;
    else bucket.strength += 1;
    bucket.total += 1;
  }
  return buckets;
}

export interface VolumePoint {
  sessionId: string;
  date: string;
  label: string;
  volume: number;
  routine: 'A' | 'B';
}

/** 최근 근력 세션의 총 볼륨 추이. 러닝은 볼륨 개념이 없어 제외합니다. */
export function volumeTrend(sessions: WorkoutSession[], limit = 12): VolumePoint[] {
  return sessions
    .filter((s) => s.completed && s.deletedAt === null)
    .filter(isStrengthSession)
    .sort((a, b) => a.startTime - b.startTime)
    .slice(-limit)
    .map((s) => ({
      sessionId: s.id,
      date: s.date,
      label: `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8, 10))}`,
      volume: Math.round(setsVolume(s.sets.filter((x) => x.completed))),
      routine: s.workoutType === 'STRENGTH_A' ? ('A' as const) : ('B' as const),
    }));
}

export interface MonthPoint {
  key: string;
  label: string;
  km: number;
  runs: number;
}

/** 최근 N개월의 러닝 거리. 웨이트는 섞이지 않습니다. */
export function monthlyRunning(sessions: WorkoutSession[], months = 6, now = new Date()): MonthPoint[] {
  const runs = sessions
    .filter((s) => s.completed && s.deletedAt === null)
    .filter(isRunningSession);

  const buckets: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${d.getMonth() + 1}월`,
      km: 0,
      runs: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));

  for (const s of runs) {
    const bucket = index.get(s.date.slice(0, 7));
    if (!bucket) continue;
    bucket.km += s.run.distanceKm;
    bucket.runs += 1;
  }
  for (const b of buckets) b.km = Math.round(b.km * 10) / 10;
  return buckets;
}

export interface ExerciseMax {
  exerciseId: string;
  name: string;
  maxWeight: number;
  maxReps: number;
}

/** 종목별 최고 중량. 무거운 순으로 정렬합니다. */
export function maxWeights(stats: Record<string, ExerciseStats>): ExerciseMax[] {
  return Object.values(stats)
    .filter((s) => s.maxWeight > 0)
    .map((s) => ({
      exerciseId: s.exerciseId,
      name: getExercise(s.exerciseId)?.name ?? s.exerciseId,
      maxWeight: s.maxWeight,
      maxReps: s.maxReps,
    }))
    .sort((a, b) => b.maxWeight - a.maxWeight);
}
