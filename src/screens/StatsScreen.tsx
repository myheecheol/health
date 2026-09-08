import { useMemo } from 'react';
import { getLevelProgress } from '../domain/level';
import { maxWeights, monthlyRunning, volumeTrend, weeklyActivity } from '../domain/series';
import { computeStats } from '../domain/stats';
import { formatDuration } from '../domain/volume';
import { visibleSessions } from '../state/store';
import { useAppState } from '../state/useStore';
import { BarList, ChartCard, LineChart, StackedColumns } from '../components/Chart';
import { TopBar } from '../components/TopBar';

const STRENGTH = 'var(--chart-strength)';
const RUNNING = 'var(--chart-running)';
const XP = 'var(--chart-xp)';

export function StatsScreen() {
  const state = useAppState();
  const sessions = visibleSessions();

  const stats = useMemo(() => computeStats(state.sessions), [state.sessions]);
  const weeks = useMemo(() => weeklyActivity(state.sessions, 12), [state.sessions]);
  const volume = useMemo(() => volumeTrend(state.sessions, 12), [state.sessions]);
  const months = useMemo(() => monthlyRunning(state.sessions, 6), [state.sessions]);
  const maxes = useMemo(() => maxWeights(state.exerciseStats), [state.exerciseStats]);

  const progress = getLevelProgress(state.user.xp);
  const noData = sessions.length === 0;

  return (
    <>
      <TopBar title="통계" />
      <div className="page">
        {noData && (
          <div className="banner banner--info">
            아직 기록이 없습니다. 운동을 하면 여기에 통계가 쌓입니다.
          </div>
        )}

        {/* ── 전체 ── */}
        <div className="stat-grid">
          <Stat value={String(stats.common.totalSessions)} label="총 운동 횟수" />
          <Stat value={formatDuration(stats.common.totalDuration)} label="총 운동 시간" small />
          <Stat value={`Lv.${progress.level}`} label={`${state.user.xp.toLocaleString('ko-KR')} XP`} color={XP} />
          <Stat value={`${state.user.currentStreak}회`} label={`최고 ${state.user.bestStreak}회 연속`} />
        </div>

        <ChartCard
          title="최근 12주 운동 횟수"
          subtitle="주별로 근력과 러닝을 나눠서 셉니다"
          legend={[{ label: '근력', color: STRENGTH }, { label: '러닝', color: RUNNING }]}
          empty={noData}
          table={
            <table className="data-table">
              <thead><tr><th>주 시작</th><th>근력</th><th>러닝</th><th>합계</th></tr></thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.key}>
                    <td>{w.label}</td><td>{w.strength}</td><td>{w.running}</td><td>{w.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <StackedColumns
            data={weeks.map((w) => ({ label: w.label, a: w.strength, b: w.running }))}
            colorA={STRENGTH} colorB={RUNNING} nameA="근력" nameB="러닝"
          />
        </ChartCard>

        {/* ── 웨이트 ── */}
        <div className="stats-section">
          <div className="stats-section__head">
            <span className="stats-section__dot" style={{ background: STRENGTH }} />
            근력 운동
          </div>

          <div className="stat-grid">
            <Stat value={`${stats.strength.countA} · ${stats.strength.countB}`} label="A · B 루틴 횟수" />
            <Stat value={stats.strength.totalSets.toLocaleString('ko-KR')} label="총 세트" />
            <Stat value={stats.strength.totalReps.toLocaleString('ko-KR')} label="총 반복" />
            <Stat value={`${Math.round(stats.strength.totalVolume).toLocaleString('ko-KR')}`}
                  label="총 볼륨 (kg)" color={STRENGTH} small />
          </div>

          <ChartCard
            title="운동별 총 볼륨 추이"
            subtitle="한 번의 근력 운동에서 든 무게의 합 (중량 × 반복)"
            empty={volume.length === 0}
            table={
              <table className="data-table">
                <thead><tr><th>날짜</th><th>루틴</th><th>볼륨 (kg)</th></tr></thead>
                <tbody>
                  {volume.map((v) => (
                    <tr key={v.sessionId}>
                      <td>{v.date}</td><td>{v.routine}</td>
                      <td>{v.volume.toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <LineChart
              data={volume.map((v) => ({ label: v.label, value: v.volume, sub: `${v.routine} 루틴` }))}
              color={STRENGTH} unit="kg"
            />
          </ChartCard>

          <ChartCard
            title="종목별 최고 중량"
            subtitle="지금까지 든 가장 무거운 무게"
            empty={maxes.length === 0}
            table={
              <table className="data-table">
                <thead><tr><th>종목</th><th>최고 중량</th><th>최고 반복</th></tr></thead>
                <tbody>
                  {maxes.map((m) => (
                    <tr key={m.exerciseId}>
                      <td>{m.name}</td><td>{m.maxWeight}kg</td><td>{m.maxReps}회</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <BarList
              data={maxes.map((m) => ({ name: m.name, value: m.maxWeight, sub: `· ${m.maxReps}회` }))}
              color={STRENGTH} unit="kg"
            />
          </ChartCard>
        </div>

        {/* ── 러닝 ── */}
        <div className="stats-section">
          <div className="stats-section__head">
            <span className="stats-section__dot" style={{ background: RUNNING }} />
            러닝
          </div>

          <div className="stat-grid">
            <Stat value={`${stats.running.total}회`} label="총 러닝" />
            <Stat value={`${stats.running.totalDistanceKm}km`} label="누적 거리" color={RUNNING} />
            <Stat value={`${stats.running.longestRunKm}km`} label="최장 1회" />
            <Stat value={`${stats.running.monthlyDistanceKm}km`} label="이번 달" />
          </div>

          <ChartCard
            title="월별 러닝 거리"
            subtitle={`올해 누적 ${stats.running.yearlyDistanceKm}km`}
            empty={stats.running.total === 0}
            table={
              <table className="data-table">
                <thead><tr><th>월</th><th>거리 (km)</th><th>횟수</th></tr></thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.key}><td>{m.label}</td><td>{m.km}</td><td>{m.runs}</td></tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <LineChart
              data={months.map((m) => ({ label: m.label, value: m.km, sub: `${m.runs}회` }))}
              color={RUNNING} unit="km"
            />
          </ChartCard>
        </div>
      </div>
    </>
  );
}

function Stat({ value, label, color, small }: {
  value: string; label: string; color?: string; small?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat__value" style={{ color, fontSize: small ? 19 : undefined }}>{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
