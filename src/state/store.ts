import { ACHIEVEMENTS } from '../config/achievements';
import { DEFAULT_REST_SECONDS } from '../config/gameConfig';
import { DEFAULT_REWARDS } from '../config/rewards';
import { getExercisesFor } from '../config/routines';
import { newId, toDateKey } from '../data/ids';
import { read, write } from '../data/localStore';
import { enqueue } from '../data/syncEngine';
import { assertFiniteNumber } from '../data/validate';
import type {
  ActiveSession,
  Exercise,
  AppState,
  Condition,
  ExerciseStats,
  Reward,
  RewardHistoryEntry,
  RunningRecord,
  SetRecord,
  StrengthType,
  User,
  UserSettings,
  WorkoutSession,
  XPHistoryEntry,
} from '../data/types';
import { isStrengthSession } from '../data/types';
import { evaluateAchievements } from '../domain/achievements';
import { getLevel } from '../domain/level';
import { applySessionToStats, type PersonalRecord } from '../domain/records';
import { computeStats } from '../domain/stats';
import { computeStreak } from '../domain/streak';
import { computeSessionXp, type XpLine } from '../domain/xp';

const SCHEMA_VERSION = 1;
/** 내용 구조 버전. 지난 기록을 다시 계산해야 할 때 올립니다. */
const CURRENT_DATA_VERSION = 2;

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
    settings: {
      restSeconds: DEFAULT_REST_SECONDS,
      soundEnabled: true,
      browserNotification: false,
      keepScreenOn: true,
    },
    dataVersion: CURRENT_DATA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

/** 처음 실행할 때 기본 보상을 깔아줍니다. */
function seedRewards(): Reward[] {
  return DEFAULT_REWARDS.map((r) => ({ ...r, id: newId('rw') }));
}

function load(): AppState {
  const storedRewards = read<Reward[] | null>('rewards', null);

  const loaded: AppState = {
    user: read<User>('user', createUser()),
    sessions: read<WorkoutSession[]>('sessions', []),
    exerciseStats: read<Record<string, ExerciseStats>>('exerciseStats', {}),
    active: read<ActiveSession | null>('active', null),
    restEndsAt: read<number | null>('restEndsAt', null),
    rewards: storedRewards ?? seedRewards(),
    rewardHistory: read<RewardHistoryEntry[]>('rewardHistory', []),
    achievements: read<Record<string, number>>('achievements', {}),
    xpHistory: read<XPHistoryEntry[]>('xpHistory', []),
    schemaVersion: SCHEMA_VERSION,
  };

  return withDerivedProgress(rebuildExerciseStats(migrate(loaded)));
}

/**
 * 종목별 캐시가 비어 있는데 기록은 있는 경우, 기록에서 다시 만듭니다.
 * 백업 복원이나 다른 기기에서 내려받은 직후에 이런 상태가 됩니다.
 * 캐시가 이미 있으면 건드리지 않습니다.
 */
function rebuildExerciseStats(s: AppState): AppState {
  const hasSessions = s.sessions.some((x) => x.completed && x.deletedAt === null);
  if (!hasSessions || Object.keys(s.exerciseStats).length > 0) return s;

  let stats: Record<string, ExerciseStats> = {};
  for (const session of s.sessions
    .filter((x) => x.completed && x.deletedAt === null)
    .sort((a, b) => a.startTime - b.startTime)) {
    stats = applySessionToStats(stats, session).stats;
  }
  if (Object.keys(stats).length > 0) write('exerciseStats', stats);
  return { ...s, exerciseStats: stats };
}

/**
 * 3단계에서 XP가 도입되기 전에 만든 기록은 xpEarned 가 0입니다.
 * 그대로 두면 "운동 4번 했는데 Lv.1 0XP"가 되므로, 지난 기록에도 규칙을 소급 적용합니다.
 * 저장소 키 버전이 아니라 User.dataVersion 으로 판단하므로 기존 데이터가 사라지지 않습니다.
 */
