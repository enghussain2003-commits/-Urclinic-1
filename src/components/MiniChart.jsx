import React from 'react';

// Simple SVG bar chart
export const BarChart = ({ data, width = 400, height = 200 }) => {
  const maxVal = Math.max(...data.map(d => d.value));
  const barWidth = (width - 60) / data.length - 8;
  const chartH = height - 40;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * chartH;
        const x = 40 + i * ((width - 60) / data.length) + 4;
        const y = chartH - barH + 10;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#0d9488" />
              </linearGradient>
            </defs>
            <rect x={x} y={y} width={barWidth} height={barH} rx={4} fill={`url(#bar-grad-${i})`} opacity={0.85}>
              <animate attributeName="height" from="0" to={barH} dur="0.8s" fill="freeze" />
              <animate attributeName="y" from={chartH + 10} to={y} dur="0.8s" fill="freeze" />
            </rect>
            <text x={x + barWidth / 2} y={height - 5} textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="500">{d.day || d.hour}</text>
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">${d.value}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Simple SVG line chart
export const LineChart = ({ data, width = 400, height = 200, color = '#0d9488' }) => {
  const maxVal = Math.max(...data.map(d => d.value));
  const chartH = height - 40;
  const chartW = width - 60;
  const step = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: 40 + i * step,
    y: 10 + chartH - (d.value / maxVal) * chartH
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1].x} ${chartH + 10} L ${points[0].x} ${chartH + 10} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#area-fill)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={p.x} y={height - 5} textAnchor="middle" fontSize="11" fill="#94a3b8">{data[i].day || data[i].hour}</text>
        </g>
      ))}
    </svg>
  );
};

export default { BarChart, LineChart };
