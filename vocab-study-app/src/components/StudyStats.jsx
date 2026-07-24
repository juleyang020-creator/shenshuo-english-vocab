import { useMemo } from 'react';
import { buildHeatmap, computeAccuracy, countStudiedDays, heatLevel } from '../lib/stats.js';
import { EmptyState } from './EmptyState.jsx';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * Study calendar + the two figures the app could never show before: how many days
 * you've studied in total, and your overall answer accuracy.
 *
 * This replaces the old 「近 7 天进度」bar chart rather than sitting beside it —
 * the same week is the rightmost column here, so keeping both would repeat the
 * data. The two things the bars did well are preserved: colour is scaled against
 * the daily target (so "did I hit my goal" still reads at a glance) and every
 * cell keeps a hover title with the exact date and count.
 */
export function StudyStats({ daily, words, dailyTarget, weeks = 12 }) {
  const heatmap = useMemo(() => buildHeatmap(daily, weeks), [daily, weeks]);
  const accuracy = useMemo(() => computeAccuracy(words), [words]);
  const studiedDays = useMemo(() => countStudiedDays(daily), [daily]);

  if (!studiedDays) {
    return <EmptyState title="还没有学习记录" detail="今天学几个词，这里就会亮起来。" />;
  }

  return (
    <div className="stats">
      <div className="stats__figures">
        <div>
          <strong>{studiedDays}</strong>
          <span>累计学习天数</span>
        </div>
        <div>
          <strong>{accuracy.percent === null ? '—' : `${accuracy.percent}%`}</strong>
          <span>答题正确率</span>
        </div>
      </div>

      <div className="heatmap-wrap">
        <div className="heatmap__weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => (
            // Only odd rows are labelled; 7 labels in ~110px would collide.
            <span key={label}>{index % 2 === 1 ? label : ''}</span>
          ))}
        </div>
        <div className="heatmap" role="img" aria-label={`最近 ${weeks} 周的学习日历`}>
          {heatmap.cells.map((cell) => (
            <span
              key={cell.key}
              className={`heat heat--${heatLevel(cell.count, dailyTarget)}`}
              title={`${cell.key} · ${cell.count ? `${cell.count} 次` : '没学'}`}
            />
          ))}
        </div>
      </div>

      <div className="heatmap__legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i className={`heat heat--${level}`} key={level} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
