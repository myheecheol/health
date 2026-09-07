/** 운동 타입. 러닝은 A/B progression과 완전히 독립적입니다. */
export type StrengthType = 'STRENGTH_A' | 'STRENGTH_B';
export type WorkoutType = StrengthType | 'RUNNING';

export type MuscleGroup = 'BACK' | 'CHEST' | 'ARM' | 'SHOULDER' | 'LEG' | 'ABS' | 'CARDIO';

export interface WorkoutRoutine {
  id: string;
  name: string;
  type: StrengthType;
  order: number;
  summary: string;
}

export interface Exercise {
  id: string;
  routineId: string;
  routineType: StrengthType;
  name: string;
  muscleGroup: MuscleGroup;
  targetReps: number;
  defaultSets: number;
  order: number;
  weightIncrement: number;
}

/** 운동 시작 전 컨디션 (요구사항 26절, 전부 선택 입력) */
export interface Condition {
  mood: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  bodyWeightKg?: number;
}

export interface SetRecord {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  /** kg. 0 허용(맨몸 운동) */
  weight: number;
  /** 1 이상 */
  reps: number;
  completed: boolean;
  createdAt: number;
}

export interface RunningRecord {
  id: string;
  sessionId: string;
  /** km. 반드시 number. 0.1 이상. 절대 문자열로 저장하지 않습니다. */
  distanceKm: number;
  /** 초 */
  duration: number;
  completed: boolean;
  createdAt: number;
  /** 확장 예약 필드. 페이스는 저장하지 않습니다. */
  calories?: number;
  averageHeartRate?: number;
}

interface SessionBase {
  id: string;
  /** 'YYYY-MM-DD' (로컬 기준). 캘린더/일자 집계용 */
  date: string;
  startTime: number;
  endTime: number | null;
  /** 초 */
  duration: number;
  notes: string;
  condition: Condition | null;
  completed: boolean;
  xpEarned: number;
  pointsEarned: number;
  /** 소프트 삭제. 실제로 지우지 않습니다 (데이터 손실 방지) */
  deletedAt: number | null;
  updatedAt: number;
}

/**
 * 판별 유니온.
 * 러닝 세션에서 sets를 읽거나 웨이트 세션에서 run을 읽으면 컴파일이 실패합니다.
 * 웨이트/러닝 데이터가 섞이지 않는다는 1차 방어선입니다.
 */
export type WorkoutSession =
  | (SessionBase & { workoutType: StrengthType; sets: SetRecord[] })
  | (SessionBase & { workoutType: 'RUNNING'; run: RunningRecord });

export type StrengthSession = Extract<WorkoutSession, { workoutType: StrengthType }>;
export type RunningSession = Extract<WorkoutSession, { workoutType: 'RUNNING' }>;

export function isStrengthSession(s: WorkoutSession): s is StrengthSession {
  return s.workoutType !== 'RUNNING';
}
export function isRunningSession(s: WorkoutSession): s is RunningSession {
  return s.workoutType === 'RUNNING';
}

/** 종목별 파생 캐시. "지난 기록 흐릿하게 보여주기"와 PR 판정에 씁니다. */
export interface ExerciseStats {
  exerciseId: string;
  lastSets: { weight: number; reps: number }[];
  lastSessionId: string;
  lastDate: string;
  maxWeight: number;
  maxReps: number;
  /** 단일 세트 최대 볼륨 */
  maxSetVolume: number;
  /** 한 세션 내 해당 종목 총 볼륨 최대치 */
  maxSessionVolume: number;
  updatedAt: number;
}

export interface UserSettings {
  restSeconds: number;
  soundEnabled: boolean;
  browserNotification: boolean;
}

export interface User {
  id: string;
  name: string;
  level: number;
  xp: number;
  rewardPoints: number;
  currentStreak: number;
  bestStreak: number;
  /** 다음 근력 루틴 수동 지정 (요구사항 34절). 해당 세션 완료 시 자동 해제 */
  nextRoutineOverride: StrengthType | null;
  settings: UserSettings;
  createdAt: number;
  updatedAt: number;
}

/** 진행 중인 세션. 매 세트마다 저장되어 새로고침/앱 종료를 견딥니다. */
export type ActiveSession = WorkoutSession & { completed: false };

/** 동기화 대기열 항목 */
export interface OutboxItem {
  id: string;
  collection: 'sessions' | 'user' | 'exerciseStats' | 'active';
  docId: string;
  /** 저장할 문서 전체 (last-write-wins) */
  payload: unknown;
  op: 'set' | 'delete';
  queuedAt: number;
  attempts: number;
  lastError: string | null;
}

export type SyncState = 'disabled' | 'idle' | 'syncing' | 'pending' | 'error';

export interface AppState {
  user: User;
  sessions: WorkoutSession[];
  exerciseStats: Record<string, ExerciseStats>;
  active: ActiveSession | null;
  /** 휴식 타이머 종료 시각(epoch ms). null이면 휴식 중 아님 */
  restEndsAt: number | null;
  schemaVersion: number;
}
