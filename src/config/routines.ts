import type { Exercise, MuscleGroup, StrengthType, WorkoutRoutine } from '../data/types';

/**
 * A/B 루틴과 종목 정의 (요구사항 4절).
 * 종목을 추가/삭제하려면 이 배열만 고치면 됩니다.
 * id는 기록과 영구적으로 연결되므로 한번 정하면 바꾸지 않습니다.
 */

type ExerciseSeed = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  targetReps: number;
  defaultSets: number;
  /** 점진적 과부하 추천 시 올릴 중량 단위 (요구사항 35절) */
  weightIncrement: number;
};

const A_EXERCISES: ExerciseSeed[] = [
  { id: 'lat-pulldown',   name: '랫풀다운',        muscleGroup: 'BACK',  targetReps: 15, defaultSets: 5, weightIncrement: 2.5 },
  { id: 'seated-row',     name: '시티드 로우',      muscleGroup: 'BACK',  targetReps: 15, defaultSets: 4, weightIncrement: 2.5 },
  { id: 'chest-press',    name: '체스트 프레스',    muscleGroup: 'CHEST', targetReps: 12, defaultSets: 5, weightIncrement: 2.5 },
  { id: 'pec-deck',       name: '펙덱',            muscleGroup: 'CHEST', targetReps: 15, defaultSets: 4, weightIncrement: 2.5 },
  { id: 'ez-bar-curl',    name: '이지바컬',         muscleGroup: 'ARM',   targetReps: 12, defaultSets: 4, weightIncrement: 2.5 },
  { id: 'cable-pushdown', name: '케이블 푸쉬다운',   muscleGroup: 'ARM',   targetReps: 12, defaultSets: 4, weightIncrement: 2.5 },
];

const B_EXERCISES: ExerciseSeed[] = [
  { id: 'shoulder-press',  name: '숄더프레스',           muscleGroup: 'SHOULDER', targetReps: 15, defaultSets: 4, weightIncrement: 2.5 },
  { id: 'lateral-raise',   name: '사이드레터럴레이즈',     muscleGroup: 'SHOULDER', targetReps: 20, defaultSets: 4, weightIncrement: 1.25 },
  { id: 'leg-press',       name: '레그프레스',           muscleGroup: 'LEG',      targetReps: 15, defaultSets: 4, weightIncrement: 5 },
  { id: 'leg-extension',   name: '레그익스텐션',          muscleGroup: 'LEG',      targetReps: 15, defaultSets: 4, weightIncrement: 5 },
  { id: 'leg-curl',        name: '레그컬',               muscleGroup: 'LEG',      targetReps: 15, defaultSets: 4, weightIncrement: 5 },
  { id: 'crunch',          name: '크런치',               muscleGroup: 'ABS',      targetReps: 20, defaultSets: 5, weightIncrement: 2.5 },
];

function build(routineId: string, type: StrengthType, seeds: ExerciseSeed[]): Exercise[] {
  return seeds.map((s, i) => ({ ...s, routineId, routineType: type, order: i }));
}

export const ROUTINES: WorkoutRoutine[] = [
  { id: 'routine-a', name: 'A 루틴', type: 'STRENGTH_A', order: 0, summary: '등 + 가슴 + 팔' },
  { id: 'routine-b', name: 'B 루틴', type: 'STRENGTH_B', order: 1, summary: '어깨 + 하체 + 복근' },
];

export const EXERCISES: Exercise[] = [
  ...build('routine-a', 'STRENGTH_A', A_EXERCISES),
  ...build('routine-b', 'STRENGTH_B', B_EXERCISES),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function getExercisesFor(type: StrengthType): Exercise[] {
  return EXERCISES.filter((e) => e.routineType === type).sort((a, b) => a.order - b.order);
}

export function getRoutine(type: StrengthType): WorkoutRoutine {
  const r = ROUTINES.find((x) => x.type === type);
  if (!r) throw new Error(`unknown routine type: ${type}`);
  return r;
}

/** 루틴의 총 세트 수 (프리뷰 화면용) */
export function totalSetsFor(type: StrengthType): number {
  return getExercisesFor(type).reduce((sum, e) => sum + e.defaultSets, 0);
}

/** 예상 소요 시간 (분). 세트당 준비+수행+휴식을 대략 90~140초로 잡습니다. */
export function estimatedMinutes(type: StrengthType): [number, number] {
  const sets = totalSetsFor(type);
  return [Math.round((sets * 90) / 60), Math.round((sets * 140) / 60)];
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  BACK: '등',
  CHEST: '가슴',
  ARM: '팔',
  SHOULDER: '어깨',
  LEG: '하체',
  ABS: '복근',
  CARDIO: '유산소',
};
