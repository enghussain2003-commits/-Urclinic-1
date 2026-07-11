import { useEffect, useState } from 'react';

/**
 * SvgDonutChart — animated donut (ring) chart with legend.
 *
 * Props:
 *   segments  [{label, value, color}]  — data slices
 *   size      number                   — SVG canvas size in px
 */

const SvgDonutChart = ({ segments = [], size = 160 }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.36;  // outer ring radius
  const SW = size * 0.13;  // stroke width (ring thickness)

  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;

  const arcs = segments
    .filter(s => (s.value || 0) > 0)
    .reduce((acc, seg) => {
      const startAngle = acc.length ? acc[acc.length - 1].endAngle : -90;
      const pct   = seg.value / total;
      const sweep = pct * 360;
      acc.push({ ...seg, pct: Math.round(pct * 100), startAngle, endAngle: startAngle + sweep });
      return acc;
    }, []);

  // Circumference of the ring (for stroke-dasharray animation)
  const circ = 2 * Math.PI * R;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      {/* Donut SVG */}
      <div style={{ flexShrink: 0 }}>
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-label="Donut chart"
        >
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth={SW}
          />

          {/* Segments */}
          {arcs.map((arc, i) => {
            const sweep  = ((arc.endAngle - arc.startAngle) / 360) * circ;
            const dashArray = `${animated ? sweep : 0} ${circ}`;
            // rotate so each arc starts from its computed position
            const rotation = arc.startAngle + 90;

            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={SW - 1}
                strokeLinecap="round"
                strokeDasharray={dashArray}
                strokeDashoffset={0}
                transform={`rotate(${rotation} ${cx} ${cy})`}
                style={{ transition: `stroke-dasharray ${0.5 + i * 0.1}s ease` }}
              >
                <title>{arc.label}: {arc.value} ({arc.pct}%)</title>
              </circle>
            );
          })}

          {/* Center total */}
          <text
            x={cx} y={cy - 6}
            textAnchor="middle"
            fontSize={size * 0.13}
            fontWeight="800"
            fill="var(--text)"
          >
            {total}
          </text>
          <text
            x={cx} y={cy + size * 0.09}
            textAnchor="middle"
            fontSize={size * 0.07}
            fill="var(--text-muted)"
          >
            Total
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
        {arcs.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: seg.color, flexShrink: 0,
            }} />
            <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{
              fontWeight: 700, color: 'var(--text)',
              marginLeft: 'auto', paddingLeft: '0.75rem', whiteSpace: 'nowrap',
            }}>
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SvgDonutChart;
