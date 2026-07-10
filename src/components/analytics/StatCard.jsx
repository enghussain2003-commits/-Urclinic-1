import { useState, useEffect } from 'react';

/**
 * StatCard — enhanced stats card with animated counter, accent border, and optional trend indicator.
 *
 * Props:
 *   icon       ReactNode  — Lucide icon (no background, just the SVG)
 *   iconBg     string     — background color for icon wrapper
 *   accent     string     — left-border accent color
 *   value      number     — numeric value to animate toward
 *   label      string     — card label text
 *   prefix     string     — displayed before value (e.g. '$')
 *   suffix     string     — displayed after value (e.g. '%')
 *   trend      'up'|'down'|null
 *   trendLabel string     — e.g. '+12% vs last month'
 */
const StatCard = ({
  icon, iconBg, accent, value = 0, label,
  prefix = '', suffix = '',
  trend, trendLabel,
}) => {
  const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, '')) || 0;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (num === 0) { setCount(0); return; }
    let current = 0;
    const duration = 900;
    const step = num / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= num) { setCount(num); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, 16);
    return () => clearInterval(timer);
  }, [num]);

  return (
    <div
      className="analytics-stat-card"
      style={accent ? { '--stat-accent': accent } : {}}
    >
      <div
        className="analytics-stat-icon"
        style={{
          background: iconBg || 'var(--primary-100)',
          color: accent || 'var(--primary)',
        }}
      >
        {icon}
      </div>
      <div className="analytics-stat-body">
        <div className="analytics-stat-value">
          {prefix}{count.toLocaleString()}{suffix}
        </div>
        <div className="analytics-stat-label">{label}</div>
        {trend && trendLabel && (
          <div className={`analytics-stat-trend ${trend === 'up' ? 'trend-up' : 'trend-down'}`}>
            {trend === 'up' ? '↑' : '↓'} {trendLabel}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
