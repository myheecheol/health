import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MOTIVATION } from '../config/gameConfig';
import { getRoutine } from '../config/routines';
import { isRunningSession } from '../data/types';
import { getLevelProgress } from '../domain/level';
import { prLabel } from '../domain/records';
import { nextStreakMilestone } from '../domain/streak';
import { formatDuration, formatKm, summarizeStrength } from '../domain/volume';
import { useAppState } from '../state/useStore';
import type { FinishResult } from '../state/store';

export function CompleteScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const state = useAppState();
  const location = useLocation();
  const session = state.sessions.find((s) => s.id === sessionId);

  // 운동을 막 끝냈을 때만 전달되는 정산 결과 (새로고침하면 없어집니다)
  const result = (location.state as { result?: FinishResult } | null)?.result ?? null;
  const progress = getLevelProgress(state.user.xp);

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

      {result?.levelUp && (
        <div className="levelup">
          <div className="levelup__title">🎉 Level Up!</div>
          <div className="levelup__jump">
            <span className="levelup__from">Lv.{result.levelUp.from}</span>
            <span className="levelup__arrow">→</span>
            <span style={{ color: 'var(--xp)' }}>Lv.{result.levelUp.to}</span>
          </div>
          <div className="levelup__sub">다음 레벨까지 {progress.remaining.toLocaleString('ko-KR')} XP</div>
        </div>
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

          {/* 어디서 몇 점을 받았는지 그대로 보여줍니다 */}
          {result && result.xpLines.length > 0 && (
            <>
              <div className="divider" />
              <div className="xp-lines">
                {result.xpLines.map((line, i) => (
                  <div key={i} className="xp-line">
                    <span className="xp-line__label">{line.label}</span>
                    <span className="xp-line__detail">{line.detail}</span>
                    <span className="xp-line__amount">+{line.amount}</span>
                  </div>
                ))}
              </div>
              <div className="xp-total">
                <span>합계</span>
                <span className="xp-total__value">+{session.xpEarned} XP</span>
              </div>
            </>
          )}

          <div className="divider" />
          <div className="row">
            <span className="muted">Lv.{progress.level}</span>
            <span className="muted" style={{ fontSize: 13 }}>
              {progress.intoLevel.toLocaleString('ko-KR')} / {progress.needed.toLocaleString('ko-KR')} XP
            </span>
          </div>
          <div className="xpbar" style={{ marginTop: 8 }}>
            <div className="xpbar__fill" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
        </div>
      )}

      {result && result.personalRecords.length > 0 && (
        <div className="card">
          <div className="card__label">🔥 개인 최고 기록</div>
          <div className="stack">
            {result.personalRecords.map((pr, i) => (
              <div key={i} className="pr">
                <span className="pr__badge">NEW</span>
                <span>{prLabel(pr)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.newAchievements.length > 0 && (
        <div className="card">
          <div className="card__label">🏅 새로 얻은 업적</div>
          <div className="list">
            {result.newAchievements.map((a) => (
              <div key={a.id} className="ach ach--new">
                <span className="ach__emoji">{a.emoji}</span>
                <div className="ach__main">
                  <div className="ach__name">{a.name}</div>
                  <div className="ach__desc">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <span className="muted">🔥 현재 연속 운동</span>
          <span style={{ fontWeight: 700 }}>{state.user.currentStreak}회</span>
        </div>
        {nextStreakMilestone(state.user.currentStreak) && (
          <div className="row">
            <span className="muted">다음 목표</span>
            <span style={{ fontWeight: 700 }}>
              {nextStreakMilestone(state.user.currentStreak)}회 연속
            </span>
          </div>
        )}
        <div className="row">
          <span className="muted">🎁 보유 포인트</span>
          <span style={{ fontWeight: 700, color: 'var(--gold)' }}>
            {state.user.rewardPoints.toLocaleString('ko-KR')}P
          </span>
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

      <div className="btn-row">
        <Link to="/rewards" className="btn btn--ghost" style={{ textDecoration: 'none' }}>
          🎁 보상 상점
        </Link>
        <Link to="/" className="btn btn--primary" style={{ textDecoration: 'none' }}>
          홈으로
        </Link>
      </div>
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
