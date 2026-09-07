import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

/**
 * 이 모듈은 동적 import로만 불러옵니다 (syncEngine 참고).
 * Firebase를 쓰지 않는 사용자는 SDK를 내려받지 않습니다.
 */

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let uidPromise: Promise<string> | null = null;

function init() {
  if (app || !isFirebaseConfigured) return;
  app = initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
  // IndexedDB 캐시: 전송 중이던 쓰기가 새로고침을 견디게 합니다.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  });
  auth = getAuth(app);
}

export function getDb(): Firestore | null {
  init();
  return db;
}

/**
 * 익명 로그인으로 uid를 확보합니다.
 * 보안 규칙을 uid 단위로 잠글 수 있고, 나중에 구글 계정 연결로 승격할 수 있습니다.
 */
export function getUid(): Promise<string> {
  init();
  if (!auth) return Promise.reject(new Error('firebase not configured'));
  if (uidPromise) return uidPromise;

  const a = auth;
  const pending = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('auth timeout'));
    }, 20_000);
    const unsub = onAuthStateChanged(
      a,
      (user) => {
        if (user) {
          clearTimeout(timeout);
          unsub();
          resolve(user.uid);
        }
      },
      (err) => {
        clearTimeout(timeout);
        unsub();
        reject(err);
      },
    );
    signInAnonymously(a).catch((err) => {
      clearTimeout(timeout);
      unsub();
      reject(err);
    });
  });

  // 실패한 약속을 캐시해두면 영영 재시도하지 못하므로 지웁니다.
  pending.catch(() => {
    if (uidPromise === pending) uidPromise = null;
  });
  uidPromise = pending;
  return pending;
}
