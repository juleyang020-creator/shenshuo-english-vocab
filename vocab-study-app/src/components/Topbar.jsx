import { Bell, Flame, Settings, Shuffle } from 'lucide-react';
import { IconButton } from './IconButton.jsx';
import { ProgressRing } from './ProgressRing.jsx';

export function Topbar({
  todayStats,
  dailyTarget,
  setDailyTarget,
  allKnown,
  totalEntries,
  progressValue,
  streak,
  longestStreak,
  reshuffleQueue,
  openPronunciation,
  openReview,
}) {
  return (
    <header className="topbar">
      <div className="topbar__progress">
        <span>今日学习进度</span>
        <ProgressRing value={progressValue} />
        <div>
          <strong>
            已学 <b>{todayStats.seen}</b> / {dailyTarget} 词
          </strong>
          <small>
            累计掌握 {allKnown} 词 · 词库共 {totalEntries} 个
          </small>
        </div>
      </div>
      <div className="metric">
        <span>今日目标</span>
        <label>
          <input
            aria-label="今日目标"
            max="500"
            min="20"
            type="number"
            value={dailyTarget}
            onChange={(event) => setDailyTarget(event.target.value)}
          />
          词
        </label>
      </div>
      <div className="metric">
        <span>连续学习</span>
        <strong>
          <Flame size={21} /> {streak} 天
        </strong>
        {longestStreak > streak ? <small>最长 {longestStreak} 天</small> : null}
      </div>
      <div className="topbar__actions">
        <IconButton label="重新乱序" onClick={reshuffleQueue}>
          <Shuffle size={20} />
        </IconButton>
        <IconButton label="去复习" onClick={openReview}>
          <Bell size={20} />
        </IconButton>
        <IconButton label="发音设置" onClick={openPronunciation}>
          <Settings size={20} />
        </IconButton>
      </div>
    </header>
  );
}
