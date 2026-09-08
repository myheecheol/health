import { LEVEL_CURVE, type LevelCurve } from '../config/gameConfig';

/**
 * 레벨 곡선을 아는 유일한 곳입니다.
 * 곡선 모양을 바꿔도 이 파일 밖은 손댈 필요가 없습니다.
 */

/** Lv.level 에 도달하는 데 필요한 누적 XP */
function cumulativeFor(level: number, curve: LevelCurve = LEVEL_CURVE): number {
  const n = level - 1; // 지금까지 올린 레벨 수
  if (n <= 0) return 0;

  switch (curve.kind) {
    case 'flat':
      return n * curve.xpPerLevel;
    case 'linear':
      // base + (base+step) + (base+2*step) + ...  n개 항의 합
      return n * curve.base + (curve.step * n * (n - 1)) / 2;
    case 'table':
      return curve.thresholds[n] ?? Infinity;
  }
}

export function getLevel(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  let level = 1;
  // 레벨은 현실적으로 수백을 넘지 않으므로 단순 반복으로 충분합니다.
  while (level < 999 && cumulativeFor(level + 1) <= xp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** 이번 레벨에서 쌓은 XP */
  intoLevel: number;
  /** 다음 레벨까지 필요한 총 XP */
  needed: number;
  /** 0~1 */
  ratio: number;
  /** 다음 레벨까지 남은 XP */
  remaining: number;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp);
  const level = getLevel(xp);
  const start = cumulativeFor(level);
  const end = cumulativeFor(level + 1);
  const needed = Math.max(1, end - start);
  const intoLevel = xp - start;
  return {
    level,
    intoLevel,
    needed,
    ratio: Math.min(1, intoLevel / needed),
    remaining: Math.max(0, end - xp),
  };
}
