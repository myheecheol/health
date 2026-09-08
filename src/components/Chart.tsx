import { useId, useState } from 'react';

/**
 * 작은 SVG 차트 모음. 차트 라이브러리를 쓰지 않습니다.
 *
 * 공통 규칙
 *  - 막대는 최대 24px, 데이터 끝만 4px 둥글게, 바닥은 각지게
 *  - 선은 2px, 격자는 1px 실선 (점선은 쓰지 않음 — 다른 뜻으로 읽힙니다)
 *  - 맞닿은 막대는 테두리가 아니라 2px 배경색 틈으로 구분
 *  - 글자에는 계열 색을 쓰지 않음. 색은 마크가, 이름은 글자가 담당
 *  - 값은 툴팁에만 있지 않도록 '표' 보기를 함께 제공
 */

const PAD = { top: 14, right: 10, bottom: 26, left: 34 };
const GAP = 2; // 마크 사이 배경색 틈

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

function fmt(n: number): string {
  return n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString('ko-KR');
}

// ── 차트 껍데기 ────────────────────────────────
export function ChartCard({
  title, subtitle, legend, table, children, empty,
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  table: React.ReactNode;
  children: React.ReactNode;
  empty?: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div className="chart-title">{title}</div>
          {subtitle && <div className="chart-sub">{subtitle}</div>}
        </div>
        {!empty && (
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
          >
            {showTable ? '그래프' : '표'}
          </button>
        )}
      </div>

      {legend && legend.length > 1 && (
        <div className="chart-legend">
          {legend.map((l) => (
            <span key={l.label}>
              <i className="chart-swatch" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {empty ? (
        <div className="chart-empty">기록이 쌓이면 여기에 그래프가 나옵니다.</div>
      ) : showTable ? (
        <div className="table-scroll">{table}</div>
      ) : (
        children
      )}
    </div>
  );
}

// ── 누적 막대 (근력 + 러닝) ────────────────────
export interface StackedPoint {
  label: string;
  a: number;
  b: number;
}

export function StackedColumns({
  data, colorA, colorB, nameA, nameB, unit = '회', height = 150,
}: {
  data: StackedPoint[];
  colorA: string; colorB: string;
  nameA: string; nameB: string;
  unit?: string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const W = 320;
  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(1, ...data.map((d) => d.a + d.b)));
  const band = plotW / data.length;
  const barW = Math.min(24, band - 6);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
           aria-label={`${nameA}와 ${nameB}의 기간별 ${unit} 수`}>
        {/* 격자 — 실선 hairline */}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * t)} y2={y(max * t)}
                  stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(max * t) + 3} textAnchor="end"
                  className="chart-tick">{fmt(Math.round(max * t))}</text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const x = cx - barW / 2;
          const aH = (d.a / max) * plotH;
          const bH = (d.b / max) * plotH;
          const total = d.a + d.b;
          return (
            <g key={i}
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
               onFocus={() => setHover(i)} onBlur={() => setHover(null)}
               tabIndex={0} className="chart-hit"
               aria-label={`${d.label} ${nameA} ${d.a}${unit}, ${nameB} ${d.b}${unit}`}>
              {/* 손가락으로 짚기 쉽게 밴드 전체를 히트 영역으로 */}
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH}
                    fill={hover === i ? 'rgba(255,255,255,.05)' : 'transparent'} />
              {d.a > 0 && (
                <rect x={x} y={y(d.a)} width={barW} height={Math.max(1, aH - (d.b > 0 ? GAP : 0))}
                      rx={d.b > 0 ? 0 : 4} fill={colorA} />
              )}
              {d.b > 0 && (
                <rect x={x} y={y(total)} width={barW} height={Math.max(1, bH)} rx={4} fill={colorB} />
              )}
              {/* 축 라벨은 촘촘하면 겹치므로 건너뛰며 표시 */}
              {(i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) && (
                <text x={cx} y={H - 8} textAnchor="middle" className="chart-tick">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <div className="chart-tip" key={`${id}-${hover}`}>
          <b>{data[hover]!.label}</b>
          <span><i className="chart-swatch" style={{ background: colorA }} />{nameA} {data[hover]!.a}{unit}</span>
          <span><i className="chart-swatch" style={{ background: colorB }} />{nameB} {data[hover]!.b}{unit}</span>
        </div>
      )}
    </div>
  );
}

// ── 선 그래프 (단일 계열) ──────────────────────
export function LineChart({
  data, color, unit, height = 150,
}: {
  data: { label: string; value: number; sub?: string }[];
  color: string; unit: string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const px = (i: number) => PAD.left + (data.length > 1 ? stepX * i : plotW / 2);
  const py = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.value)}`).join(' ');
  const area = `${path} L ${px(data.length - 1)} ${PAD.top + plotH} L ${px(0)} ${PAD.top + plotH} Z`;
  const last = data.length - 1;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
           aria-label={`기간별 ${unit} 추이`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={py(max * t)} y2={py(max * t)}
                  stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={PAD.left - 6} y={py(max * t) + 3} textAnchor="end"
                  className="chart-tick">{fmt(Math.round(max * t))}</text>
          </g>
        ))}

        {data.length > 1 && <path d={area} fill={color} opacity="0.1" />}
        <path d={path} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}
             onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
             onFocus={() => setHover(i)} onBlur={() => setHover(null)}
             tabIndex={0} className="chart-hit"
             aria-label={`${d.label} ${d.value.toLocaleString('ko-KR')}${unit}`}>
            <rect x={px(i) - 14} y={PAD.top} width={28} height={plotH} fill="transparent" />
            {(hover === i || i === last) && (
              // 겹쳐도 보이도록 배경색 링을 두릅니다
              <circle cx={px(i)} cy={py(d.value)} r="4.5" fill={color}
                      stroke="var(--chart-surface)" strokeWidth="2" />
            )}
          </g>
        ))}

        {/* 마지막 값만 직접 표시 — 모든 점에 숫자를 붙이면 읽히지 않습니다 */}
        {data[last] && (
          <text x={px(last)} y={py(data[last]!.value) - 10} textAnchor="end" className="chart-endlabel">
            {fmt(data[last]!.value)}
          </text>
        )}

        {data.map((d, i) =>
          i % Math.ceil(data.length / 5) === 0 || i === last ? (
            <text key={`t${i}`} x={px(i)} y={H - 8} textAnchor="middle" className="chart-tick">{d.label}</text>
          ) : null,
        )}
      </svg>

      {hover !== null && data[hover] && (
        <div className="chart-tip">
          <b>{data[hover]!.label}</b>
          <span>{data[hover]!.value.toLocaleString('ko-KR')}{unit}</span>
          {data[hover]!.sub && <span className="chart-tip__sub">{data[hover]!.sub}</span>}
        </div>
      )}
    </div>
  );
}

// ── 가로 막대 목록 (단일 계열) ─────────────────
export function BarList({
  data, color, unit,
}: {
  data: { name: string; value: number; sub?: string }[];
  color: string; unit: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="barlist">
      {data.map((d) => (
        <div key={d.name} className="barlist__row">
          <span className="barlist__name">{d.name}</span>
          <span className="barlist__track">
            <span className="barlist__fill"
                  style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="barlist__value">
            {d.value}{unit}
            {d.sub && <span className="barlist__sub"> {d.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
