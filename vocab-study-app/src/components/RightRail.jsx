import { ChevronDown, ChevronRight, Download, Trash2, Upload } from 'lucide-react';
import { Panel } from './Panel.jsx';
import { TaskRow } from './TaskRow.jsx';
import { EmptyState } from './EmptyState.jsx';
import { StudyStats } from './StudyStats.jsx';
import { DIFFICULTY_STAGES } from '../lib/frequency.js';
import { STAGE_CHUNK_SIZE } from '../lib/scope.js';

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
  stageCounts,
  study,
  activeScope,
  setMode,
  setActiveScope,
  getWordProgress,
  resetAllProgress,
  onExport,
  onImport,
}) {
  return (
    <aside className="right-rail">
      {/* 「新词学习」used to live here too, but the top bar already shows that exact
          pair as a ring AND as text. The remaining three are today's only display
          of 复习/测试/答错 counts, so the panel stays — it just no longer repeats.
          Denominators are the real totals: the old Math.max(20/10, …) floors made
          the row read "3 / 10" while the panel below said 「薄弱词汇 (7)」. */}
      <Panel title="今日完成">
        <div className="task-list">
          <TaskRow
            label="复习单词"
            total={Math.max(1, dueEntries.length)}
            value={Math.min(todayStats.known, Math.max(1, dueEntries.length))}
          />
          <TaskRow label="单词测试" total={30} value={todayStats.quiz} />
          <TaskRow
            label="答错待巩固"
            total={Math.max(1, weakEntries.length)}
            value={Math.min(todayStats.weak, Math.max(1, weakEntries.length))}
          />
        </div>
      </Panel>

      <Panel title="学习统计">
        <StudyStats daily={study.daily} words={study.words} dailyTarget={dailyTarget} />
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

      {/* 「词库概况」removed: 词库总数 repeated the top bar, 当前分类 repeated the
          highlighted sidebar scope, 高考基础 repeated the 难度梯度 panel above, and
          「来源页 88-282」was a fixed page range from the paper syllabus — no use to
          a learner. The reset button was its child and is the app's ONLY data-reset
          entry point, so it stays, on its own, at the bottom where dangerous
          actions belong (and still reachable on mobile, unlike the top-bar gear
          which CSS hides below 1180px). */}
      {/* All progress lives in this browser's localStorage — phone and laptop are
          separate records and clearing site data wipes everything. Export is the
          learner's only real backup, and the way to move a record between devices. */}
      <Panel title="数据">
        <p className="data-note">
          进度只保存在这台设备的浏览器里。导出一份，换设备或清缓存后可以导入恢复。
        </p>
        <div className="data-actions">
          <button className="data-action" type="button" onClick={onExport}>
            <Download size={15} /> 导出学习记录
          </button>
          <button className="data-action" type="button" onClick={onImport}>
            <Upload size={15} /> 导入备份
          </button>
        </div>
        <button className="reset-progress" type="button" onClick={resetAllProgress}>
          <Trash2 size={15} /> 清除所有学习进度
        </button>
      </Panel>
    </aside>
  );
}