function migrate(s: AppState): AppState {
  // 나중에 추가된 설정 항목은 기존 사용자에게 없으므로 기본값을 채웁니다.
  // dataVersion 과 무관하게 매번 확인해야 설정이 undefined 로 남지 않습니다.
  const defaults = createUser().settings;
  s = { ...s, user: { ...s.user, settings: { ...defaults, ...s.user.settings } } };

  if ((s.user.dataVersion ?? 1) >= CURRENT_DATA_VERSION) return s;

  const completed = s.sessions
    .filter((x) => x.completed && x.deletedAt === null)
    .sort((a, b) => a.startTime - b.startTime);

  const recomputed = new Map<string, { xp: number; points: number }>();
  const seen: WorkoutSession[] = [];
  let stats: Record<string, ExerciseStats> = {};

  for (const session of completed) {
    const { stats: nextStats, personalRecords } = applySessionToStats(stats, session);
    stats = nextStats;
    seen.push(session);
    const streak = computeStreak(seen);
    const xp = computeSessionXp(session, {
      currentStreak: streak.current,
      totalSessions: seen.length,
      personalRecords,
    });
    recomputed.set(session.id, { xp: xp.total, points: xp.points });
  }

  const sessions = s.sessions.map((session) => {
    const r = recomputed.get(session.id);
    return r ? { ...session, xpEarned: r.xp, pointsEarned: r.points } : session;
  });

  const migrated: AppState = {
    ...s,
    sessions,
    exerciseStats: Object.keys(s.exerciseStats).length ? s.exerciseStats : stats,
    user: { ...s.user, dataVersion: CURRENT_DATA_VERSION },
  };
  const withProgress = withDerivedProgress(migrated);

  // 계산 결과를 바로 저장해 두 번 계산하지 않게 합니다.
  write('sessions', withProgress.sessions);
  write('user', withProgress.user);
  write('achievements', withProgress.achievements);
  write('exerciseStats', withProgress.exerciseStats);
  write('rewards', withProgress.rewards);
  return withProgress;
}

type Slice =
  | 'user' | 'sessions' | 'exerciseStats' | 'active' | 'restEndsAt'
  | 'rewards' | 'rewardHistory' | 'achievements' | 'xpHistory';

/**
 * XP·레벨·스트릭·포인트·업적을 기록에서 다시 계산해 채웁니다.
 * 앱을 열 때도 한 번 돌기 때문에, 요약값이 기록과 어긋난 채로 남을 수 없습니다.
 *
 * 값을 조금씩 더하는 대신 매번 전체를 다시 구하는 이유는,
 * 한 번이라도 어긋나면 영영 틀어진 채로 남기 때문입니다.
 * 세션이 수백 건이어도 순식간에 끝나므로 정확성을 택했습니다.
 *
 * 포인트만은 '쓴 내역'이 있어야 하므로 (번 것 - 쓴 것)으로 구합니다.
 */
function withDerivedProgress(s: AppState): AppState {
  const done = s.sessions.filter((x) => x.completed && x.deletedAt === null);

  const xp = done.reduce((sum, x) => sum + (x.xpEarned || 0), 0);
  const earnedPoints = done.reduce((sum, x) => sum + (x.pointsEarned || 0), 0);
  const spentPoints = s.rewardHistory.reduce((sum, h) => sum + h.cost, 0);
  const streak = computeStreak(s.sessions);

  const { unlocked } = evaluateAchievements(s.achievements, {
    stats: computeStats(s.sessions),
    currentStreak: streak.current,
    bestStreak: streak.best,
    personalRecordCount: countPersonalRecords(s.exerciseStats),
  });

  return {
    ...s,
    achievements: unlocked,
    user: {
      ...s.user,
      xp,
      level: getLevel(xp),
      rewardPoints: Math.max(0, earnedPoints - spentPoints),
      currentStreak: streak.current,
      bestStreak: Math.max(streak.best, s.user.bestStreak || 0),
      updatedAt: Date.now(),
    },
  };
}

/** 종목별 캐시에 남은 최고 기록 수 — '첫 PR' 업적 판정용 */
function countPersonalRecords(stats: Record<string, ExerciseStats>): number {
  return Object.values(stats).filter((s) => s.maxWeight > 0 || s.maxReps > 0).length;
}

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
      case 'rewards':
        write('rewards', state.rewards);
        state.rewards.forEach((r) => enqueue('rewards', r.id, r));
        break;
      case 'rewardHistory':
        write('rewardHistory', state.rewardHistory);
        break;
      case 'achievements':
        write('achievements', state.achievements);
        enqueue('achievements', 'unlocked', state.achievements);
        break;
      case 'xpHistory':
        write('xpHistory', state.xpHistory);
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
  xpLines: XpLine[];
  /** 이번 운동으로 오른 레벨. 안 올랐으면 null */
  levelUp: { from: number; to: number } | null;
  newAchievements: AchievementSummary[];
  streak: number;
}

/**
 * 완료 화면으로 넘길 업적 정보.
 *
 * 원본 AchievementDef 에는 조건 판정 함수가 들어 있는데,
 * 함수는 브라우저 방문 기록에 실을 수 없어 화면 전환이 통째로 실패합니다.
 * 그래서 보여줄 값만 뽑아 평범한 객체로 넘깁니다.
 */
