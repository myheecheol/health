import { ACHIEVEMENTS, type AchievementContext, type AchievementDef } from '../config/achievements';

/** 해금 시각을 id별로 보관합니다. 아직 못 얻었으면 키가 없습니다. */
export type UnlockedMap = Record<string, number>;

export interface AchievementView extends AchievementDef {
  unlockedAt: number | null;
  current: number;
  target: number;
}

/**
 * 조건을 다시 평가해 새로 해금된 업적을 찾습니다.
 * 이미 얻은 업적은 조건이 나중에 거짓이 되어도 회수하지 않습니다.
 */
export function evaluateAchievements(
  unlocked: UnlockedMap,
  ctx: AchievementContext,
  now = Date.now(),
): { unlocked: UnlockedMap; newlyUnlocked: AchievementDef[] } {
  const next: UnlockedMap = { ...unlocked };
  const newly: AchievementDef[] = [];

  for (const def of ACHIEVEMENTS) {
    if (next[def.id]) continue;
    if (def.check(ctx)) {
      next[def.id] = now;
      newly.push(def);
    }
  }
  return { unlocked: next, newlyUnlocked: newly };
}

/** 업적 화면용 — 해금 여부와 진행률을 붙인 전체 목록 */
export function listAchievements(unlocked: UnlockedMap, ctx: AchievementContext): AchievementView[] {
  return ACHIEVEMENTS.map((def) => {
    const [current, target] = def.progress?.(ctx) ?? [0, 1];
    return { ...def, unlockedAt: unlocked[def.id] ?? null, current, target };
  }).sort((a, b) => {
    // 얻은 것 먼저, 그다음 진행률이 높은 순
    if (!!a.unlockedAt !== !!b.unlockedAt) return a.unlockedAt ? -1 : 1;
    return b.current / b.target - a.current / a.target;
  });
}
