import { describe, expect, it } from 'vitest';
import { buildMonthGrid, groupByDate, shiftMonth, summarizeMonth } from './calendar';
import type { WorkoutSession } from '../data/types';

function strength(date: string, id = date): WorkoutSession {
  return {
    id, date, workoutType: 'STRENGTH_A', startTime: 1, endTime: 2, duration: 1,
    notes: '', condition: null, completed: true, xpEarned: 0, pointsEarned: 0,
    deletedAt: null, updatedAt: 0, sets: [],
  };
}
function running(date: string, km: number, id = `${date}-run`): WorkoutSession {
  return {
    id, date, workoutType: 'RUNNING', startTime: 1, endTime: 2, duration: 1,
    notes: '', condition: null, completed: true, xpEarned: 0, pointsEarned: 0,
    deletedAt: null, updatedAt: 0,
    run: { id: `r-${id}`, sessionId: id, distanceKm: km, duration: 1, completed: true, createdAt: 0 },
  };
}

describe('buildMonthGrid', () => {
  it('주 단위 격자를 만든다 (한 주는 7칸)', () => {
    const weeks = buildMonthGrid(2026, 9);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('월요일을 한 주의 시작으로 쓴다', () => {
    // 2026-09-01은 화요일 → 앞에 빈 칸 1개(월요일)
    const weeks = buildMonthGrid(2026, 9);
    expect(weeks[0]![0]!.dateKey).toBeNull();
    expect(weeks[0]![1]!.dateKey).toBe('2026-09-01');
  });

  it('그 달의 모든 날짜를 빠짐없이 담는다', () => {
    const days = buildMonthGrid(2026, 9).flat().filter((c) => !c.isPadding);
    expect(days).toHaveLength(30);
    expect(days[29]!.dateKey).toBe('2026-09-30');
  });

  it('윤년 2월을 29일로 처리한다', () => {
    const days = buildMonthGrid(2028, 2).flat().filter((c) => !c.isPadding);
    expect(days).toHaveLength(29);
  });

  it('평년 2월을 28일로 처리한다', () => {
    const days = buildMonthGrid(2026, 2).flat().filter((c) => !c.isPadding);
    expect(days).toHaveLength(28);
  });

  it('오늘 날짜를 표시한다', () => {
    const weeks = buildMonthGrid(2026, 9, new Date(2026, 8, 15));
    const today = weeks.flat().find((c) => c.isToday);
    expect(today?.dateKey).toBe('2026-09-15');
  });
});

describe('shiftMonth', () => {
  it('다음 달로 이동한다', () => {
    expect(shiftMonth(2026, 9, 1)).toEqual({ year: 2026, month: 10 });
  });
  it('12월 다음은 다음 해 1월이다', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it('1월 이전은 지난 해 12월이다', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('groupByDate', () => {
  it('같은 날 여러 번 운동한 것을 모두 담는다', () => {
    const map = groupByDate([strength('2026-09-12'), running('2026-09-12', 6.8)]);
    expect(map.get('2026-09-12')).toHaveLength(2);
  });
});

describe('summarizeMonth — 웨이트와 러닝을 따로 센다', () => {
  const sessions = [
    strength('2026-09-01'),
    strength('2026-09-03'),
    running('2026-09-03', 6.8),
    running('2026-09-05', 5.2),
    strength('2026-10-01'), // 다른 달
  ];

  it('해당 월만 집계한다', () => {
    const s = summarizeMonth(sessions, 2026, 9);
    expect(s.strengthCount).toBe(2);
    expect(s.runningCount).toBe(2);
  });

  it('러닝 거리만 합산한다 (웨이트가 섞이지 않는다)', () => {
    expect(summarizeMonth(sessions, 2026, 9).runningKm).toBeCloseTo(12.0);
  });

  it('하루에 두 번 운동해도 운동한 날은 1일로 센다', () => {
    expect(summarizeMonth(sessions, 2026, 9).activeDays).toBe(3);
  });

  it('기록이 없는 달은 모두 0이다', () => {
    expect(summarizeMonth(sessions, 2026, 1)).toEqual({
      strengthCount: 0, runningCount: 0, runningKm: 0, activeDays: 0,
    });
  });
});
