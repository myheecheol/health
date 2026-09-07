import { describe, expect, it } from 'vitest';
import { validateDistanceKm, validateReps, validateWeight } from './validate';

describe('validateDistanceKm — 요구사항 40절 러닝 거리 예외 처리', () => {
  it('빈 값을 거부한다', () => {
    expect(validateDistanceKm('')).toEqual({ ok: false, error: '달린 거리를 입력해주세요' });
    expect(validateDistanceKm('   ')).toMatchObject({ ok: false });
  });

  it('0km를 거부한다', () => {
    expect(validateDistanceKm('0')).toMatchObject({ ok: false });
    expect(validateDistanceKm(0)).toMatchObject({ ok: false });
  });

  it('음수를 거부한다', () => {
    expect(validateDistanceKm('-3')).toMatchObject({ ok: false });
    expect(validateDistanceKm(-0.5)).toMatchObject({ ok: false });
  });

  it('문자를 거부한다', () => {
    expect(validateDistanceKm('abc')).toEqual({ ok: false, error: '숫자만 입력할 수 있어요' });
  });

  it('숫자와 문자가 섞인 값을 통과시키지 않는다 (parseFloat 함정)', () => {
    expect(validateDistanceKm('5abc')).toMatchObject({ ok: false });
    expect(validateDistanceKm('5km')).toMatchObject({ ok: false });
  });

  it('NaN / Infinity를 거부한다', () => {
    expect(validateDistanceKm(NaN)).toMatchObject({ ok: false });
    expect(validateDistanceKm(Infinity)).toMatchObject({ ok: false });
  });

  it('비정상적으로 큰 값을 거부한다', () => {
    expect(validateDistanceKm('501')).toMatchObject({ ok: false });
  });

  it('정수 거리를 통과시킨다', () => {
    expect(validateDistanceKm('5')).toEqual({ ok: true, value: 5 });
    expect(validateDistanceKm('10')).toEqual({ ok: true, value: 10 });
  });

  it('소수점 거리를 통과시킨다', () => {
    expect(validateDistanceKm('6.8')).toEqual({ ok: true, value: 6.8 });
    expect(validateDistanceKm('4.5')).toEqual({ ok: true, value: 4.5 });
    expect(validateDistanceKm('6.25')).toEqual({ ok: true, value: 6.25 });
    expect(validateDistanceKm('12.7')).toEqual({ ok: true, value: 12.7 });
  });

  it('최소값 0.1km를 통과시킨다', () => {
    expect(validateDistanceKm('0.1')).toEqual({ ok: true, value: 0.1 });
    expect(validateDistanceKm('0.09')).toMatchObject({ ok: false });
  });

  it('통과한 값은 항상 number 타입이다 (문자열 저장 방지)', () => {
    const r = validateDistanceKm('6.8');
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('number');
  });

  it('앞뒤 공백을 허용한다', () => {
    expect(validateDistanceKm(' 6.8 ')).toEqual({ ok: true, value: 6.8 });
  });
});

describe('validateWeight — 중량', () => {
  it('0kg을 허용한다 (맨몸 운동)', () => {
    expect(validateWeight('0')).toEqual({ ok: true, value: 0 });
  });
  it('음수를 거부한다', () => {
    expect(validateWeight('-5')).toMatchObject({ ok: false });
  });
  it('문자를 거부한다', () => {
    expect(validateWeight('무거움')).toMatchObject({ ok: false });
  });
  it('소수 중량(2.5kg 단위)을 허용한다', () => {
    expect(validateWeight('47.5')).toEqual({ ok: true, value: 47.5 });
  });
});

describe('validateReps — 반복수', () => {
  it('0회를 거부한다', () => {
    expect(validateReps('0')).toMatchObject({ ok: false });
  });
  it('소수를 거부한다', () => {
    expect(validateReps('12.5')).toMatchObject({ ok: false });
  });
  it('빈 값을 거부한다', () => {
    expect(validateReps('')).toMatchObject({ ok: false });
  });
  it('정상값을 통과시킨다', () => {
    expect(validateReps('15')).toEqual({ ok: true, value: 15 });
  });
});
