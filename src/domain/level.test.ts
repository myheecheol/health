import { describe, expect, it } from 'vitest';
import { getLevel, getLevelProgress } from './level';

// 곡선: Lv.1→2 에 600, 이후 레벨마다 300씩 더 필요
describe('레벨 계산', () => {
  it('처음엔 Lv.1이다', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(599)).toBe(1);
  });

  it('600 XP에서 Lv.2가 된다 (운동 약 2번)', () => {
    expect(getLevel(600)).toBe(2);
  });

  it('레벨이 오를수록 더 많은 XP가 필요하다', () => {
    expect(getLevel(1499)).toBe(2);   // 600 + 900 = 1500 에서 Lv.3
    expect(getLevel(1500)).toBe(3);
    expect(getLevel(2700)).toBe(4);   // +1200
  });

  it('음수 XP도 Lv.1로 처리한다', () => {
    expect(getLevel(-100)).toBe(1);
  });

  it('진행률을 현재 레벨 구간 기준으로 계산한다', () => {
    const p = getLevelProgress(900);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(300);    // 900 - 600
    expect(p.needed).toBe(900);       // Lv.2→3 에 필요한 양
    expect(p.remaining).toBe(600);
  });

  it('레벨 경계에서 진행률이 0이다', () => {
    const p = getLevelProgress(600);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(0);
    expect(p.ratio).toBe(0);
  });

  it('Lv.10까지 누적 16,200 XP (운동 약 48번)', () => {
    expect(getLevel(16_199)).toBe(9);
    expect(getLevel(16_200)).toBe(10);
  });
});
