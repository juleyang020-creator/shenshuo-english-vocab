import { CheckCircle2 } from 'lucide-react';
import { clamp } from '../lib/math.js';

export function TaskRow({ label, value, total }) {
  const done = value >= total;
  return (
    <div className="task-row">
      <span>{label}</span>
      <strong>
        {value} / {total}
      </strong>
      {done ? (
        <CheckCircle2 size={21} />
      ) : (
        <span
          className="mini-progress"
          style={{ '--value': `${clamp((value / total) * 100, 0, 100)}%` }}
        />
      )}
    </div>
  );
}
