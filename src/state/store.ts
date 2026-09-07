import { DEFAULT_REST_SECONDS } from '../config/gameConfig';
import { getExercisesFor } from '../config/routines';
import { newId, toDateKey } from '../data/ids';
import { read, write } from '../data/localStore';
import { enqueue } from '../data/syncEngine';
import { assertFiniteNumber } from '../data/validate';
import type {
  ActiveSession,
  AppState,
  Condition,
  ExerciseStats,
  RunningRecord,
  SetRecord,
  StrengthType,
  User,
  UserSettings,
  WorkoutSession,
} from '../data/types';
import { isStrengthSession } from '../data/types';
import { applySessionToStats, type PersonalRecord } from '../domain/records';

const SCHEMA_VERSION = 1;

function createUser(): User {
  const now = Date.now();
  return {
    id: 'me',
    name: '나',
    level: 1,
    xp: 0,
    rewardPoints: 0,
    currentStreak: 0,
    bestStreak: 0,
    nextRoutineOverride: null,
    settings: { restSeconds: DEFAULT_REST_SECONDS, soundEnabled: true, browserNotification: false },
    createdAt: now,
    updatedAt: now,
  };
}

function load(): AppState {
  return {
    user: read<User>('user', createUser()),
    sessions: read<WorkoutSession[]>('sessions', []),
    exerciseStats: read<Record<string, ExerciseStats>>('exerciseStats', {}),
    active: read<ActiveSession | null>('active', null),
    restEndsAt: read<number | null>('restEndsAt', null),
    schemaVersion: SCHEMA_VERSION,
  };
}

type Slice = 'user' | 'sessions' | 'exerciseStats' | 'active' | 'restEndsAt';

let state: AppState = load();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 상태를 바꾸고, 바뀐 슬라이스를 즉시 로컬에 기록한 뒤, 클라우드 큐에 넣습니다.
 * 저장을 useEffect에 맡기지 않는 이유는 렌더가 밀리거나 언마운트되면
 * 기록이 통째로 사라질 수 있기 때문입니다.
 */
function commit(patch: Partial<AppState>, slices: Slice[]) {
  state = { ...state, ...patch };

  for (const slice of slices) {
    switch (slice) {
      case 'user':
        write('user', state.user);
        enqueue('user', 'me', state.user);
        break;
      case 'sessions':
        write('sessions', state.sessions);
        break;
      case 'exerciseStats':
        write('exerciseStats', state.exerciseStats);
        break;
      case 'active':
        write('active', state.active);
        enqueue('active', 'current', state.active ?? { empty: true });
        break;
      case 'restEndsAt':
        write('restEndsAt', state.restEndsAt);
        break;
    }
  }
  listeners.forEach((fn) => fn());
}

/** 세션 한 건만 클라우드에 올립니다 (전체 배열이 아니라 문서 단위) */
function syncSession(session: WorkoutSession) {
  enqueue('sessions', session.id, session);
}

function syncStats(ids: string[]) {
  for (const id of ids) {
    const s = state.exerciseStats[id];
    if (s) enqueue('exerciseStats', id, s);
  }
}

// ─────────────────────────────────────────────────────────────
// 세션 시작
// ─────────────────────────────────────────────────────────────

export function startStrengthSession(type: StrengthType, condition: Condition | null): ActiveSession {
  const now = Date.now();
  const session: ActiveSession = {
    id: newId('ses'),
    date: toDateKey(now),
    workoutType: type,
    startTime: now,
    endTime: null,
    duration: 0,
    notes: '',
    condition,
    completed: false,
    xpEarned: 0,
    pointsEarned: 0,
    deletedAt: null,
    updatedAt: now,
    sets: [],
  };
  commit({ active: session, restEndsAt: null }, ['active', 'restEndsAt']);
  return session;
}

export function startRunningSession(condition: Condition | null): ActiveSession {
  const now = Date.now();
  const session: ActiveSession = {
    id: newId('ses'),
    date: toDateKey(now),
    workoutType: 'RUNNING',
    startTime: now,
    endTime: null,
    duration: 0,
    notes: '',
    condition,
    completed: false,
    xpEarned: 0,
    pointsEarned: 0,
    deletedAt: null,
    updatedAt: now,
    run: {
      id: newId('run'),
      sessionId: '',
      distanceKm: 0,
      duration: 0,
      completed: false,
      createdAt: now,
    },
  };
  session.run.sessionId = session.id;
  commit({ active: session, restEndsAt: null }, ['active', 'restEndsAt']);
  return session;
}

// ─────────────────────────────────────────────────────────────
// 세트 기록
// ─────────────────────────────────────────────────────────────

/** 세트 하나를 완료 처리합니다. 값은 이미 검증을 통과한 number여야 합니다. */
export function completeSet(exerciseId: string, setNumber: number, weight: number, reps: number): void {
  const active = state.active;
  if (!active || !isStrengthSession(active)) return;

  assertFiniteNumber(weight, 'weight');
  assertFiniteNumber(reps, 'reps');

  const now = Date.now();
  const record: SetRecord = {
    id: newId('set'),
    sessionId: active.id,
    exerciseId,
    setNumber,
    weight,
    reps,
    completed: true,
    createdAt: now,
  };

  const next: ActiveSession = {
    ...active,
    sets: [...active.sets, record],
    duration: Math.round((now - active.startTime) / 1000),
    updatedAt: now,
  };

  const restMs = state.user.settings.restSeconds * 1000;
  commit({ active: next, restEndsAt: now + restMs }, ['active', 'restEndsAt']);
}

