import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getDb, getUid } from './firebase';
import { isFirebaseConfigured } from './firebaseConfig';
import type { OutboxItem } from './types';

/**
 * Firestore 문서 경로.
 *   users/{uid}                              사용자
 *   users/{uid}/sessions/{sessionId}         세션 (세트/러닝 기록 임베드)
 *   users/{uid}/exerciseStats/{exerciseId}   종목별 파생 캐시
 *   users/{uid}/active/current               진행 중인 세션
 */
async function pathFor(item: OutboxItem) {
  const db = getDb();
  if (!db) throw new Error('firestore unavailable');
  const uid = await getUid();

  switch (item.collection) {
    case 'user':
      return doc(db, 'users', uid);
    case 'sessions':
      return doc(db, 'users', uid, 'sessions', item.docId);
    case 'exerciseStats':
      return doc(db, 'users', uid, 'exerciseStats', item.docId);
    case 'active':
      return doc(db, 'users', uid, 'active', 'current');
  }
}

/** 아웃박스 항목 하나를 서버에 반영합니다. resolve = 서버가 확실히 받았음. */
export async function pushItem(item: OutboxItem): Promise<void> {
  const ref = await pathFor(item);
  if (item.op === 'delete') {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, item.payload as Record<string, unknown>);
  }
}

/** 다른 기기/재설치 후 복구용 전체 내려받기 */
export async function pullAll(): Promise<{
  user: unknown | null;
  sessions: unknown[];
  exerciseStats: unknown[];
} | null> {
  if (!isFirebaseConfigured) return null;
  const db = getDb();
  if (!db) return null;
  const uid = await getUid();

  const [sessionsSnap, statsSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'sessions')),
    getDocs(collection(db, 'users', uid, 'exerciseStats')),
  ]);

  const userSnap = await getDoc(doc(db, 'users', uid));

  return {
    user: userSnap.exists() ? userSnap.data() : null,
    sessions: sessionsSnap.docs.map((d) => d.data()),
    exerciseStats: statsSnap.docs.map((d) => d.data()),
  };
}
