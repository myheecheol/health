import { useEffect, useRef, useState } from 'react';
import { REST_PRESETS } from '../config/gameConfig';
import { getRoutine } from '../config/routines';
import { downloadBackup, restoreBackup } from '../data/backup';
import { isFirebaseConfigured } from '../data/firebaseConfig';
import { usageBytes } from '../data/localStore';
import { forceSync, snapshot, subscribeSync, type SyncSnapshot } from '../data/syncEngine';
import { getNextStrengthRoutine, otherRoutine } from '../domain/progression';
import { setNextRoutineOverride, updateSettings, visibleSessions } from '../state/store';
import { useAppState } from '../state/useStore';
import { requestNotificationPermission } from '../components/notify';
import { TopBar } from '../components/TopBar';

export function SettingsScreen() {
  const state = useAppState();
  const [sync, setSync] = useState<SyncSnapshot>(snapshot);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeSync(setSync), []);

  const next = getNextStrengthRoutine(state.sessions, state.user.nextRoutineOverride);
  const sessionCount = visibleSessions().length;
  const kb = Math.round(usageBytes() / 1024);

  async function handleRestore(file: File) {
    const text = await file.text();
    const result = restoreBackup(text);
    setMessage(result.ok ? `복원 완료 — 총 ${result.sessions}건의 기록` : result.error);
  }

  return (
    <>
      <TopBar title="설정" />
      <div className="page">
        {message && <div className="banner banner--info">{message}</div>}

        {/* 데이터 안전 — 가장 위에 둡니다 */}
        <div className="card">
          <div className="card__label">데이터 보관</div>

          <div className="row">
            <span className="muted">이 기기 저장</span>
            <span className="badge badge--ok">✅ {sessionCount}건 · {kb}KB</span>
          </div>

          <div className="row">
            <span className="muted">클라우드 동기화</span>
            {!isFirebaseConfigured ? (
              <span className="badge badge--warn">미설정</span>
            ) : sync.state === 'error' ? (
              <span className="badge badge--danger">{sync.pending}건 대기</span>
            ) : sync.pending > 0 ? (
              <span className="badge badge--warn">{sync.pending}건 대기</span>
            ) : (
              <span className="badge badge--ok">최신</span>
            )}
          </div>

          {sync.lastSyncedAt && (
            <div className="row">
              <span className="muted">마지막 동기화</span>
              <span style={{ fontSize: 13 }}>{new Date(sync.lastSyncedAt).toLocaleString('ko-KR')}</span>
            </div>
          )}

          {!isFirebaseConfigured && (
            <div className="banner banner--warn" style={{ marginTop: 12, marginBottom: 0 }}>
              Firebase가 설정되지 않아 기록이 이 기기에만 있습니다.
              브라우저 데이터를 지우면 사라지니, 아래에서 백업 파일을 주기적으로 내려받아 두세요.
            </div>
          )}

          {sync.state === 'error' && (
            <div className="banner banner--danger" style={{ marginTop: 12, marginBottom: 0 }}>
              동기화 실패: {sync.lastError}
              <br />기록은 이 기기에 안전하게 남아 있고, 연결이 회복되면 자동으로 다시 올립니다.
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn--ghost btn--sm" onClick={() => void forceSync()} disabled={!isFirebaseConfigured}>
              지금 동기화
            </button>
            <button className="btn btn--ghost btn--sm" onClick={downloadBackup}>
              백업 내려받기
            </button>
          </div>

          <button
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => fileRef.current?.click()}
          >
            백업 파일에서 복원
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleRestore(file);
              e.target.value = '';
            }}
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            복원은 기존 기록을 지우지 않고 합칩니다.
          </div>
        </div>

        {/* 휴식 타이머 */}
        <div className="card">
          <div className="card__label">휴식 타이머</div>
          <div className="chip-row">
            {REST_PRESETS.map((sec) => (
              <button
                key={sec}
                className="chip"
                aria-pressed={state.user.settings.restSeconds === sec}
                onClick={() => updateSettings({ restSeconds: sec })}
              >
                {sec}초
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <span className="field__label">직접 입력 (초)</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={5}
              max={600}
              value={state.user.settings.restSeconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 5 && n <= 600) updateSettings({ restSeconds: n });
              }}
            />
          </div>
        </div>

        {/* 알림 */}
        <div className="card">
          <div className="card__label">알림</div>
          <div className="row">
            <span>휴식 종료 소리</span>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => updateSettings({ soundEnabled: !state.user.settings.soundEnabled })}
            >
              {state.user.settings.soundEnabled ? '켜짐' : '꺼짐'}
            </button>
          </div>
          <div className="row">
            <span>브라우저 알림</span>
            <button
              className="btn btn--sm btn--ghost"
              onClick={async () => {
                if (state.user.settings.browserNotification) {
                  updateSettings({ browserNotification: false });
                  return;
                }
                const granted = await requestNotificationPermission();
                updateSettings({ browserNotification: granted });
                if (!granted) setMessage('브라우저가 알림을 허용하지 않았습니다. 앱 내부 알림은 계속 동작합니다.');
              }}
            >
              {state.user.settings.browserNotification ? '켜짐' : '꺼짐'}
            </button>
          </div>
        </div>

        {/* A/B 순서 */}
        <div className="card">
          <div className="card__label">다음 근력 운동</div>
          <div className="row">
            <span style={{ fontSize: 18, fontWeight: 700 }}>{getRoutine(next).name}</span>
            <button className="btn btn--sm btn--ghost" onClick={() => setNextRoutineOverride(otherRoutine(next))}>
              {getRoutine(otherRoutine(next)).name}로 변경
            </button>
          </div>
          {state.user.nextRoutineOverride && (
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              직접 지정한 상태입니다. 이 루틴을 완료하면 자동 순서로 돌아갑니다.{' '}
              <button
                className="topbar__back"
                style={{ display: 'inline', padding: 0, textDecoration: 'underline' }}
                onClick={() => setNextRoutineOverride(null)}
              >
                지금 해제
              </button>
            </div>
          )}
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            러닝은 A/B 순서에 영향을 주지 않습니다.
          </div>
        </div>

        <div className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '16px 0' }}>
          Fitness RPG · 1단계 MVP
        </div>
      </div>
    </>
  );
}
