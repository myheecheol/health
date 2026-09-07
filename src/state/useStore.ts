import { useSyncExternalStore } from 'react';
import { getState, subscribe } from './store';
import type { AppState } from '../data/types';

/** 스토어 전체 구독. 상태 객체는 불변이므로 참조 비교로 충분합니다. */
export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}
