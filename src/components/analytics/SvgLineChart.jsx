import { useRef, useState, useEffect } from 'react';

/**
 * SvgLineChart — smooth bezier line chart.
 *
 * Props:
 *   data      [{label, ...values}]  — x-axis points
 *   lines     [{key, label, color}] — one entry per line to draw
 *   height    number                — SVG viewbox height (default 200)
 *   formatY   (v) => string         — y-axis label formatter
 *
 * Single-line mode: pass data=[{label, value}] and omit `lines`.
 * Multi-line mode : pass data=[{label, rev:N, count:N}] and lines=[{key:'rev',...}, {key:'count',...}].
 */

const PAD = { t: 24, r: 16, b: 36, l: 52 };

// Smooth cubic bezier through points
const smoothPath = (pts) => {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i].x - pts[i - 1].x) * 0.4;
    const cp1x = pts[i - 1].x + dx;
    const cp1y = pts[i - 1].y;
    const cp2x = pts[i].x - dx;
    const cp2y = pts[i].y;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${pts[i].x} ${pts[i].y}`;
  }
  return d;
};

const SvgLineChart = ({
  data = [],
  lines = [],
  height = 200,
  formatY = v => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)),
}) => {
  const W = 600;
  const H = height;
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const isSingle = lines.length === 0;

  // Collect all values to find Y scale
  const allValues = isSingle
    ? data.map(d => d.value || 0)
    : data.flatMap(d => lines.map(l => Number(d[l.key]) || 0));

  const maxVal = Math.max(...allValues, 1);

  const toX = i => PAD.l + (data.length > 1 ? (i / (data.length - 1)) * iW : iW / 2);
  const toY = v => PAD.t + iH - (v / maxVal) * iH;

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.33, 0.66, 1].map(r => ({
    v: Math.round(r * maxVal),
    y: PAD.t + iH - r * iH,
  }));

  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t); }, []);

  const [tooltip, setTooltip] = useState(null);

  const renderLine = (key, color, gradFill, label) => {
    const pts = data.map((d, i) => ({
      x: toX(i),
      y: toY(isSingle ? (d.value || 0) : (Number(d[key]) || 0)),
    }));
    const linePath  = smoothPath(pts);
    const closePath = pts.length > 1
      ? `${linePath} L ${pts[pts.length - 1].x} ${PAD.t + iH} L ${pts[0].x} ${PAD.t + iH} Z`
      : '';
    const gid = `lg_${key}`;

    return (
      <g key={key}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Gradient fill area */}
        {gradFill && closePath && (
          <path d={closePath} fill={`url(#${gid})`} />
        )}

        {/* Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={ready ? 1 : 0}
            style={{ transition: 'opacity 0.6s ease' }}
          />
        )}

        {/* Data-point dots */}
        {pts.map((p, i) => {
          const val = isSingle ? (data[i]?.value || 0) : (Number(data[i]?.[key]) || 0);
          return (
            <circle
              key={i}
              cx={p.x} cy={p.y} r={4}
              fill={color}
              stroke="#fff" strokeWidth="2"
              style={{ cursor: 'pointer', opacity: ready ? 1 : 0, transition: 'opacity 0.6s ease 0.2s' }}
              onMouseEnter={() => setTooltip({ x: p.x, y: p.y, label: data[i]?.label, val, color, lineLabel: label })}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </g>
    );
  };

  if (data.length === 0) {
    return (
      <div className="chart-empty-inner">
        <span>—</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ overflow: 'visible', display: 'block' }}
        aria-label="Line chart"
      >
        {/* Grid lines + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y}
              stroke="var(--border)" strokeWidth="1"
              strokeDasharray={i === 0 ? '0' : '4 4'}
            />
            <text
              x={PAD.l - 6} y={t.y + 4}
              textAnchor="end" fontSize="10" fill="var(--text-muted)"
            >
              {formatY(t.v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={toX(i)} y={H - 4}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          >
            {d.label}
          </text>
        ))}

        {/* Lines */}
        {isSingle
          ? renderLine('value', '#0d9488', true, '')
          : lines.map((l, idx) =>
              renderLine(l.key, l.color || (idx === 0 ? '#0d9488' : '#6366f1'), idx === 0, l.label)
            )
        }
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          style={{
            position:   'absolute',
            left:       `${(tooltip.x / W) * 100}%`,
            top:        `${(tooltip.y / H) * 100}%`,
            transform:  'translate(-50%, calc(-100% - 10px))',
            background: 'var(--text)',
            color:      '#fff',
            padding:    '4px 10px',
            borderRadius: '6px',
            fontSize:   '12px',
            fontWeight: '600',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex:     20,
            boxShadow:  '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {tooltip.label}: {formatY(tooltip.val)}
          {tooltip.lineLabel ? ` (${tooltip.lineLabel})` : ''}
        </div>
      )}

      {/* Legend (multi-line only) */}
      {!isSingle && lines.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: 12, height: 3, borderRadius: 2, background: l.color || (i === 0 ? '#0d9488' : '#6366f1'), display: 'inline-block' }} />
              {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SvgLineChart;
