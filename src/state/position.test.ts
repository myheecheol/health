import { describe, expect, it } from 'vitest';
import { getExercisesFor } from '../config/routines';
import { currentStrengthPosition, nextUnfinishedAfter, strengthProgress } from './store';
import type { ActiveSession, SetRecord } from '../data/types';

const A = getExercisesFor('STRENGTH_A'); // 랫풀다운5, 시티드로우4, 체스트프레스5, 펙덱4, 이지바컬4, 케이블푸쉬다운4

/** 종목별로 원하는 만큼 세트를 채운 진행 중 세션 */
function session(doneBy: Record<string, number> = {}): ActiveSession {
  const sets: SetRecord[] = [];
  for (const [exerciseId, count] of Object.entries(doneBy)) {
    for (let i = 1; i <= count; i++) {
      sets.push({
        id: `${exerciseId}-${i}`, sessionId: 's', exerciseId, setNumber: i,
        weight: 40, reps: 15, completed: true, createdAt: i,
      });
    }
  }
  return {
    id: 's', date: '2026-09-10', workoutType: 'STRENGTH_A', startTime: 0, endTime: null,
    duration: 0, notes: '', condition: null, completed: false,
    xpEarned: 0, pointsEarned: 0, deletedAt: null, updatedAt: 0, sets,
  };
}

describe('종목 자유 이동', () => {
  it('아무것도 고르지 않으면 순서상 첫 미완료 종목을 보여준다', () => {
    const p = currentStrengthPosition(session());
    expect(p?.exercise?.id).toBe('lat-pulldown');
    expect(p?.setNumber).toBe(1);
  });

  it('고른 종목이 있으면 순서를 무시하고 그 종목을 보여준다', () => {
    // 랫풀다운을 한 세트도 안 했지만 시티드 로우로 바로 갈 수 있어야 합니다
    const p = currentStrengthPosition(session(), 'seated-row');
    expect(p?.exercise?.id).toBe('seated-row');
    expect(p?.setNumber).toBe(1);
  });

  it('고른 종목의 다음 세트 번호를 이어서 준다', () => {
    const p = currentStrengthPosition(session({ 'seated-row': 2 }), 'seated-row');
    expect(p?.setNumber).toBe(3);
    expect(p?.doneSets).toBe(2);
  });

  it('뒤쪽 종목을 먼저 해도 앞 종목 기록이 남는다', () => {
    const s = session({ 'crunch': 0, 'cable-pushdown': 4, 'lat-pulldown': 2 });
    const p = strengthProgress(s)!;
    expect(p.counts.get('lat-pulldown')).toBe(2);
    expect(p.counts.get('cable-pushdown')).toBe(4);
  });

  it('이 루틴에 없는 종목을 고르면 무시하고 순서대로 돌아간다', () => {
    const p = currentStrengthPosition(session(), 'leg-press'); // B 루틴 종목
    expect(p?.exercise?.id).toBe('lat-pulldown');
  });

  it('정해진 세트를 다 채운 종목도 고를 수 있다 (추가 세트)', () => {
    const p = currentStrengthPosition(session({ 'seated-row': 4 }), 'seated-row');
    expect(p?.exercise?.id).toBe('seated-row');
    expect(p?.setNumber).toBe(5); // 4세트짜리인데 5세트째
  });

  it('전부 채우고 고른 것도 없으면 마무리 상태가 된다', () => {
    const all = Object.fromEntries(A.map((e) => [e.id, e.defaultSets]));
    expect(currentStrengthPosition(session(all))?.exercise).toBeNull();
    expect(strengthProgress(session(all))?.allDone).toBe(true);
  });
});

describe('종목을 마쳤을 때 다음으로 갈 곳', () => {
  it('바로 뒤 미완료 종목으로 간다', () => {
    expect(nextUnfinishedAfter(session({ 'lat-pulldown': 5 }), 'lat-pulldown')).toBe('seated-row');
  });

  it('뒤쪽이 이미 끝났으면 그다음을 찾는다', () => {
    const s = session({ 'lat-pulldown': 5, 'seated-row': 4 });
    expect(nextUnfinishedAfter(s, 'lat-pulldown')).toBe('chest-press');
  });

  it('마지막 종목을 마치면 앞쪽 미완료로 돌아간다', () => {
    const s = session({ 'cable-pushdown': 4 });
    expect(nextUnfinishedAfter(s, 'cable-pushdown')).toBe('lat-pulldown');
  });

  it('건너뛴 종목으로 되돌아가 붙잡지 않는다', () => {
    // 랫풀다운을 건너뛰고 시티드 로우부터 시작해 끝낸 상황
    const s = session({ 'seated-row': 4 });
    expect(nextUnfinishedAfter(s, 'seated-row')).toBe('chest-press');
  });

  it('전부 끝났으면 갈 곳이 없다', () => {
    const all = Object.fromEntries(A.map((e) => [e.id, e.defaultSets]));
    expect(nextUnfinishedAfter(session(all), 'lat-pulldown')).toBeNull();
  });
});
