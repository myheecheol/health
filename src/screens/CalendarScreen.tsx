import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toDateKey } from '../data/ids';
import { isRunningSession, type WorkoutSession } from '../data/types';
import {
  buildMonthGrid,
  formatMonthLabel,
  groupByDate,
  shiftMonth,
  summarizeMonth,
  WEEKDAY_LABELS,
} from '../domain/calendar';
import { formatDuration, formatKm, summarizeStrength } from '../domain/volume';
import { visibleSessions } from '../state/store';
import { useAppState } from '../state/useStore';

export function CalendarScreen() {
  useAppState();
  const sessions = visibleSessions();

  const today = new Date();
  const [{ year, month }, setMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [selected, setSelected] = useState<string | null>(toDateKey());

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const byDate = useMemo(() => groupByDate(sessions), [sessions]);
  const summary = useMemo(() => summarizeMonth(sessions, year, month), [sessions, year, month]);

  const selectedSessions = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className="stack">
      <div className="card">
        <div className="cal-head">
          <button
            className="cal-nav"
            onClick={() => setMonth(shiftMonth(year, month, -1))}
            aria-label="이전 달"
          >
            ←
          </button>
          <span className="cal-head__label">{formatMonthLabel(year, month)}</span>
          <button
            className="cal-nav"
            onClick={() => setMonth(shiftMonth(year, month, 1))}
            aria-label="다음 달"
          >
            →
          </button>
        </div>

        <div className="cal-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="cal-weekday">{label}</div>
          ))}
        </div>

        <div className="cal-grid">
          {grid.flat().map((cell, i) => {
            if (cell.isPadding) return <div key={`p${i}`} className="cal-day cal-day--pad" />;

            const day = byDate.get(cell.dateKey!) ?? [];
            const hasStrength = day.some((s) => !isRunningSession(s));
            const hasRunning = day.some(isRunningSession);

            return (
              <button
                key={cell.dateKey}
                className={
                  'cal-day' +
                  (day.length > 0 ? ' cal-day--has' : '') +
                  (cell.isToday ? ' cal-day--today' : '') +
                  (cell.dateKey === selected ? ' cal-day--selected' : '')
                }
                onClick={() => setSelected(cell.dateKey)}
              >
                <span>{cell.day}</span>
                <span className="cal-dots">
                  {hasStrength && <span className="cal-dot cal-dot--strength" />}
                  {hasRunning && <span className="cal-dot cal-dot--running" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="cal-legend">
          <span><i className="cal-dot cal-dot--strength" /> 근력</span>
          <span><i className="cal-dot cal-dot--running" /> 러닝</span>
        </div>
      </div>

      {/* 이번 달 요약 — 근력과 러닝을 따로 셉니다 */}
      <div className="card">
        <div className="card__label">{formatMonthLabel(year, month)} 요약</div>
        <div className="stat-grid stat-grid--3">
          <div className="stat">
            <div className="stat__value">{summary.activeDays}</div>
            <div className="stat__label">운동한 날</div>
          </div>
          <div className="stat">
            <div className="stat__value" style={{ color: 'var(--strength)' }}>{summary.strengthCount}</div>
            <div className="stat__label">근력</div>
          </div>
          <div className="stat">
            <div className="stat__value" style={{ color: 'var(--running)' }}>
              {summary.runningKm > 0 ? summary.runningKm.toFixed(1) : summary.runningCount}
            </div>
            <div className="stat__label">{summary.runningKm > 0 ? '러닝 km' : '러닝'}</div>
          </div>
        </div>
      </div>

      {/* 선택한 날의 기록 */}
      {selected && (
        <div className="card">
          <div className="card__label">{selected.replace(/-/g, '. ')}</div>
          {selectedSessions.length === 0 ? (
            <div className="muted">이 날은 운동 기록이 없습니다.</div>
          ) : (
            <div className="list">
              {selectedSessions.map((s) => (
                <DayRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayRow({ session }: { session: WorkoutSession }) {
  if (isRunningSession(session)) {
    return (
      <Link to={`/history/${session.id}`} className="list-item">
        <span className="badge badge--running">🏃</span>
        <div className="list-item__main">
          <div className="list-item__title">러닝 {formatKm(session.run.distanceKm)}</div>
          <div className="list-item__sub">{formatDuration(session.duration)}</div>
        </div>
        <div className="list-item__right">→</div>
      </Link>
    );
  }
  const sum = summarizeStrength(session);
  return (
    <Link to={`/history/${session.id}`} className="list-item">
      <span className="badge badge--strength">
        {session.workoutType === 'STRENGTH_A' ? 'A' : 'B'}
      </span>
      <div className="list-item__main">
        <div className="list-item__title">
          {session.workoutType === 'STRENGTH_A' ? 'A' : 'B'} 루틴 · {sum.totalSets}세트
        </div>
        <div className="list-item__sub">
          {formatDuration(session.duration)} · {Math.round(sum.totalVolume).toLocaleString('ko-KR')}kg
        </div>
      </div>
      <div className="list-item__right">→</div>
    </Link>
  );
}
