/**
 * 로컬 영속 계층.
 *
 * 데이터 손실 방지를 위해 일반적인 localStorage 래퍼보다 방어를 더 겁니다.
 *  1. 쓰기 직전에 직전 값을 :prev 슬롯으로 옮깁니다 → 쓰기 도중 깨져도 한 세대 전으로 복구
 *  2. 쓴 직후 다시 읽어 길이를 대조합니다 → 조용한 실패(사파리 프라이빗 등)를 즉시 감지
 *  3. 용량 초과 시 오래된 세션을 지우지 않고, 호출자에게 실패를 알립니다
 *  4. JSON 파싱 실패 시 :prev 로 자동 폴백
 */

const NS = 'fitrpg';
/**
 * 저장소 키에 들어가는 버전입니다.
 * 이 값을 올리면 기존 기록을 못 찾게 되므로, 내용 구조가 바뀔 때는
 * 이 값 대신 User.dataVersion 을 올리고 store 에서 변환하세요.
 */
export const SCHEMA_VERSION = 1;

export type StoreKey =
  | 'user'
  | 'sessions'
  | 'exerciseStats'
  | 'active'
  | 'restEndsAt'
  | 'rewards'
  | 'rewardHistory'
  | 'achievements'
  | 'xpHistory'
  | 'outbox'
  | 'deviceId';

const k = (name: StoreKey) => `${NS}:v${SCHEMA_VERSION}:${name}`;
const kPrev = (name: StoreKey) => `${NS}:v${SCHEMA_VERSION}:${name}:prev`;

export class StorageUnavailableError extends Error {}
export class StorageFullError extends Error {}

let warnedUnavailable = false;

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = `${NS}:probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.error('[localStore] localStorage를 사용할 수 없습니다. 기록이 저장되지 않습니다.');
    }
    return null;
  }
}

/** 저장 실패를 UI에 알리기 위한 구독 지점 */
type FailureListener = (message: string) => void;
const failureListeners = new Set<FailureListener>();

export function onStorageFailure(fn: FailureListener): () => void {
  failureListeners.add(fn);
  return () => failureListeners.delete(fn);
}

function reportFailure(message: string) {
  console.error('[localStore]', message);
  failureListeners.forEach((fn) => fn(message));
}

export function read<T>(key: StoreKey, fallback: T): T {
  const s = storage();
  if (!s) return fallback;

  for (const slot of [k(key), kPrev(key)]) {
    const raw = s.getItem(slot);
    if (raw === null) continue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      reportFailure(`${slot} 데이터가 손상되어 이전 스냅샷으로 되돌립니다.`);
    }
  }
  return fallback;
}

/**
 * 값을 저장합니다. 성공하면 true.
 * 호출자는 반환값을 확인해 사용자에게 경고를 띄울 수 있습니다.
 */
export function write(key: StoreKey, value: unknown): boolean {
  const s = storage();
  if (!s) return false;

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (err) {
    reportFailure(`${key} 직렬화에 실패했습니다: ${String(err)}`);
    return false;
  }

  const current = s.getItem(k(key));

  try {
    // 1) 직전 값을 백업 슬롯으로 보존
    if (current !== null && current !== serialized) {
      try {
        s.setItem(kPrev(key), current);
      } catch {
        // 백업 실패는 치명적이지 않으므로 본 저장을 계속 진행합니다.
      }
    }
    // 2) 본 저장
    s.setItem(k(key), serialized);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      reportFailure('저장 공간이 가득 찼습니다. 설정에서 백업 파일을 내려받은 뒤 정리해주세요.');
      throw new StorageFullError('localStorage quota exceeded');
    }
    reportFailure(`${key} 저장에 실패했습니다: ${String(err)}`);
    return false;
  }

  // 3) 되읽기 검증 — 조용한 실패를 잡습니다
  if (s.getItem(k(key)) !== serialized) {
    reportFailure(`${key} 저장이 확인되지 않았습니다. 브라우저 저장소 설정을 확인해주세요.`);
    return false;
  }
  return true;
}

export function remove(key: StoreKey): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(k(key));
    s.removeItem(kPrev(key));
  } catch (err) {
    reportFailure(`${key} 삭제에 실패했습니다: ${String(err)}`);
  }
}

/** 기기 식별자. 로그인 도입 전까지 사용자 문서 경로로 씁니다. */
export function getDeviceId(): string {
  const existing = read<string | null>('deviceId', null);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  write('deviceId', id);
  return id;
}

/** 대략적인 사용량(문자 수). 설정 화면 표시용 */
export function usageBytes(): number {
  const s = storage();
  if (!s) return 0;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (key && key.startsWith(NS)) total += key.length + (s.getItem(key)?.length ?? 0);
  }
  return total * 2; // UTF-16
}
