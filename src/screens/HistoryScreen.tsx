import { Link, useParams } from 'react-router-dom';
import { getExercise, getRoutine } from '../config/routines';
import { isRunningSession, isStrengthSession, type WorkoutSession } from '../data/types';
import { formatDuration, formatKg, formatKm, setsVolume, summarizeStrength } from '../domain/volume';
import { visibleSessions } from '../state/store';
import { useAppState } from '../state/useStore';
import { TopBar } from '../components/TopBar';

export function HistoryScreen() {
  useAppState();
  const sessions = [...visibleSessions()].sort((a, b) => b.startTime - a.startTime);

  return (
    <>
      <TopBar title="운동 기록" />
      <div className="page">
        {sessions.length === 0 ? (
          <div className="empty">아직 기록이 없습니다.</div>
        ) : (
          <div className="list">
            {sessions.map((s) => (
              <Link key={s.id} to={`/history/${s.id}`} className="list-item">
                <span className={`badge badge--${isRunningSession(s) ? 'running' : 'strength'}`}>
                  {isRunningSession(s) ? '🏃' : s.workoutType === 'STRENGTH_A' ? 'A' : 'B'}
                </span>
                <div className="list-item__main">
                  <div className="list-item__title">{titleOf(s)}</div>
                  <div className="list-item__sub">{s.date} · {formatDuration(s.duration)}</div>
                </div>
                <div className="list-item__right">→</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const state = useAppState();
  const session = state.sessions.find((s) => s.id === sessionId);

  if (!session) {
    return (
      <>
        <TopBar title="운동 상세" back="/history" />
        <div className="page"><div className="empty">기록을 찾을 수 없습니다.</div></div>
      </>
    );
  }

  return (
    <>
      <TopBar title={titleOf(session)} back="/history" />
      <div className="page">
        <div className="card">
          <div className="row">
            <span className="muted">날짜</span>
            <span style={{ fontWeight: 700 }}>{session.date}</span>
          </div>
          <div className="row">
            <span className="muted">운동 시간</span>
            <span style={{ fontWeight: 700 }}>{formatDuration(session.duration)}</span>
          </div>
          {session.condition && (
            <div className="row">
              <span className="muted">컨디션</span>
              <span style={{ fontWeight: 700 }}>
                {['😫', '😕', '😐', '🙂', '🔥'][session.condition.mood - 1]}
                {session.condition.sleepHours != null && ` · 수면 ${session.condition.sleepHours}h`}
                {session.condition.bodyWeightKg != null && ` · ${session.condition.bodyWeightKg}kg`}
              </span>
            </div>
          )}
          {!session.completed && (
            <div className="banner banner--warn" style={{ marginTop: 12, marginBottom: 0 }}>
              완료하지 않은 기록입니다
            </div>
          )}
        </div>

        {isRunningSession(session) ? (
          <div className="card">
            <div className="stat-grid">
              <div className="stat">
                <div className="stat__value" style={{ color: 'var(--running)' }}>
                  {formatKm(session.run.distanceKm)}
                </div>
                <div className="stat__label">달린 거리</div>
              </div>
              <div className="stat">
                <div className="stat__value">{formatDuration(session.run.duration)}</div>
                <div className="stat__label">운동 시간</div>
              </div>
            </div>
          </div>
        ) : (
          <StrengthDetail session={session} />
        )}

        {session.notes && (
          <div className="card">
            <div className="card__label">메모</div>
            <div>{session.notes}</div>
          </div>
        )}
      </div>
    </>
  );
}

function StrengthDetail({ session }: { session: Extract<WorkoutSession, { sets: unknown }> }) {
  const sum = summarizeStrength(session);
  const byExercise = new Map<string, typeof session.sets>();
  for (const set of session.sets) {
    const list = byExercise.get(set.exerciseId);
    if (list) list.push(set);
    else byExercise.set(set.exerciseId, [set]);
  }

  return (
    <>
      <div className="card">
        <div className="stat-grid stat-grid--3">
          <div className="stat"><div className="stat__value">{sum.totalSets}</div><div className="stat__label">세트</div></div>
          <div className="stat"><div className="stat__value">{sum.totalReps}</div><div className="stat__label">반복</div></div>
          <div className="stat">
            <div className="stat__value" style={{ fontSize: 18 }}>{Math.round(sum.totalVolume).toLocaleString('ko-KR')}</div>
            <div className="stat__label">볼륨 kg</div>
          </div>
        </div>
      </div>

      {[...byExercise].map(([exerciseId, sets]) => (
        <div key={exerciseId} className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{getExercise(exerciseId)?.name ?? exerciseId}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {Math.round(setsVolume(sets)).toLocaleString('ko-KR')}kg
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sets.sort((a, b) => a.setNumber - b.setNumber).map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 10, fontSize: 15, color: 'var(--text-dim)' }}>
                <span style={{ width: 44 }}>{s.setNumber}세트</span>
                <span style={{ color: 'var(--text)' }}>{formatKg(s.weight)}kg × {s.reps}회</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function titleOf(s: WorkoutSession): string {
  if (isRunningSession(s)) return `러닝 ${formatKm(s.run.distanceKm)}`;
  if (isStrengthSession(s)) {
    const sum = summarizeStrength(s);
    return `${getRoutine(s.workoutType).name} · ${sum.totalSets}세트`;
  }
  return '운동';
}
