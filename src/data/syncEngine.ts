import { isFirebaseConfigured } from './firebaseConfig';
import { read, write } from './localStore';
import { newId } from './ids';
import type { OutboxItem, SyncState } from './types';

/**
 * 아웃박스 큐.
 *
 * 규칙 하나만 지키면 데이터가 사라지지 않습니다:
 *   "서버가 성공을 응답하기 전에는 큐에서 지우지 않는다."
 *
 * 로컬 저장은 이미 끝난 뒤이므로, 동기화가 며칠 밀려도 기록 자체는 안전합니다.
 * 큐는 localStorage에 있으므로 앱을 껐다 켜도 유지됩니다.
 */

const MAX_ATTEMPTS_BEFORE_SLOWDOWN = 5;
const BASE_RETRY_MS = 2_000;
const MAX_RETRY_MS = 60_000;
/** 같은 문서에 대한 중복 쓰기는 마지막 것만 남깁니다 (last-write-wins). */
const DEDUPE = true;

let queue: OutboxItem[] = [];
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let state: SyncState = isFirebaseConfigured ? 'idle' : 'disabled';
let lastSyncedAt: number | null = null;

type Listener = (snapshot: SyncSnapshot) => void;
export interface SyncSnapshot {
  state: SyncState;
  pending: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}
let lastError: string | null = null;
const listeners = new Set<Listener>();

export function subscribeSync(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

export function snapshot(): SyncSnapshot {
  return { state, pending: queue.length, lastSyncedAt, lastError };
}

function emit() {
  const s = snapshot();
  listeners.forEach((fn) => fn(s));
}

function persistQueue() {
  write('outbox', queue);
}

function setState(next: SyncState) {
  if (state === next) return;
  state = next;
  emit();
}

export function initSync() {
  queue = read<OutboxItem[]>('outbox', []);
  if (!isFirebaseConfigured) {
    setState('disabled');
    emit();
    return;
  }
  setState(queue.length ? 'pending' : 'idle');
  emit();

  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  // 이벤트를 놓쳤을 때를 대비한 안전망
  setInterval(() => void flush(), 30_000);
  void flush();
}

/**
 * 클라우드 반영을 예약합니다. 로컬 저장이 끝난 뒤에 호출하세요.
 * 이 함수는 절대 예외를 던지지 않습니다 — 동기화 문제로 운동 흐름이 끊기면 안 됩니다.
 */
export function enqueue(
  collectionName: OutboxItem['collection'],
  docId: string,
  payload: unknown,
  op: OutboxItem['op'] = 'set',
): void {
  if (!isFirebaseConfigured) return;
  try {
    if (DEDUPE) {
      queue = queue.filter((i) => !(i.collection === collectionName && i.docId === docId));
    }
    queue.push({
      id: newId('ob'),
      collection: collectionName,
      docId,
      payload,
      op,
      queuedAt: Date.now(),
      attempts: 0,
      lastError: null,
    });
    persistQueue();
    setState('pending');
    emit();
    void flush();
  } catch (err) {
    console.error('[sync] enqueue 실패', err);
  }
}

export async function flush(): Promise<void> {
  if (!isFirebaseConfigured || flushing || queue.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState('pending');
    return;
  }

  flushing = true;
  setState('syncing');

  try {
    // 큐 앞에서부터 순서대로. 실패하면 그 자리에서 멈춰 순서를 보존합니다.
    while (queue.length > 0) {
      const item = queue[0]!;
      try {
        const { pushItem } = await import('./firestoreRepo');
        await pushItem(item);
        queue.shift();
        persistQueue();
        consecutiveFailures = 0;
        lastError = null;
        lastSyncedAt = Date.now();
        emit();
      } catch (err) {
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String(err);
        lastError = item.lastError;
        consecutiveFailures += 1;
        persistQueue();
        scheduleRetry();
        setState('error');
        return;
      }
    }
    setState('idle');
  } finally {
    flushing = false;
  }
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  const exponent = Math.min(consecutiveFailures, MAX_ATTEMPTS_BEFORE_SLOWDOWN);
  const delay = Math.min(BASE_RETRY_MS * 2 ** exponent, MAX_RETRY_MS);
  retryTimer = setTimeout(() => void flush(), delay);
}

/** 설정 화면의 "지금 동기화" 버튼용 */
export async function forceSync(): Promise<void> {
  consecutiveFailures = 0;
  if (retryTimer) clearTimeout(retryTimer);
  await flush();
}
