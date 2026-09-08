import { toDateKey } from '../data/ids';
import { isRunningSession, type WorkoutSession } from '../data/types';

/**
 * 달력 계산. 날짜 다루기는 실수가 나기 쉬운 영역이라
 * 화면과 분리해 순수 함수로 두고 테스트로 고정합니다.
 */

/** 요구사항 28절의 예시대로 월요일을 한 주의 시작으로 씁니다. */
export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface DayCell {
  /** 'YYYY-MM-DD'. 빈 칸이면 null */
  dateKey: string | null;
  day: number | null;
  isToday: boolean;
  /** 이번 달이 아닌 앞뒤 여백 칸 */
  isPadding: boolean;
}

/** 한 달을 주 단위 격자로 만듭니다. month는 1~12. */
export function buildMonthGrid(year: number, month: number, today = new Date()): DayCell[][] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // JS의 getDay()는 일요일이 0이므로 월요일 시작으로 옮깁니다.
  const leading = (first.getDay() + 6) % 7;
  const todayKey = toDateKey(today.getTime());

  const cells: DayCell[] = [];
  for (let i = 0; i < leading; i++) {
    cells.push({ dateKey: null, day: null, isToday: false, isPadding: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ dateKey, day: d, isToday: dateKey === todayKey, isPadding: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, isToday: false, isPadding: true });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 날짜별로 세션을 모읍니다. 같은 날 여러 번 운동한 경우도 그대로 담깁니다. */
export function groupByDate(sessions: WorkoutSession[]): Map<string, WorkoutSession[]> {
  const map = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    const list = map.get(s.date);
    if (list) list.push(s);
    else map.set(s.date, [s]);
  }
  for (const list of map.values()) list.sort((a, b) => a.startTime - b.startTime);
  return map;
}

export interface MonthSummary {
  strengthCount: number;
  runningCount: number;
  runningKm: number;
  activeDays: number;
}

/** 해당 월의 요약. 웨이트와 러닝을 따로 셉니다. */
export function summarizeMonth(sessions: WorkoutSession[], year: number, month: number): MonthSummary {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const inMonth = sessions.filter((s) => s.date.startsWith(prefix));

  return {
    strengthCount: inMonth.filter((s) => !isRunningSession(s)).length,
    runningCount: inMonth.filter(isRunningSession).length,
    runningKm: inMonth.filter(isRunningSession).reduce((sum, s) => sum + s.run.distanceKm, 0),
    activeDays: new Set(inMonth.map((s) => s.date)).size,
  };
}

/** 이전/다음 달로 이동. 12월 다음은 다음 해 1월입니다. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}