export interface AchievementSummary {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

/**
 * 세션을 끝내고 보상을 정산하는 공통 절차.
 * 근력과 러닝이 같은 계산을 거치게 해서 규칙이 갈라지지 않도록 합니다.
 */
function finalize(finished: WorkoutSession, extra: Partial<AppState>, slices: Slice[]): FinishResult {
  const now = Date.now();
  const sessions = [...state.sessions, finished];

  const { stats, personalRecords } = applySessionToStats(state.exerciseStats, finished);
  const touched = Object.keys(stats).filter((id) => stats[id] !== state.exerciseStats[id]);

  const streak = computeStreak(sessions);
  const totalSessions = sessions.filter((x) => x.completed && x.deletedAt === null).length;

  const xp = computeSessionXp(finished, {
    currentStreak: streak.current,
    totalSessions,
    personalRecords,
  });

  const scored: WorkoutSession = { ...finished, xpEarned: xp.total, pointsEarned: xp.points };
  const levelBefore = getLevel(state.user.xp);

  const xpHistory: XPHistoryEntry[] = [
    ...state.xpHistory,
    ...xp.lines.map((line) => ({
      id: newId('xp'),
      amount: line.amount,
      reason: line.reason,
      label: line.label,
      workoutSessionId: scored.id,
      createdAt: now,
    })),
  ];

  const beforeAchievements = state.achievements;
  const next = withDerivedProgress({
    ...state,
    ...extra,
    sessions: sessions.map((x) => (x.id === scored.id ? scored : x)),
    exerciseStats: stats,
    xpHistory,
    active: null,
    restEndsAt: null,
  });

  const newAchievements: AchievementSummary[] = ACHIEVEMENTS
    .filter((a) => next.achievements[a.id] && !beforeAchievements[a.id])
    .map(({ id, name, description, emoji }) => ({ id, name, description, emoji }));
  const levelAfter = next.user.level;

  commit(next, [
    'sessions', 'exerciseStats', 'active', 'restEndsAt',
    'user', 'achievements', 'xpHistory', ...slices,
  ]);
  syncSession(scored);
  syncStats(touched);

  return {
    session: scored,
    personalRecords,
    xpLines: xp.lines,
    levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null,
    newAchievements,
    streak: next.user.currentStreak,
  };
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

  // 사용자가 지정했던 다음 루틴은 그 루틴을 실제로 수행했으면 해제합니다.
  const extra =
    state.user.nextRoutineOverride === finished.workoutType
      ? { user: { ...state.user, nextRoutineOverride: null, updatedAt: now } }
      : {};

  return finalize(finished, extra, []);
}

export function finishRunningSession(distanceKm: number, notes: string): FinishResult | null {
  const active = state.active;
  if (!active || isStrengthSession(active)) return null;

  assertFiniteNumber(distanceKm, 'distanceKm');

  const now = Date.now();
  const duration = Math.round((now - active.startTime) / 1000);
  const run: RunningRecord = { ...active.run, distanceKm, duration, completed: true };
  const finished: WorkoutSession = {
    ...active, run, endTime: now, duration, notes, completed: true, updatedAt: now,
  };

  return finalize(finished, {}, []);
}

// ─────────────────────────────────────────────────────────────
// 보상 (요구사항 13~15절)
// ─────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { ok: true; remaining: number }
  | { ok: false; error: string };

/** 보상을 교환합니다. 포인트가 모자라면 아무것도 바꾸지 않습니다. */
export function redeemReward(rewardId: string): PurchaseResult {
  const reward = state.rewards.find((r) => r.id === rewardId);
  if (!reward) return { ok: false, error: '보상을 찾을 수 없습니다' };
  if (reward.cost > state.user.rewardPoints) {
    return { ok: false, error: `${reward.cost - state.user.rewardPoints}P가 더 필요해요` };
  }

  const entry: RewardHistoryEntry = {
    id: newId('rh'),
    rewardId: reward.id,
    rewardName: reward.name,
    rewardEmoji: reward.emoji,
    cost: reward.cost,
    usedAt: Date.now(),
  };

  const next = withDerivedProgress({ ...state, rewardHistory: [...state.rewardHistory, entry] });
  commit(next, ['rewardHistory', 'user']);
  enqueue('rewardHistory', entry.id, entry);

  return { ok: true, remaining: next.user.rewardPoints };
}

export function addReward(reward: Omit<Reward, 'id'>): void {
  commit({ rewards: [...state.rewards, { ...reward, id: newId('rw') }] }, ['rewards']);
}

export function updateReward(id: string, patch: Partial<Omit<Reward, 'id'>>): void {
  commit({ rewards: state.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)) }, ['rewards']);
}

