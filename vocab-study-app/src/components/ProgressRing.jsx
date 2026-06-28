import { clamp } from '../lib/math.js';

export function ProgressRing({ value }) {
  const size = 54;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(value, 0, 100) / 100) * circumference;

  return (
    <div className="progress-ring" aria-label={`今日进度 ${Math.round(value)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="progress-ring__track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="progress-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span>{Math.round(value)}%</span>
    </div>
  );
}
