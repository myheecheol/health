import { Link, useNavigate } from 'react-router-dom';
import { getRoutine } from '../config/routines';
import { isRunningSession } from '../data/types';
import { getLevelProgress } from '../domain/level';
import { getNextStrengthRoutine, otherRoutine } from '../domain/progression';
import { nextStreakMilestone } from '../domain/streak';
import { formatDuration, formatKm, summarizeStrength } from '../domain/volume';
import { setNextRoutineOverride, visibleSessions } from '../state/store';
import { useAppState } from '../state/useStore';
import { SyncBadge } from '../components/SyncBadge';

export function HomeScreen() {
  const state = useAppState();
  const nav = useNavigate();
  const sessions = visibleSessions();
  const next = getNextStrengthRoutine(state.sessions, state.user.nextRoutineOverride);
  const routine = getRoutine(next);
  const progress = getLevelProgress(state.user.xp);
  const nextTarget = nextStreakMilestone(state.user.currentStreak);
  const recent = [...sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 3);

  // 지금 포인트로 바로 바꿀 수 있는 보상 중 가장 비싼 것
  const affordable = state.rewards
    .filter((r) => r.active && r.cost <= state.user.rewardPoints)
    .sort((a, b) => b.cost - a.cost)[0];

  return (
    <div className="page">
      {/* 진행 중이던 운동이 있으면 가장 먼저 알립니다 — 기록이 사라졌다고 오해하지 않도록 */}
      {state.active && (
        <button
          className="banner banner--info"
          style={{ width: '100%', border: '1px solid rgba(139,108,255,0.3)', textAlign: 'left' }}
          onClick={() =>
            nav(isRunningSession(state.active!) ? '/workout/running' : '/workout/strength/go')
          }
        >
          ▶ 진행 중인 운동이 있습니다 — 이어서 하기
        </button>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>🏋️ MY FITNESS RPG</h1>
        <SyncBadge />
      </div>

      {/* 레벨 / XP / 스트릭 */}
      <div className="card">
        <div className="row">
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Lv.{progress.level}
          </span>
          <span className="badge">🔥 연속 {state.user.currentStreak}회</span>
        </div>
        <div className="xpbar" style={{ marginTop: 12 }}>
          <div className="xpbar__fill" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {progress.intoLevel.toLocaleString('ko-KR')} / {progress.needed.toLocaleString('ko-KR')} XP
          </span>
          {nextTarget && (
            <span className="muted" style={{ fontSize: 13 }}>
              다음 목표 {nextTarget}회 연속
            </span>
          )}
        </div>
      </div>

      {/* 다음 근력 운동 */}
      <div className="card">
        <div className="card__label">다음 근력 운동</div>
        <div className="row">
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{routine.name}</div>
            <div className="muted">{routine.summary}</div>
          </div>
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => setNextRoutineOverride(otherRoutine(next))}
          >
            {getRoutine(otherRoutine(next)).name}로 변경
          </button>
        </div>
        <Link
          to="/workout/strength"
          className="btn btn--strength btn--lg"
          style={{ marginTop: 14, textDecoration: 'none' }}
        >
          {routine.name} 시작
        </Link>
      </div>

      {/* 오늘의 운동 선택 */}
      <div className="card">
        <div className="card__label">오늘의 운동</div>
        <div className="muted" style={{ marginBottom: 12 }}>원하는 운동을 선택하세요.</div>
        <div className="btn-row">
          <Link to="/workout/strength" className="btn btn--strength" style={{ textDecoration: 'none' }}>
            🏋️ 근력 운동
          </Link>
          <Link to="/workout/running" className="btn btn--running" style={{ textDecoration: 'none' }}>
            🏃 러닝
          </Link>
        </div>
      </div>

      {/* 최근 기록 */}
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="card__label" style={{ margin: 0 }}>최근 기록</div>
          <Link to="/history" className="muted" style={{ fontSize: 13 }}>
            전체 보기 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="muted">아직 기록이 없습니다. 첫 운동을 시작해보세요.</div>
        ) : (
          <div className="list">
            {recent.map((s) => (
              <RecentRow key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>

      {/* 보상 포인트 */}
      <div className="card">
        <div className="row">
          <div>
            <div className="card__label" style={{ margin: 0 }}>🎁 보상 포인트</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--gold)' }}>
              {state.user.rewardPoints.toLocaleString('ko-KR')}P
            </div>
          </div>
          <Link to="/rewards" className="btn btn--sm btn--ghost" style={{ textDecoration: 'none' }}>
            보상 상점
          </Link>
        </div>
        {affordable && (
          <div className="badge badge--warn" style={{ marginTop: 10 }}>
            지금 {affordable.emoji} {affordable.name} 교환 가능
          </div>
        )}
      </div>
    </div>
  );
}

function RecentRow({ session }: { session: ReturnType<typeof visibleSessions>[number] }) {
  if (isRunningSession(session)) {
    return (
      <Link to={`/history/${session.id}`} className="list-item">
        <span className="badge badge--running">🏃 러닝</span>
        <div className="list-item__main">
          <div className="list-item__title">{formatKm(session.run.distanceKm)}</div>
          <div className="list-item__sub">{session.date}</div>
        </div>
        <div className="list-item__right">{formatDuration(session.duration)}</div>
      </Link>
    );
  }
  const sum = summarizeStrength(session);
  return (
    <Link to={`/history/${session.id}`} className="list-item">
      <span className="badge badge--strength">
        🏋️ {session.workoutType === 'STRENGTH_A' ? 'A' : 'B'}
      </span>
      <div className="list-item__main">
        <div className="list-item__title">{sum.totalSets}세트 · {sum.totalReps}회</div>
        <div className="list-item__sub">{session.date}</div>
      </div>
      <div className="list-item__right">{formatDuration(session.duration)}</div>
    </Link>
  );
}
