import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExercisesFor } from '../config/routines';
import { isStrengthSession } from '../data/types';
import { validateReps, validateWeight } from '../data/validate';
import { compareWithLast } from '../domain/records';
import { recommendWeight } from '../domain/recommend';
import { formatClock, formatKg, formatMMSS, summarizeStrength } from '../domain/volume';
import {
  addRestSeconds,
  completeSet,
  currentStrengthPosition,
  discardActiveSession,
  finishStrengthSession,
  getState,
  nextUnfinishedAfter,
  skipRest,
  strengthProgress,
  undoLastSet,
} from '../state/store';
import { useAppState } from '../state/useStore';
import { useNow } from '../components/useNow';
import { useWakeLock } from '../components/useWakeLock';
import { beep, browserNotify, vibrate } from '../components/notify';
import { TopBar } from '../components/TopBar';

export function StrengthActiveScreen() {
  const state = useAppState();
  const nav = useNavigate();
  const now = useNow(1000);
  const active = state.active;

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');
  /**
   * 사용자가 직접 고른 종목. null이면 순서상 첫 미완료 종목을 보여줍니다.
   * 헬스장에서 기구가 차 있을 때 순서를 바꿔 할 수 있어야 합니다.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [forceFinish, setForceFinish] = useState(false);

  // 운동 중에는 화면을 켜둡니다 — 꺼지면 휴식 타이머 알림이 제때 오지 않습니다.
  useWakeLock(state.user.settings.keepScreenOn && active !== null);

  const progress = strengthProgress(active);
  const position = currentStrengthPosition(active, selectedId);
  const exercise = position?.exercise ?? null;

  /**
   * 입력칸에 흐릿하게 띄울 값 (요구사항 6절).
   * 1순위: 지난 운동의 같은 번호 세트
   * 2순위: 이번 운동에서 방금 한 세트 (첫 사용자도 2세트부터는 자동으로 채워짐)
   */
  const ghost = useMemo(() => {
    if (!active || !isStrengthSession(active) || !exercise || !position) return null;
    const fromHistory = state.exerciseStats[exercise.id]?.lastSets[position.setNumber - 1];
    if (fromHistory) return fromHistory;
    const thisSession = [...active.sets].reverse().find((s) => s.exerciseId === exercise.id);
    return thisSession ? { weight: thisSession.weight, reps: thisSession.reps } : null;
  }, [active, exercise, position, state.exerciseStats]);

  /**
   * 현재 종목 칩을 띠 안에서 보이는 위치로 끌어옵니다.
   * 자동으로 다음 종목으로 넘어갔을 때 그 칩이 화면 밖에 있으면
   * 지금 어느 종목인지 알 수 없습니다.
   */
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chip = pickerRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!chip) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    chip.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [exercise?.id]);

  // 세트가 넘어갈 때마다 입력칸을 비워 흐릿한 값이 다시 보이게 합니다.
  const suggestion = exercise ? recommendWeight(exercise, state.exerciseStats[exercise.id]) : null;
  const setKey = `${exercise?.id ?? ''}#${position?.setNumber ?? 0}`;
  const prevKey = useRef(setKey);
  useEffect(() => {
    if (prevKey.current !== setKey) {
      prevKey.current = setKey;
      setWeight('');
      setReps('');
      setError(null);
    }
  }, [setKey]);

  // 휴식 종료 알림
  const restRemaining = state.restEndsAt ? (state.restEndsAt - now) / 1000 : 0;
  const restDone = useRef(false);
  useEffect(() => {
    if (state.restEndsAt === null) {
      restDone.current = false;
      return;
    }
    if (restRemaining <= 0 && !restDone.current) {
      restDone.current = true;
      beep(state.user.settings.soundEnabled);
      vibrate();
      if (state.user.settings.browserNotification) {
        browserNotify('🔔 휴식 끝', '다음 세트를 시작하세요!');
      }
    }
  }, [restRemaining, state.restEndsAt, state.user.settings]);

  if (!active || !isStrengthSession(active)) {
    return (
      <>
        <TopBar title="근력 운동" back="/" />
        <div className="page">
          <div className="empty">진행 중인 근력 운동이 없습니다.</div>
          <button className="btn btn--strength" onClick={() => nav('/workout/strength')}>
            운동 시작하기
          </button>
        </div>
      </>
    );
  }

  const exercises = getExercisesFor(active.workoutType);
  const summary = summarizeStrength({ ...active, completed: true });
  const elapsed = (now - active.startTime) / 1000;
  /** 고른 종목이 없고 모든 종목을 채웠을 때만 마무리 화면을 띄웁니다 */
  const showFinish = exercise === null;

  function handleCompleteSet() {
    if (!exercise || !position) return;

    // 비워두면 흐릿하게 보이던 값을 그대로 사용합니다 — 입력 없이 세트를 넘길 수 있게.
    const rawWeight = weight.trim() === '' ? ghost?.weight : weight;
    const rawReps = reps.trim() === '' ? ghost?.reps : reps;

    if (rawWeight === undefined || rawReps === undefined) {
      setError('첫 세트는 중량과 반복수를 입력해주세요');
      return;
    }

    const w = validateWeight(rawWeight);
    if (!w.ok) return setError(w.error);
    const r = validateReps(rawReps);
    if (!r.ok) return setError(r.error);

    setError(null);
    const msg = compareWithLast(state.exerciseStats[exercise.id], position.setNumber, w.value, r.value);
    completeSet(exercise.id, position.setNumber, w.value, r.value);

    // 이 종목의 정해진 세트를 다 채웠으면 다음 미완료 종목으로 넘어갑니다.
    // 뒤쪽부터 찾으므로, 이미 지나친 종목으로 되돌아가 붙잡지 않습니다.
    if (position.setNumber >= exercise.defaultSets) {
      setSelectedId(nextUnfinishedAfter(getState().active, exercise.id));
    }

    const hitTarget = r.value >= exercise.targetReps;
    setFeedback(msg ?? (hitTarget ? '목표 반복 달성!' : null));
    window.setTimeout(() => setFeedback(null), 2600);
  }

  function handleFinish() {
    const result = finishStrengthSession(notes);
    if (result) nav(`/complete/${result.session.id}`, { replace: true, state: { result } });
    else nav('/', { replace: true });
  }

  function handleDiscard() {
    if (!window.confirm('이번 운동 기록을 저장하지 않고 나갈까요?\n(기록은 삭제 표시만 되고 완전히 지워지지는 않습니다)')) return;
    discardActiveSession();
    nav('/', { replace: true });
  }

  return (
    <>
      <TopBar title={active.workoutType === 'STRENGTH_A' ? 'A 루틴' : 'B 루틴'} />
      <div className="page page--full">
        {/* 진행 상황 */}
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="badge badge--strength">
            종목 {progress ? progress.exercises.filter((e) => (progress.counts.get(e.id) ?? 0) >= e.defaultSets).length : 0}
            {' / '}{exercises.length} 완료
          </span>
          <span className="badge">⏱ {formatClock(elapsed)}</span>
        </div>

        {/* 종목 선택 — 눌러서 아무 종목으로나 바로 이동합니다 */}
        {progress && (
          <div className="ex-picker" role="tablist" aria-label="종목 선택" ref={pickerRef}>
            {progress.exercises.map((ex) => {
              const done = progress.counts.get(ex.id) ?? 0;
              const complete = done >= ex.defaultSets;
              const current = exercise?.id === ex.id;
              return (
                <button
                  key={ex.id}
                  role="tab"
                  aria-selected={current}
                  className={'ex-chip' + (current ? ' ex-chip--on' : '') + (complete ? ' ex-chip--done' : '')}
                  onClick={() => setSelectedId(ex.id)}
                >
                  <span className="ex-chip__name">{ex.name}</span>
                  <span className="ex-chip__count">
                    {complete ? `✓ ${done}` : `${done} / ${ex.defaultSets}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showFinish ? (
          <FinishPanel
            summary={summary}
            notes={notes}
            setNotes={setNotes}
            finishing={finishing}
            onFinish={() => {
              setFinishing(true);
              handleFinish();
            }}
          />
        ) : (
          <>
            <div className="active-head">
              <div className="active-head__exercise">{exercise.name}</div>
              <div className="active-head__set">
                {position!.setNumber > exercise.defaultSets
                  ? `추가 ${position!.setNumber - exercise.defaultSets}세트`
                  : `SET ${position!.setNumber} / ${exercise.defaultSets}`}
                {' · 목표 '}{exercise.targetReps}회
              </div>
            </div>

            <div className="progress-dots">
              {Array.from({ length: Math.max(exercise.defaultSets, position!.setNumber) }, (_, i) => (
                <span
                  key={i}
                  className={
                    'dot ' +
                    (i < position!.setNumber - 1 ? 'dot--done' : i === position!.setNumber - 1 ? 'dot--current' : '')
                  }
                />
              ))}
            </div>

            <div className="card card--flat">
              <div className="card__label">지난 기록</div>
              <LastRecord sets={state.exerciseStats[exercise.id]?.lastSets ?? []} current={position!.setNumber} />

              {/* 지난번 목표를 다 채웠으면 올려보라고 제안합니다. 강제하지 않습니다. */}
              {suggestion && position!.setNumber === 1 && (
                <div className="suggest">
                  <div className="suggest__main">
                    <div className="suggest__title">🔥 중량을 올려볼 때입니다</div>
                    <div className="suggest__sub">{suggestion.message}</div>
                  </div>
                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--strength)', color: '#1a0d05' }}
                    onClick={() => { setWeight(String(suggestion.suggested)); setError(null); }}
                  >
                    {formatKg(suggestion.suggested)}kg 적용
                  </button>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card__label">이번 기록</div>
              <div className="set-inputs">
                <div>
                  <input
                    className={'input' + (error ? ' input--invalid' : '')}
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={weight}
                    placeholder={ghost ? formatKg(ghost.weight) : '0'}
                    onChange={(e) => { setWeight(e.target.value); setError(null); }}
                    aria-label="중량"
                  />
                  <div className="set-input-unit">kg</div>
                </div>
                <div>
                  <input
                    className={'input' + (error ? ' input--invalid' : '')}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    value={reps}
                    placeholder={ghost ? String(ghost.reps) : String(exercise.targetReps)}
                    onChange={(e) => { setReps(e.target.value); setError(null); }}
                    aria-label="반복 횟수"
                  />
                  <div className="set-input-unit">회</div>
                </div>
              </div>

              {error && <div className="input-error">{error}</div>}
              {feedback && !error && (
                <div className="badge badge--ok pop" style={{ marginTop: 10 }}>🔥 {feedback}</div>
              )}

              <button className="btn btn--strength btn--lg" style={{ marginTop: 14 }} onClick={handleCompleteSet}>
                세트 완료
              </button>

              <button
                className="btn btn--ghost btn--sm"
                style={{ width: '100%', marginTop: 10 }}
                onClick={undoLastSet}
                disabled={active.sets.length === 0}
              >
                ↩ 이전 세트 취소
              </button>
            </div>

            {state.restEndsAt !== null && (
              <div className="rest-bar">
                <span className="rest-bar__time">
                  {restRemaining > 0 ? formatMMSS(restRemaining) : '00:00'}
                </span>
                <span className="rest-bar__label">
                  {restRemaining > 0 ? '휴식 중' : '🔔 다음 세트를 시작하세요!'}
                </span>
                <button className="btn btn--sm btn--ghost" onClick={() => addRestSeconds(30)}>+30초</button>
                <button className="btn btn--sm btn--ghost" onClick={skipRest}>건너뛰기</button>
              </div>
            )}

            <div className="divider" />
            <div className="row">
              <span className="muted">
                {summary.totalSets}세트 · {summary.totalReps}회 · {Math.round(summary.totalVolume).toLocaleString('ko-KR')}kg
              </span>
              <button className="btn btn--sm btn--ghost" onClick={() => setForceFinish(true)}>
                운동 마치기
              </button>
            </div>
          </>
        )}

        {forceFinish && !showFinish && (
          <FinishPanel
            summary={summary}
            notes={notes}
            setNotes={setNotes}
            finishing={finishing}
            onFinish={() => { setFinishing(true); handleFinish(); }}
            onCancel={() => setForceFinish(false)}
          />
        )}

        <button className="btn btn--danger btn--sm" style={{ width: '100%', marginTop: 20 }} onClick={handleDiscard}>
          저장하지 않고 나가기
        </button>
      </div>
    </>
  );
}

function LastRecord({ sets, current }: { sets: { weight: number; reps: number }[]; current: number }) {
  if (sets.length === 0) {
    return <div className="muted">첫 기록입니다. 오늘의 무게를 남겨보세요.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sets.map((s, i) => (
        <div
          key={i}
          style={{
            display: 'flex', gap: 10, fontSize: 15,
            fontWeight: i === current - 1 ? 700 : 400,
            color: i === current - 1 ? 'var(--text)' : 'var(--text-faint)',
          }}
        >
          <span style={{ width: 44 }}>{i + 1}세트</span>
          <span>{formatKg(s.weight)}kg × {s.reps}회</span>
        </div>
      ))}
    </div>
  );
}

function FinishPanel({
  summary, notes, setNotes, finishing, onFinish, onCancel,
}: {
  summary: { totalSets: number; totalReps: number; totalVolume: number };
  notes: string;
  setNotes: (v: string) => void;
  finishing: boolean;
  onFinish: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="card">
      <div className="card__label">운동 마무리</div>
      <div className="stat-grid stat-grid--3" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="stat__value">{summary.totalSets}</div><div className="stat__label">세트</div></div>
        <div className="stat"><div className="stat__value">{summary.totalReps}</div><div className="stat__label">반복</div></div>
        <div className="stat">
          <div className="stat__value" style={{ fontSize: 18 }}>{Math.round(summary.totalVolume).toLocaleString('ko-KR')}</div>
          <div className="stat__label">볼륨 kg</div>
        </div>
      </div>
      <label className="field">
        <span className="field__label">오늘 운동 메모 (선택)</span>
        <input
          className="input input--text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="컨디션 좋음 / 오른쪽 어깨가 뻐근함..."
        />
      </label>
      <button className="btn btn--strength btn--lg" style={{ marginTop: 14 }} onClick={onFinish} disabled={finishing}>
        운동 완료
      </button>
      {onCancel && (
        <button className="btn btn--ghost btn--sm" style={{ width: '100%', marginTop: 10 }} onClick={onCancel}>
          계속 운동하기
        </button>
      )}
    </div>
  );
}
