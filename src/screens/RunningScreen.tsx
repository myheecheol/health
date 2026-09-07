import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RUNNING_LIMITS } from '../config/gameConfig';
import { isRunningSession, type Condition } from '../data/types';
import { validateDistanceKm } from '../data/validate';
import { formatClock, formatKm } from '../domain/volume';
import { discardActiveSession, finishRunningSession, startRunningSession, visibleSessions } from '../state/store';
import { useAppState } from '../state/useStore';
import { ConditionPicker } from '../components/ConditionPicker';
import { TopBar } from '../components/TopBar';
import { useNow } from '../components/useNow';

export function RunningScreen() {
  const state = useAppState();
  const active = state.active && isRunningSession(state.active) ? state.active : null;
  return active ? <RunningActive /> : <RunningStart />;
}

/** 최근 러닝 기록 — 시작 화면과 진행 화면 양쪽에서 참고용으로 보여줍니다. */
function useRecentRuns(limit = 3) {
  const runs = visibleSessions()
    .filter(isRunningSession)
    .sort((a, b) => b.startTime - a.startTime);
  return {
    recent: runs.slice(0, limit),
    totalKm: runs.reduce((sum, r) => sum + r.run.distanceKm, 0),
    count: runs.length,
  };
}

function RunningStart() {
  const state = useAppState();
  const nav = useNavigate();
  const [condition, setCondition] = useState<Condition | null>(null);
  const { recent, totalKm, count } = useRecentRuns();

  function start() {
    // 근력 세션이 진행 중이면 먼저 정리하고 러닝을 시작합니다.
    if (state.active) discardActiveSession();
    startRunningSession(condition);
  }

  return (
    <>
      <TopBar title="러닝" back="/workout" />
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🏃</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>RUNNING</div>
          <div className="muted">오늘 러닝</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            거리는 미리 정하지 않습니다. 달린 뒤에 실제 거리를 입력하세요.
          </div>
        </div>

        <ConditionPicker value={condition} onChange={setCondition} />

        {count > 0 && (
          <div className="card">
            <div className="card__label">최근 러닝</div>
            <div className="chip-row">
              {recent.map((r) => (
                <span key={r.id} className="chip">{formatKm(r.run.distanceKm)}</span>
              ))}
            </div>
            <div className="divider" />
            <div className="row">
              <span className="muted">누적 거리</span>
              <span style={{ fontWeight: 700 }}>{totalKm.toFixed(1)}km</span>
            </div>
            <div className="row">
              <span className="muted">총 러닝</span>
              <span style={{ fontWeight: 700 }}>{count}회</span>
            </div>
          </div>
        )}

        <button className="btn btn--running btn--lg" onClick={start}>운동 시작</button>
        <button className="btn btn--ghost btn--sm" style={{ width: '100%', marginTop: 10 }} onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    </>
  );
}

function RunningActive() {
  const state = useAppState();
  const nav = useNavigate();
  const now = useNow(1000);
  const { recent } = useRecentRuns();

  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = state.active;
  if (!active || !isRunningSession(active)) return null;

  const elapsed = (now - active.startTime) / 1000;

  function finish() {
    const result = validateDistanceKm(distance);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (
      result.value > RUNNING_LIMITS.confirmAboveKm &&
      !window.confirm(`${result.value}km가 맞나요?\n입력한 거리가 평소보다 많이 깁니다.`)
    ) {
      return;
    }

    setSaving(true);
    const finished = finishRunningSession(result.value, notes);
    if (finished) nav(`/complete/${finished.session.id}`, { replace: true });
    else {
      setSaving(false);
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    }
  }

  function discard() {
    if (!window.confirm('이번 러닝을 저장하지 않고 나갈까요?')) return;
    discardActiveSession();
    nav('/', { replace: true });
  }

  return (
    <>
      <TopBar title="러닝" />
      <div className="page page--full">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>🏃</div>
          <div className="timer-label" style={{ marginTop: 8 }}>운동 시간</div>
          <div className="timer-big" style={{ color: 'var(--running)' }}>{formatClock(elapsed)}</div>
        </div>

        <div className="card">
          <div className="card__label">실제 달린 거리</div>
          <input
            className={'input input--running' + (error ? ' input--invalid' : '')}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={RUNNING_LIMITS.minKm}
            value={distance}
            placeholder="0.0"
            onChange={(e) => { setDistance(e.target.value); setError(null); }}
            aria-label="달린 거리 (km)"
          />
          <div className="set-input-unit">km</div>
          {error && <div className="input-error">{error}</div>}

          {recent.length > 0 && (
            <>
              <div className="card__label" style={{ marginTop: 16 }}>최근 러닝 (눌러서 입력)</div>
              <div className="chip-row">
                {recent.map((r) => (
                  <button
                    key={r.id}
                    className="chip"
                    onClick={() => { setDistance(String(r.run.distanceKm)); setError(null); }}
                  >
                    {formatKm(r.run.distanceKm)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="field">
            <span className="field__label">러닝 메모 (선택)</span>
            <input
              className="input input--text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="오늘 러닝 생각보다 힘들었음..."
            />
          </div>
        </div>

        <button className="btn btn--running btn--lg" onClick={finish} disabled={saving}>
          러닝 완료
        </button>
        <button className="btn btn--danger btn--sm" style={{ width: '100%', marginTop: 20 }} onClick={discard}>
          저장하지 않고 나가기
        </button>
      </div>
    </>
  );
}
