import { useState, useEffect } from 'react';

const StatsCard = ({ icon, iconBg, value, label }) => {
  const [count, setCount] = useState(0);
  const numVal = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, '')) : value;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isNaN(numVal)) { setCount(value); return; }
    let start = 0;
    const duration = 1200;
    const increment = numVal / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= numVal) { setCount(numVal); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [numVal, value]);

  const display = typeof value === 'string' && value.includes('%')
    ? `${count}%`
    : typeof value === 'string' && value.includes(',')
      ? count.toLocaleString()
      : typeof value === 'string' && value.includes('$')
        ? `$${count.toLocaleString()}`
        : count;

  return (
    <div className="dash-stat">
      <div className="dash-stat-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div>
        <div className="dash-stat-value">{display}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  );
};

export default StatsCard;
