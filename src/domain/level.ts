import { LEVEL_CURVE } from '../config/gameConfig';

/**
 * 레벨 곡선을 아는 유일한 곳입니다.
 * 나중에 구간별 곡선으로 바꿔도 이 두 함수만 고치면 됩니다.
 */
export function getLevel(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  if (LEVEL_CURVE.kind === 'flat') return Math.floor(xp / LEVEL_CURVE.xpPerLevel) + 1;

  let level = 1;
  for (const threshold of LEVEL_CURVE.thresholds) {
    if (xp >= threshold) level = LEVEL_CURVE.thresholds.indexOf(threshold) + 1;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  intoLevel: number;
  needed: number;
  ratio: number;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp);
  const level = getLevel(xp);

  if (LEVEL_CURVE.kind === 'flat') {
    const needed = LEVEL_CURVE.xpPerLevel;
    const intoLevel = xp % needed;
    return { level, intoLevel, needed, ratio: intoLevel / needed };
  }

  const start = LEVEL_CURVE.thresholds[level - 1] ?? 0;
  const end = LEVEL_CURVE.thresholds[level] ?? start + 500;
  const needed = Math.max(1, end - start);
  const intoLevel = xp - start;
  return { level, intoLevel, needed, ratio: Math.min(1, intoLevel / needed) };
}
