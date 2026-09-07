import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MOTIVATION } from '../config/gameConfig';
import { getRoutine } from '../config/routines';
import { isRunningSession } from '../data/types';
import { formatDuration, formatKm, summarizeStrength } from '../domain/volume';
import { useAppState } from '../state/useStore';

export function CompleteScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const state = useAppState();
  const session = state.sessions.find((s) => s.id === sessionId);

  // 세션 id로 문구를 고르면 화면을 다시 열어도 같은 문구가 나옵니다.
  const quote = useMemo(() => {
    if (!session) return '';
    const pool = isRunningSession(session)
      ? [...MOTIVATION.RUNNING, ...MOTIVATION.COMMON]
      : [...MOTIVATION.STRENGTH, ...MOTIVATION.COMMON];
    let hash = 0;
    for (const ch of session.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return pool[hash % pool.length]!;
  }, [session]);

  if (!session) {
    return (
      <div className="page">
        <div className="empty">기록을 찾을 수 없습니다.</div>
        <Link to="/" className="btn btn--ghost" style={{ textDecoration: 'none' }}>홈으로</Link>
      </div>
    );
  }

  const running = isRunningSession(session);
  const totalRunKm = state.sessions
    .filter((s) => s.deletedAt === null && s.completed)
    .filter(isRunningSession)
    .reduce((sum, s) => sum + s.run.distanceKm, 0);

  return (
    <div className="page page--full">
      <div className="complete pop">
        <div className="complete__emoji">{running ? '🏃' : '🔥'}</div>
        <div className="complete__title">
          {running ? 'RUN COMPLETE!' : 'WORKOUT COMPLETE!'}
        </div>
        <div className="complete__sub">
          {running ? '러닝 완료!' : `${getRoutine(session.workoutType).name} 완료!`}
        </div>
      </div>

      {running ? (
        <div className="card">
          <div className="stat-grid">
            <div className="stat">
              <div className="stat__value" style={{ color: 'var(--running)' }}>
                {formatKm(session.run.distanceKm)}
              </div>
              <div className="stat__label">달린 거리</div>
            </div>
            <div className="stat">
              <div className="stat__value">{formatDuration(session.duration)}</div>
              <div className="stat__label">운동 시간</div>
            </div>
          </div>
        </div>
      ) : (
        <StrengthSummary session={session} />
      )}

      {(session.xpEarned > 0 || session.pointsEarned > 0) && (
        <div className="card">
          <div className="stat-grid">
            <div className="stat">
              <div className="stat__value" style={{ color: 'var(--xp)' }}>+{session.xpEarned} XP</div>
              <div className="stat__label">획득 경험치</div>
            </div>
            <div className="stat">
              <div className="stat__value" style={{ color: 'var(--gold)' }}>+{session.pointsEarned}P</div>
              <div className="stat__label">보상 포인트</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <span className="muted">🔥 현재 연속 운동</span>
          <span style={{ fontWeight: 700 }}>{state.user.currentStreak}회</span>
        </div>
        {running && (
          <div className="row">
            <span className="muted">🏆 누적 러닝 거리</span>
            <span style={{ fontWeight: 700 }}>{totalRunKm.toFixed(1)}km</span>
          </div>
        )}
      </div>

      {session.notes && (
        <div className="card">
          <div className="card__label">메모</div>
          <div>{session.notes}</div>
        </div>
      )}

      <div className="complete__quote">"{quote}"</div>

      <Link to="/" className="btn btn--primary btn--lg" style={{ textDecoration: 'none' }}>
        홈으로
      </Link>
    </div>
  );
}

function StrengthSummary({ session }: { session: Parameters<typeof summarizeStrength>[0] }) {
  const sum = summarizeStrength(session);
  return (
    <div className="card">
      <div className="stat-grid">
        <div className="stat">
          <div className="stat__value">{formatDuration(session.duration)}</div>
          <div className="stat__label">운동 시간</div>
        </div>
        <div className="stat">
          <div className="stat__value">{sum.totalSets}</div>
          <div className="stat__label">총 세트</div>
        </div>
        <div className="stat">
          <div className="stat__value">{sum.totalReps}</div>
          <div className="stat__label">총 반복</div>
        </div>
        <div className="stat">
          <div className="stat__value" style={{ color: 'var(--strength)' }}>
            {Math.round(sum.totalVolume).toLocaleString('ko-KR')}
          </div>
          <div className="stat__label">총 볼륨 (kg)</div>
        </div>
      </div>
    </div>
  );
}