/** 마지막 세트 취소 (오입력 복구) */
export function undoLastSet(): void {
  const active = state.active;
  if (!active || !isStrengthSession(active) || active.sets.length === 0) return;
  const next: ActiveSession = {
    ...active,
    sets: active.sets.slice(0, -1),
    updatedAt: Date.now(),
  };
  commit({ active: next, restEndsAt: null }, ['active', 'restEndsAt']);
}

export function skipRest(): void {
  commit({ restEndsAt: null }, ['restEndsAt']);
}

export function addRestSeconds(delta: number): void {
  const base = state.restEndsAt ?? Date.now();
  commit({ restEndsAt: Math.max(Date.now(), base + delta * 1000) }, ['restEndsAt']);
}

// ─────────────────────────────────────────────────────────────
// 세션 종료
// ─────────────────────────────────────────────────────────────

export interface FinishResult {
  session: WorkoutSession;
  personalRecords: PersonalRecord[];
}

export function finishStrengthSession(notes: string): FinishResult | null {
  const active = state.active;
  if (!active || !isStrengthSession(active)) return null;

  const now = Date.now();
  const finished: WorkoutSession = {
    ...active,
    endTime: now,
    duration: Math.round((now - active.startTime) / 1000),
    notes,
    completed: true,
    updatedAt: now,
  };

  const { stats, personalRecords } = applySessionToStats(state.exerciseStats, finished);
  const touched = Object.keys(stats).filter((id) => stats[id] !== state.exerciseStats[id]);

  // 사용자가 지정했던 다음 루틴은 그 루틴을 실제로 수행했으면 해제합니다.
  const user: User =
    state.user.nextRoutineOverride === finished.workoutType
      ? { ...state.user, nextRoutineOverride: null, updatedAt: now }
      : state.user;

  commit(
    { sessions: [...state.sessions, finished], exerciseStats: stats, active: null, restEndsAt: null, user },
    ['sessions', 'exerciseStats', 'active', 'restEndsAt', ...(user !== state.user ? (['user'] as const) : [])],
  );
  syncSession(finished);
  syncStats(touched);

  return { session: finished, personalRecords };
}

export function finishRunningSession(distanceKm: number, notes: string): FinishResult | null {
  const active = state.active;
  if (!active || isStrengthSession(active)) return null;

  assertFiniteNumber(distanceKm, 'distanceKm');

  const now = Date.now();
  const duration = Math.round((now - active.startTime) / 1000);
  const run: RunningRecord = {
    ...active.run,
    distanceKm,
    duration,
    completed: true,
  };
  const finished: WorkoutSession = {
    ...active,
    run,
    endTime: now,
    duration,
    notes,
    completed: true,
    updatedAt: now,
  };

  commit({ sessions: [...state.sessions, finished], active: null, restEndsAt: null }, [
    'sessions',
    'active',
    'restEndsAt',
  ]);
  syncSession(finished);

  return { session: finished, personalRecords: [] };
}

/**
 * 진행 중이던 세션을 버립니다.
 * 실제로 지우지 않고 완료 실패 기록으로 보관해, 나중에도 되살릴 수 있게 합니다.
 */
export function discardActiveSession(): void {
  const active = state.active;
  if (!active) return;
  const now = Date.now();
  const abandoned: WorkoutSession = {
    ...active,
    endTime: now,
    duration: Math.round((now - active.startTime) / 1000),
    completed: false,
    deletedAt: now,
    updatedAt: now,
  };
  commit({ sessions: [...state.sessions, abandoned], active: null, restEndsAt: null }, [
    'sessions',
    'active',
    'restEndsAt',
  ]);
  syncSession(abandoned);
}

// ─────────────────────────────────────────────────────────────
// 사용자 설정
// ─────────────────────────────────────────────────────────────

export function setNextRoutineOverride(type: StrengthType | null): void {
  commit({ user: { ...state.user, nextRoutineOverride: type, updatedAt: Date.now() } }, ['user']);
}

export function updateSettings(patch: Partial<UserSettings>): void {
  commit(
    { user: { ...state.user, settings: { ...state.user.settings, ...patch }, updatedAt: Date.now() } },
    ['user'],
  );
}

/** 백업 복원 등으로 상태 전체를 교체합니다. */
export function replaceAll(next: Pick<AppState, 'user' | 'sessions' | 'exerciseStats'>): void {
  commit({ ...next, active: null, restEndsAt: null }, [
    'user',
    'sessions',
    'exerciseStats',
    'active',
    'restEndsAt',
  ]);
  next.sessions.forEach(syncSession);
  syncStats(Object.keys(next.exerciseStats));
}

// ─────────────────────────────────────────────────────────────
// 선택자
// ─────────────────────────────────────────────────────────────

export function visibleSessions(): WorkoutSession[] {
  return state.sessions.filter((s) => s.deletedAt === null && s.completed);
}

/**
 * 진행 중인 근력 세션에서 지금 해야 할 종목과 세트 번호를 계산합니다.
 * 세트 배열만 보고 매번 다시 계산하므로, 새로고침해도 있던 자리로 정확히 돌아옵니다.
 * skipped에 담긴 종목은 건너뜁니다.
 */
export function currentStrengthPosition(active: ActiveSession | null, skipped: readonly string[] = []) {
  if (!active || !isStrengthSession(active)) return null;
  const exercises = getExercisesFor(active.workoutType);
  const counts = new Map<string, number>();
  for (const s of active.sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]!;
    if (skipped.includes(ex.id)) continue;
    const done = counts.get(ex.id) ?? 0;
    if (done < ex.defaultSets) {
      return { exercise: ex, exerciseIndex: i, setNumber: done + 1, totalExercises: exercises.length, counts };
    }
  }
  return { exercise: null, exerciseIndex: exercises.length, setNumber: 0, totalExercises: exercises.length, counts };
}
