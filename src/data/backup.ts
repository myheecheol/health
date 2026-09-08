import { getState, replaceAll } from '../state/store';
import type { ExerciseStats, Reward, RewardHistoryEntry, User, WorkoutSession } from './types';
import { SCHEMA_VERSION } from './localStore';

export interface BackupFile {
  app: 'fitness-rpg';
  schemaVersion: number;
  exportedAt: string;
  user: User;
  sessions: WorkoutSession[];
  exerciseStats: Record<string, ExerciseStats>;
  rewards: Reward[];
  rewardHistory: RewardHistoryEntry[];
  achievements: Record<string, number>;
}

export function buildBackup(): BackupFile {
  const s = getState();
  return {
    app: 'fitness-rpg',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    user: s.user,
    sessions: s.sessions,
    exerciseStats: s.exerciseStats,
    rewards: s.rewards,
    rewardHistory: s.rewardHistory,
    achievements: s.achievements,
  };
}

/** 백업 파일을 내려받습니다. 클라우드와 별개로 사용자가 직접 쥐고 있을 사본입니다. */
export function downloadBackup(): void {
  const data = buildBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fitness-rpg-backup-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type RestoreResult = { ok: true; sessions: number } | { ok: false; error: string };

/**
 * 백업 복원.
 * 기존 기록을 지우지 않고 세션 id 기준으로 합칩니다 — 잘못 복원해도 데이터가 줄지 않습니다.
 */
export function restoreBackup(raw: string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: '백업 파일을 읽을 수 없습니다 (JSON 형식이 아님)' };
  }

  const file = parsed as Partial<BackupFile>;
  if (file.app !== 'fitness-rpg' || !Array.isArray(file.sessions) || !file.user) {
    return { ok: false, error: 'Fitness RPG 백업 파일이 아닙니다' };
  }

  const current = getState();
  const merged = new Map<string, WorkoutSession>();
  for (const s of current.sessions) merged.set(s.id, s);
  for (const s of file.sessions) {
    const existing = merged.get(s.id);
    // 같은 id면 더 최근에 수정된 쪽을 남깁니다.
    if (!existing || (s.updatedAt ?? 0) > (existing.updatedAt ?? 0)) merged.set(s.id, s);
  }

  const sessions = [...merged.values()].sort((a, b) => a.startTime - b.startTime);

  // 보상 사용 내역도 id 기준으로 합칩니다 — 중복 차감이 생기지 않도록.
  const historyById = new Map(current.rewardHistory.map((h) => [h.id, h]));
  for (const h of file.rewardHistory ?? []) historyById.set(h.id, h);

  replaceAll({
    user: { ...current.user, ...file.user, id: current.user.id },
    sessions,
    exerciseStats: { ...current.exerciseStats, ...(file.exerciseStats ?? {}) },
    rewards: file.rewards?.length ? file.rewards : current.rewards,
    rewardHistory: [...historyById.values()].sort((a, b) => a.usedAt - b.usedAt),
    achievements: { ...current.achievements, ...(file.achievements ?? {}) },
  });

  return { ok: true, sessions: sessions.length };
}
