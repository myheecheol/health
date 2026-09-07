/**
 * 게임화 수치는 전부 여기에 모읍니다.
 * 밸런스를 바꾸고 싶으면 이 파일만 고치면 되고, 다른 코드는 건드릴 필요가 없습니다.
 */

/** XP 지급 규칙 (요구사항 10절) */
export const XP_RULES = {
  /** 세트 하나 완료 */
  SET_COMPLETE: 5,
  /** 해당 세트에서 목표 반복수 이상 달성 */
  TARGET_REPS_HIT: 5,
  /** 종목 하나(모든 세트) 완료 */
  EXERCISE_COMPLETE: 10,
  /** A 또는 B 루틴 전체 완료 */
  ROUTINE_COMPLETE: 50,
  /** 개인 최고 기록 갱신 */
  PERSONAL_RECORD: 30,
  /** 러닝 1km당 */
  RUNNING_PER_KM: 20,
  /** 러닝 1회 XP 상한 (null = 무제한) */
  RUNNING_SESSION_MAX: 300 as number | null,
  /** 7회 연속 운동 보너스 */
  STREAK_7: 100,
  /** 누적 30회 운동 보너스 */
  TOTAL_30: 300,
  /** 하루 XP 상한 (null = 무제한). 구조만 준비 */
  DAILY_MAX: null as number | null,
} as const;

/**
 * 보상 포인트 = 획득 XP × POINT_RATE (반올림).
 * 요구사항 24절 예시(136XP → 68P, 185XP → 95P)에서 역산한 값입니다.
 */
export const POINT_RATE = 0.5;

/**
 * 레벨 곡선.
 * MVP는 500XP 균등 구간이고, 나중에 구간별로 다르게 하려면
 * { kind: 'table', thresholds: [...] } 로 바꾸면 됩니다.
 */
export type LevelCurve =
  | { kind: 'flat'; xpPerLevel: number }
  | { kind: 'table'; thresholds: number[] };

export const LEVEL_CURVE: LevelCurve = { kind: 'flat', xpPerLevel: 500 };

/**
 * 연속 운동(Streak) 규칙.
 * 요구사항 16절은 "달력 날짜"가 아니라 "운동 세션 연속 횟수"를 쓰라고 했지만,
 * 그것만으로는 스트릭이 영원히 끊기지 않으므로 공백일 상한을 둡니다.
 * 마지막 운동일로부터 이 일수를 넘기면 1부터 다시 시작합니다.
 */
export const STREAK_MAX_GAP_DAYS = 3;

/** 스트릭 다음 목표 지점 (홈 화면 "다음 목표" 표시용) */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** 휴식 타이머 */
export const DEFAULT_REST_SECONDS = 60;
export const REST_PRESETS = [30, 45, 60, 90, 120, 180];

/** 러닝 거리 입력 제한 (요구사항 40절) */
export const RUNNING_LIMITS = {
  /** 이 값 미만은 저장 거부 */
  minKm: 0.1,
  /** 이 값 초과는 저장 거부 (오타 방어) */
  maxKm: 500,
  /** 이 값을 넘으면 "정말 맞나요?" 확인을 한 번 받음 */
  confirmAboveKm: 100,
  /** 소수점 자리수 */
  decimals: 2,
} as const;

/** 웨이트 입력 제한 */
export const WEIGHT_LIMITS = { minKg: 0, maxKg: 500 } as const;
export const REPS_LIMITS = { min: 1, max: 999 } as const;

/** 운동 완료 시 보여줄 동기부여 문구 (요구사항 36절) */
export const MOTIVATION = {
  STRENGTH: [
    '오늘도 미래의 나를 만들었습니다.',
    '어제보다 강해졌습니다.',
    '한 번의 운동이 레벨 하나를 만듭니다.',
    '꾸준함이 가장 강한 스탯입니다.',
  ],
  RUNNING: [
    '한 걸음씩 더 멀리.',
    '오늘도 목표보다 한 발짝 가까워졌습니다.',
    '달린 거리는 사라지지 않습니다.',
    '오늘의 거리가 내일의 나를 만듭니다.',
  ],
  COMMON: ['오늘 운동을 완료한 당신은 이미 성공했습니다.'],
} as const;
