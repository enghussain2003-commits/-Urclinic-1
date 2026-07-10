import { useState } from 'react';

/**
 * SvgBarChart — animated vertical bar chart.
 *
 * Props:
 *   data    [{label, value}]  — bars to render
 *   color   string            — bar fill color (default: primary teal)
 *   height  number            — viewBox height
 */

const PAD = { t: 20, r: 12, b: 36, l: 36 };

const SvgBarChart = ({
  data = [],
  color = '#0d9488',
  height = 200,
}) => {
  const W  = 500;
  const H  = height;
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const maxVal = Math.max(...data.map(d => d.value || 0), 1);
  const n = data.length || 1;

  // Each bar slot width; bar occupies 60% of slot
  const slotW = iW / n;
  const barW  = Math.max(slotW * 0.55, 8);
  const gap   = (slotW - barW) / 2;

  const toX   = i  => PAD.l + i * slotW + gap;
  const barH  = v  => Math.max((v / maxVal) * iH, v > 0 ? 2 : 0);
  const barY  = v  => PAD.t + iH - barH(v);

  const [hovered, setHovered] = useState(null);

  if (data.length === 0) {
    return <div className="chart-empty-inner"><span>—</span></div>;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ overflow: 'visible', display: 'block' }}
      aria-label="Bar chart"
    >
      {/* Baseline */}
      <line
        x1={PAD.l} y1={PAD.t + iH}
        x2={W - PAD.r} y2={PAD.t + iH}
        stroke="var(--border)" strokeWidth="1.5"
      />

      {/* Bars */}
      {data.map((d, i) => {
        const bH  = barH(d.value || 0);
        const bY  = barY(d.value || 0);
        const bX  = toX(i);
        const mid = bX + barW / 2;
        const isHov = hovered === i;

        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Bar */}
            <rect
              x={bX} y={bY}
              width={barW} height={bH}
              rx="5" ry="5"
              fill={color}
              opacity={isHov ? 1 : 0.78}
              style={{ transition: 'opacity 0.15s' }}
            >
              <title>{d.label}: {d.value}</title>
            </rect>

            {/* Hover highlight top */}
            {isHov && bH > 0 && (
              <rect
                x={bX} y={bY} width={barW} height={Math.min(6, bH)}
                rx="5" ry="5"
                fill="#fff" opacity="0.25"
              />
            )}

            {/* Value label above bar */}
            {(d.value || 0) > 0 && (
              <text
                x={mid} y={bY - 5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={isHov ? color : 'var(--text-secondary)'}
                style={{ transition: 'fill 0.15s' }}
              >
                {d.value}
              </text>
            )}

            {/* X-axis label */}
            <text
              x={mid} y={H - 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-muted)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default SvgBarChart;
