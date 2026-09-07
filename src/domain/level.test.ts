import { describe, expect, it } from 'vitest';
import { getLevel, getLevelProgress } from './level';

describe('레벨 계산 (500XP 균등 구간)', () => {
  it('0~499 XP는 Lv.1', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(499)).toBe(1);
  });
  it('500~999 XP는 Lv.2', () => {
    expect(getLevel(500)).toBe(2);
    expect(getLevel(999)).toBe(2);
  });
  it('1000 XP는 Lv.3', () => {
    expect(getLevel(1000)).toBe(3);
  });
  it('음수 XP도 Lv.1로 처리한다', () => {
    expect(getLevel(-100)).toBe(1);
  });
  it('진행률을 구간 기준으로 계산한다', () => {
    expect(getLevelProgress(820)).toEqual({ level: 2, intoLevel: 320, needed: 500, ratio: 0.64 });
  });
});
