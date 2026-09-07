import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { estimatedMinutes, getExercisesFor, getRoutine, MUSCLE_LABEL, totalSetsFor } from '../config/routines';
import type { Condition } from '../data/types';
import { getNextStrengthRoutine, otherRoutine } from '../domain/progression';
import { discardActiveSession, startStrengthSession } from '../state/store';
import { useAppState } from '../state/useStore';
import { ConditionPicker } from '../components/ConditionPicker';
import { TopBar } from '../components/TopBar';
import { formatKg } from '../domain/volume';

export function StrengthPreviewScreen() {
  const state = useAppState();
  const nav = useNavigate();
  const [condition, setCondition] = useState<Condition | null>(null);

  const type = getNextStrengthRoutine(state.sessions, state.user.nextRoutineOverride);
  const routine = getRoutine(type);
  const exercises = getExercisesFor(type);
  const [minMin, maxMin] = estimatedMinutes(type);

  // 지난 운동에서 목표 반복을 전부 채운 종목 수 (요구사항 22절 "향상된 기록")
  const readyToIncrease = exercises.filter((ex) => {
    const stats = state.exerciseStats[ex.id];
    return stats && stats.lastSets.length > 0 && stats.lastSets.every((s) => s.reps >= ex.targetReps);
  }).length;

  function start() {
    // 다른 종류의 세션이 진행 중이면 먼저 정리합니다.
    if (state.active && state.active.workoutType !== type) discardActiveSession();
    if (!state.active || state.active.workoutType !== type) startStrengthSession(type, condition);
    nav('/workout/strength/go');
  }

  return (
    <>
      <TopBar title="근력 운동" back="/workout" />
      <div className="page">
        <div className="card">
          <div className="card__label">오늘의 근력 운동</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>{routine.name}</div>
          <div className="muted">{routine.summary}</div>

          <div className="stat-grid stat-grid--3" style={{ marginTop: 16 }}>
            <div className="stat">
              <div className="stat__value">{exercises.length}</div>
              <div className="stat__label">종목</div>
            </div>
            <div className="stat">
              <div className="stat__value">{totalSetsFor(type)}</div>
              <div className="stat__label">세트</div>
            </div>
            <div className="stat">
              <div className="stat__value" style={{ fontSize: 18 }}>{minMin}~{maxMin}분</div>
              <div className="stat__label">예상 시간</div>
            </div>
          </div>

          {readyToIncrease > 0 && (
            <div className="banner banner--warn" style={{ marginTop: 14, marginBottom: 0 }}>
              🔥 지난 운동에서 목표를 모두 채운 종목 {readyToIncrease}개 — 중량을 올려볼 때입니다
            </div>
          )}
        </div>

        <ConditionPicker value={condition} onChange={setCondition} />

        <div className="card">
          <div className="card__label">종목</div>
          <div className="list">
            {exercises.map((ex) => {
              const stats = state.exerciseStats[ex.id];
              return (
                <div key={ex.id} className="list-item">
                  <div className="list-item__main">
                    <div className="list-item__title">{ex.name}</div>
                    <div className="list-item__sub">
                      {MUSCLE_LABEL[ex.muscleGroup]} · 목표 {ex.targetReps}회 × {ex.defaultSets}세트
                    </div>
                  </div>
                  <div className="list-item__right">
                    {stats?.lastSets[0]
                      ? `${formatKg(stats.lastSets[0].weight)}kg`
                      : <span style={{ color: 'var(--text-faint)' }}>첫 기록</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack">
          <button className="btn btn--strength btn--lg" onClick={start}>운동 시작</button>
          <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            다음 추천은 {routine.name}입니다 ·{' '}
            <button
              className="topbar__back"
              style={{ display: 'inline', padding: 0, textDecoration: 'underline' }}
              onClick={() => nav('/settings')}
            >
              {getRoutine(otherRoutine(type)).name}로 바꾸려면 설정에서
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
