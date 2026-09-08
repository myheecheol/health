import type { Reward } from '../data/types';

/**
 * 기본 보상 목록 (요구사항 13절).
 * 사용자가 앱 안에서 추가·수정·삭제할 수 있고, 이 배열은 처음 한 번만 씁니다.
 *
 * 가격은 "운동 2~3번이면 약속 한 번"이 되도록 잡았습니다.
 *   근력 1회 ≈ 170P · 러닝 6.8km ≈ 102P
 */
export const DEFAULT_REWARDS: Omit<Reward, 'id'>[] = [
  { name: '일반식',    emoji: '🍕', description: '먹고 싶은 거 한 끼',   cost: 100, category: '음식',   active: true },
  { name: '영화',      emoji: '🎬', description: '보고 싶던 영화 한 편', cost: 200, category: '여가',   active: true },
  { name: '약속가기',  emoji: '🍺', description: '약속 한 번',           cost: 300, category: '사교',   active: true },
  { name: '늦잠 쿠폰', emoji: '🛌', description: '알람 없는 하루',       cost: 300, category: '휴식',   active: true },
  { name: '놀러가기',  emoji: '🎮', description: '하루 제대로 놀기',     cost: 500, category: '여가',   active: true },
];
