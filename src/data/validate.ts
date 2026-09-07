import { REPS_LIMITS, RUNNING_LIMITS, WEIGHT_LIMITS } from '../config/gameConfig';

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * 문자열 입력을 숫자로 바꾸는 유일한 통로입니다.
 * parseFloat은 "5abc"를 5로 조용히 통과시키므로 쓰지 않습니다.
 */
function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * 러닝 거리 검증 (요구사항 40절).
 * 빈값 / 0 / 음수 / 문자 / 과대값을 전부 막고, 통과한 값만 number로 반환합니다.
 * 저장 경로는 이 함수를 반드시 거칩니다.
 */
export function validateDistanceKm(raw: unknown): Validated<number> {
  const n = toNumber(raw);
  if (n === null) {
    const isBlank = raw === '' || raw === null || raw === undefined;
    return { ok: false, error: isBlank ? '달린 거리를 입력해주세요' : '숫자만 입력할 수 있어요' };
  }
  if (n < RUNNING_LIMITS.minKm) {
    return { ok: false, error: `${RUNNING_LIMITS.minKm}km 이상 입력해주세요` };
  }
  if (n > RUNNING_LIMITS.maxKm) {
    return { ok: false, error: `${RUNNING_LIMITS.maxKm}km 이하로 입력해주세요` };
  }
  return { ok: true, value: round(n, RUNNING_LIMITS.decimals) };
}

/** 중량. 0은 허용합니다(맨몸 운동). */
export function validateWeight(raw: unknown): Validated<number> {
  const n = toNumber(raw);
  if (n === null) return { ok: false, error: '중량을 숫자로 입력해주세요' };
  if (n < WEIGHT_LIMITS.minKg) return { ok: false, error: '중량은 0 이상이어야 해요' };
  if (n > WEIGHT_LIMITS.maxKg) return { ok: false, error: `${WEIGHT_LIMITS.maxKg}kg 이하로 입력해주세요` };
  return { ok: true, value: round(n, 2) };
}

/** 반복수. 0은 허용하지 않습니다. */
export function validateReps(raw: unknown): Validated<number> {
  const n = toNumber(raw);
  if (n === null) return { ok: false, error: '반복수를 숫자로 입력해주세요' };
  if (!Number.isInteger(n)) return { ok: false, error: '반복수는 정수로 입력해주세요' };
  if (n < REPS_LIMITS.min) return { ok: false, error: '반복수는 1회 이상이어야 해요' };
  if (n > REPS_LIMITS.max) return { ok: false, error: `${REPS_LIMITS.max}회 이하로 입력해주세요` };
  return { ok: true, value: n };
}

/** 저장 직전 마지막 방어선. 여기서 걸리면 개발 실수이므로 예외를 던집니다. */
export function assertFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field}는 숫자여야 합니다. 받은 값: ${JSON.stringify(value)}`);
  }
  return value;
}
