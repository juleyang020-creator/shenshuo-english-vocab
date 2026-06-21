import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Target,
  Trash2,
} from 'lucide-react';
import { Panel } from './Panel.jsx';
import { TaskRow } from './TaskRow.jsx';
import { EmptyState } from './EmptyState.jsx';
import { summarizeRecentDays } from '../lib/streak.js';
import { DIFFICULTY_STAGES } from '../lib/frequency.js';
import { STAGE_CHUNK_SIZE } from '../lib/scope.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function Sparkline({ days, max }) {
  if (!days?.length) return null;
  const ceiling = Math.max(max || 0, 1, ...days.map((day) => day.seen || 0));
  return (
    <div className="sparkline">
      {days.map((day) => (
        <div className="sparkline__col" key={day.key} title={`${day.key} · ${day.seen} 词`}>
          <span
            className="sparkline__bar"
            style={{ height: `${clamp(((day.seen || 0) / ceiling) * 100, 6, 100)}%` }}
          />
          <small>{day.key.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}

function StageBreakdown({ stageCounts, activeScope, setActiveScope, setMode }) {
  return (
    <ol className="stage-list">
      {DIFFICULTY_STAGES.map((stage, index) => {
        const count = stageCounts?.[stage.id] || 0;
        const chunks = Math.max(1, Math.ceil(count / STAGE_CHUNK_SIZE));
        const isThisStage =
          (activeScope.kind === 'frequency' && activeScope.value === stage.id)
          || (activeScope.kind === 'stage-chunk'
              && String(activeScope.value).startsWith(`${stage.id}:`));
        const activeChunkIndex =
          activeScope.kind === 'stage-chunk'
          && String(activeScope.value).startsWith(`${stage.id}:`)
            ? Number(String(activeScope.value).split(':')[1] || 0)
            : -1;
        return (
          <li key={stage.id} className={`stage-row ${isThisStage ? 'is-active' : ''}`.trim()}>
            <button
              className="stage-button"
              type="button"
              onClick={() => {
                setActiveScope({ kind: 'frequency', value: stage.id });
                setMode('study');
              }}
            >
              <span className="stage-rank">{index + 1}</span>
              <span className="stage-info">
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </span>
              <span className="stage-count">
                <em>{count}</em>
                {chunks > 1 ? (
                  isThisStage ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                ) : null}
              </span>
            </button>
            {isThisStage && chunks > 1 ? (
              <ol className="chunk-list">
                {Array.from({ length: chunks }, (_, chunkIdx) => {
                  const start = chunkIdx * STAGE_CHUNK_SIZE + 1;
                  const end = Math.min(count, (chunkIdx + 1) * STAGE_CHUNK_SIZE);
                  const isActiveChunk = chunkIdx === activeChunkIndex;
                  return (
                    <li key={chunkIdx}>
                      <button
                        type="button"
                        className={`chunk-button ${isActiveChunk ? 'is-active' : ''}`.trim()}
                        onClick={() => {
                          setActiveScope({
                            kind: 'stage-chunk',
                            value: `${stage.id}:${chunkIdx}`,
                          });
                          setMode('study');
                        }}
                      >
                        <span>第 {chunkIdx + 1} 段</span>
                        <small>{start}-{end}</small>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function RightRail({
  dailyTarget,
  todayStats,
  weakEntries,
  dueEntries,
  learnerEntriesCount,
  activeStats,
  stageCounts,
  payload,
  study,
  activeScope,
  setMode,
  setActiveScope,
  getWordProgress,
  resetAllProgress,
}) {
  const recentDays = summarizeRecentDays(study.daily, 7);
  return (
    <aside className="right-rail">
      <Panel title="今日任务">
        <div className="task-list">
          <TaskRow label="新词学习" total={dailyTarget} value={todayStats.seen} />
          <TaskRow
            label="复习单词"
            total={Math.max(20, dueEntries.length)}
            value={Math.min(todayStats.known, Math.max(20, dueEntries.length))}
          />
          <TaskRow label="单词测试" total={30} value={todayStats.quiz} />
          <TaskRow
            label="薄弱词汇"
            total={Math.max(10, weakEntries.length)}
            value={Math.min(todayStats.weak, Math.max(10, weakEntries.length))}
          />
        </div>
      </Panel>

      <Panel title="近 7 天进度">
        <Sparkline days={recentDays} max={dailyTarget} />
      </Panel>

      <Panel title="难度梯度（点击展开小段）">
        <StageBreakdown
          stageCounts={stageCounts}
          activeScope={activeScope}
          setActiveScope={setActiveScope}
          setMode={setMode}
        />
      </Panel>

      <Panel
        title={`薄弱词汇 (${weakEntries.length})`}
        action={
          <button className="text-action" type="button" onClick={() => setMode('review')}>
            复习 <ChevronRight size={16} />
          </button>
        }
      >
        <ol className="word-list">
          {weakEntries.slice(0, 6).map((entry, index) => (
            <li key={entry.id}>
              <span>{index + 1}</span>
              <strong>{entry.word}</strong>
              <small>错 {getWordProgress(entry).wrong || 0} 次</small>
            </li>
          ))}
        </ol>
        {!weakEntries.length ? <EmptyState title="暂无薄弱词" /> : null}
      </Panel>

      <Panel
        title={`待复习队列 (${dueEntries.length})`}
        action={
          <button className="text-action" type="button" onClick={() => setMode('review')}>
            开始 <ChevronRight size={16} />
          </button>
        }
      >
        <ol className="review-list">
          {dueEntries.slice(0, 6).map((entry, index) => (
            <li key={entry.id}>
              <span>{index + 1}</span>
              <strong>{entry.word}</strong>
              <small>{getWordProgress(entry).score || 0} 分</small>
            </li>
          ))}
        </ol>
        {!dueEntries.length ? <EmptyState title="没有到期词" /> : null}
      </Panel>

      <Panel title="词库概况">
        <div className="library-stats">
          <div>
            <Target size={20} />
            <span>词库总数</span>
            <strong>{learnerEntriesCount}</strong>
          </div>
          <div>
            <Bookmark size={20} />
            <span>当前分类</span>
            <strong>
              {activeStats.learned}/{activeStats.total}
            </strong>
          </div>
          <div>
            <GraduationCap size={20} />
            <span>高考基础</span>
            <strong>{stageCounts?.gaokao || 0}</strong>
          </div>
          <div>
            <BookOpen size={20} />
            <span>来源页</span>
            <strong>
              {payload.meta?.printedPages?.[0] || 88}-{payload.meta?.printedPages?.[1] || 282}
            </strong>
          </div>
        </div>
        <button className="reset-progress" type="button" onClick={resetAllProgress}>
          <Trash2 size={15} /> 清除所有学习进度
        </button>
      </Panel>
    </aside>
  );
}
