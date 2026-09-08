import { useState } from 'react';
import type { Condition } from '../data/types';

const MOODS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: '매우 안좋음' },
  { value: 2, emoji: '😕', label: '안좋음' },
  { value: 3, emoji: '😐', label: '보통' },
  { value: 4, emoji: '🙂', label: '좋음' },
  { value: 5, emoji: '🔥', label: '매우 좋음' },
];

/** 컨디션은 전부 선택 입력입니다. 건너뛰어도 운동을 시작할 수 있어야 합니다. */
export function ConditionPicker({
  value,
  onChange,
}: {
  value: Condition | null;
  onChange: (c: Condition | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <div className="row">
        <div className="card__label" style={{ margin: 0 }}>오늘 컨디션 (선택)</div>
        {value && (
          <button className="btn btn--sm btn--ghost" onClick={() => onChange(null)}>
            지우기
          </button>
        )}
      </div>
      <div className="chip-row" style={{ marginTop: 10 }}>
        {MOODS.map((m) => (
          <button
            key={m.value}
            className="chip"
            aria-pressed={value?.mood === m.value}
            onClick={() =>
              onChange(value?.mood === m.value ? null : { ...(value ?? {}), mood: m.value })
            }
            title={m.label}
          >
            <span style={{ fontSize: 18 }}>{m.emoji}</span>
          </button>
        ))}
      </div>

      {!open ? (
        <button
          className="btn btn--sm btn--ghost"
          style={{ marginTop: 10 }}
          onClick={() => setOpen(true)}
        >
          + 수면 · 체중 기록
        </button>
      ) : (
        <div className="set-inputs" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="field__label">수면 (시간)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="6.5"
              value={value?.sleepHours ?? ''}
              onChange={(e) => {
                const n = e.target.value === '' ? undefined : Number(e.target.value);
                onChange({ mood: value?.mood ?? 3, ...value, sleepHours: Number.isFinite(n!) ? n : undefined });
              }}
            />
          </label>
          <label className="field">
            <span className="field__label">체중 (kg)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="72.4"
              value={value?.bodyWeightKg ?? ''}
              onChange={(e) => {
                const n = e.target.value === '' ? undefined : Number(e.target.value);
                onChange({ mood: value?.mood ?? 3, ...value, bodyWeightKg: Number.isFinite(n!) ? n : undefined });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
