import { useEffect, useState } from 'react';
import { snapshot, subscribeSync, type SyncSnapshot } from '../data/syncEngine';

/**
 * 동기화 상태를 항상 보이게 둡니다.
 * 사용자가 "지금 내 기록이 안전한가"를 추측하지 않아도 되게 하는 것이 목적입니다.
 */
export function SyncBadge() {
  const [sync, setSync] = useState<SyncSnapshot>(snapshot);
  useEffect(() => subscribeSync(setSync), []);

  if (sync.state === 'disabled') {
    return <span className="badge" title="Firebase 설정이 없어 이 기기에만 저장됩니다">💾 로컬 저장</span>;
  }
  if (sync.state === 'syncing') return <span className="badge badge--warn">⏳ 저장 중</span>;
  if (sync.state === 'error') {
    return <span className="badge badge--danger" title={sync.lastError ?? ''}>⚠️ {sync.pending}건 대기</span>;
  }
  if (sync.state === 'pending' || sync.pending > 0) {
    return <span className="badge badge--warn">⏳ {sync.pending}건 대기</span>;
  }
  return <span className="badge badge--ok">✅ 저장됨</span>;
}