/** 상점에서 지웁니다. 사용 내역은 그대로 남습니다. */
export function removeReward(id: string): void {
  commit({ rewards: state.rewards.filter((r) => r.id !== id) }, ['rewards']);
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

/**
 * 백업 복원 등으로 상태 전체를 교체합니다.
 * 교체 후 진행도(XP/레벨/스트릭/포인트/업적)는 기록에서 다시 계산하므로
 * 백업 파일에 담긴 요약값이 낡았더라도 어긋나지 않습니다.
 */
export function replaceAll(
  next: Pick<AppState, 'user' | 'sessions' | 'exerciseStats'> &
    Partial<Pick<AppState, 'rewards' | 'rewardHistory' | 'achievements'>>,
): void {
  const merged = withDerivedProgress({
    ...state,
    ...next,
    rewards: next.rewards ?? state.rewards,
    rewardHistory: next.rewardHistory ?? state.rewardHistory,
    achievements: next.achievements ?? state.achievements,
    active: null,
    restEndsAt: null,
  });
  commit(merged, [
    'user', 'sessions', 'exerciseStats', 'active', 'restEndsAt',
    'rewards', 'rewardHistory', 'achievements',
  ]);
  merged.sessions.forEach(syncSession);
  syncStats(Object.keys(merged.exerciseStats));
}

/** 화면에서 쓰는 파생 정보 모음 */
export function currentAchievementContext() {
  return {
    stats: computeStats(state.sessions),
    currentStreak: state.user.currentStreak,
    bestStreak: state.user.bestStreak,
    personalRecordCount: countPersonalRecords(state.exerciseStats),
  };
}

// ─────────────────────────────────────────────────────────────
// 선택자
// ─────────────────────────────────────────────────────────────

export function visibleSessions(): WorkoutSession[] {
  return state.sessions.filter((s) => s.deletedAt === null && s.completed);
}

/**
 * 진행 중인 근력 세션의 종목별 진행 상황.
 * 세트 배열만 보고 매번 다시 계산하므로 새로고침해도 그대로 복구됩니다.
 */
export interface StrengthProgress {
  exercises: Exercise[];
  /** 종목 id → 완료한 세트 수 */
  counts: Map<string, number>;
  /** 모든 종목이 정해진 세트를 채웠는지 */
  allDone: boolean;
}

export function strengthProgress(active: ActiveSession | null): StrengthProgress | null {
  if (!active || !isStrengthSession(active)) return null;
  const exercises = getExercisesFor(active.workoutType);
  const counts = new Map<string, number>();
  for (const s of active.sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
  return {
    exercises,
    counts,
    allDone: exercises.every((ex) => (counts.get(ex.id) ?? 0) >= ex.defaultSets),
  };
}

/**
 * 지금 화면에 띄울 종목과 세트 번호.
 *
 * preferredId 를 주면 그 종목을 보여줍니다 — 헬스장에서 기구가 차 있으면
 * 순서를 건너뛰고 다른 종목부터 해야 하기 때문입니다.
 * 주지 않으면 순서상 첫 미완료 종목을 고릅니다.
 *
 * 정해진 세트를 다 채운 종목을 골라도 막지 않습니다. 한 세트 더 할 수 있어야 합니다.
 */
export function currentStrengthPosition(
  active: ActiveSession | null,
  preferredId?: string | null,
) {
  const progress = strengthProgress(active);
  if (!progress) return null;
  const { exercises, counts } = progress;

  const pick = (i: number) => {
    const ex = exercises[i]!;
    const done = counts.get(ex.id) ?? 0;
    return {
      exercise: ex,
      exerciseIndex: i,
      setNumber: done + 1,
      doneSets: done,
      totalExercises: exercises.length,
      counts,
    };
  };

  if (preferredId) {
    const i = exercises.findIndex((ex) => ex.id === preferredId);
    if (i >= 0) return pick(i);
  }

  const firstUnfinished = exercises.findIndex((ex) => (counts.get(ex.id) ?? 0) < ex.defaultSets);
  if (firstUnfinished >= 0) return pick(firstUnfinished);

  return {
    exercise: null,
    exerciseIndex: exercises.length,
    setNumber: 0,
    doneSets: 0,
    totalExercises: exercises.length,
    counts,
  };
}

/**
 * 방금 끝낸 종목 다음으로 넘어갈 종목.
 * 뒤쪽부터 찾고, 없으면 앞쪽으로 한 바퀴 돕니다 —
 * 사용자가 고른 순서를 존중해, 이미 지나친 종목으로 되돌아가 붙잡지 않습니다.
 */
export function nextUnfinishedAfter(active: ActiveSession | null, exerciseId: string): string | null {
  const progress = strengthProgress(active);
  if (!progress) return null;
  const { exercises, counts } = progress;

  const from = exercises.findIndex((ex) => ex.id === exerciseId);
  if (from < 0) return null;

  for (let step = 1; step <= exercises.length; step++) {
    const ex = exercises[(from + step) % exercises.length]!;
    if ((counts.get(ex.id) ?? 0) < ex.defaultSets) return ex.id;
  }
  return null;
}
