import { ArrowRight, Download, Trash2, Upload } from 'lucide-react';
import { StudyStats } from './StudyStats.jsx';
import { DailyTargetInput } from './DailyTargetInput.jsx';

export function RightRail({ dailyTarget, setDailyTarget, todayStats, weakEntries, dueEntries, study, setMode, openReview, getWordProgress, resetAllProgress, onExport, onImport }) {
  return (
    <aside className="right-rail" aria-label="学习概况与记录">
      <section className="rail-section">
        <h3>接下来学什么</h3>
        <button className="next-review" type="button" onClick={openReview}>
          <span><strong>{dueEntries.length}</strong> 个词到期复习</span><ArrowRight size={18} />
        </button>
        <p className="rail-note">{dueEntries.length ? '先巩固到期词，再继续学习新词。' : '目前没有到期词，可以学新词或回看已学词。'}</p>
        <div className="practice-links">
          <button type="button" onClick={() => setMode('cloze')}><span>语境辨析<small>练习词义与固定搭配</small></span><ArrowRight size={16} /></button>
          <button type="button" onClick={() => setMode('reading')}><span>短文精读<small>在文章中运用词汇</small></span><ArrowRight size={16} /></button>
        </div>
      </section>
      <section className="rail-section">
        <h3>今日记录</h3>
        <label className="mobile-daily-target">今日目标 <DailyTargetInput value={dailyTarget} onCommit={setDailyTarget} /> 次</label>
        <dl className="daily-counts">
          <div><dt>词汇练习</dt><dd>{todayStats.seen || 0}<small> 次</small></dd></div>
          <div><dt>其中答对</dt><dd>{todayStats.known || 0}<small> 次</small></dd></div>
          <div><dt>语境辨析</dt><dd>{todayStats.cloze || 0}<small> 题</small></dd></div>
          <div><dt>阅读答题</dt><dd>{todayStats.reading || 0}<small> 题</small></dd></div>
        </dl>
      </section>
      <details className="rail-section rail-disclosure">
        <summary>学习统计</summary>
        <StudyStats daily={study.daily} words={study.words} dailyTarget={dailyTarget} />
      </details>
      <details className="rail-section rail-disclosure">
        <summary>薄弱词汇 <span>{weakEntries.length}</span></summary>
        {weakEntries.length ? <><ol className="word-list">{weakEntries.slice(0, 6).map((entry, index) => <li key={entry.id}><span>{index + 1}</span><strong>{entry.word}</strong><small>错 {getWordProgress(entry).wrong || 0} 次</small></li>)}</ol><button type="button" className="text-action" onClick={openReview}>复习到期与薄弱词 <ArrowRight size={16} /></button></> : <p className="rail-note">还没有需要重点巩固的词。</p>}
      </details>
      <details className="rail-section rail-disclosure">
        <summary>备份与恢复</summary>
        <p className="data-note">学习记录保存在当前浏览器。换设备前请导出备份，再在新设备导入。</p>
        <div className="data-actions">
          <button className="data-action" type="button" onClick={onExport}><Download size={15} /> 导出学习记录</button>
          <button className="data-action" type="button" onClick={onImport}><Upload size={15} /> 导入备份</button>
        </div>
        <button className="reset-progress" type="button" onClick={resetAllProgress}><Trash2 size={15} /> 清除所有学习进度</button>
      </details>
    </aside>
  );
}
