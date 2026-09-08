import { listAchievements } from '../domain/achievements';
import { currentAchievementContext } from '../state/store';
import { useAppState } from '../state/useStore';
import { TopBar } from '../components/TopBar';

export function AchievementsScreen() {
  const state = useAppState();
  const ctx = currentAchievementContext();
  const list = listAchievements(state.achievements, ctx);
  const unlockedCount = list.filter((a) => a.unlockedAt).length;

  return (
    <>
      <TopBar title="업적" />
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🏅</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {unlockedCount} / {list.length}
          </div>
          <div className="muted">해금한 업적</div>
          <div className="xpbar" style={{ marginTop: 12 }}>
            <div
              className="xpbar__fill"
              style={{
                width: `${Math.round((unlockedCount / list.length) * 100)}%`,
                background: 'linear-gradient(90deg, var(--gold), #ffe6a8)',
              }}
            />
          </div>
        </div>

        <div className="list">
          {list.map((a) => {
            const pct = Math.min(100, Math.round((a.current / a.target) * 100));
            return (
              <div key={a.id} className={'ach' + (a.unlockedAt ? '' : ' ach--locked')}>
                <span className="ach__emoji">{a.unlockedAt ? a.emoji : '🔒'}</span>
                <div className="ach__main">
                  <div className="ach__name">{a.name}</div>
                  <div className="ach__desc">{a.description}</div>
                  {!a.unlockedAt && (
                    <>
                      <div className="ach__bar">
                        <div className="ach__fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="ach__count" style={{ marginTop: 3 }}>
                        {round(a.current)} / {round(a.target)}
                      </div>
                    </>
                  )}
                </div>
                {a.unlockedAt && (
                  <span className="badge badge--warn">
                    {new Date(a.unlockedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function round(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
