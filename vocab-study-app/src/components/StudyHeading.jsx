import { ArrowRight } from 'lucide-react';
import { STAGE_CHUNK_SIZE } from '../lib/scope.js';

const MODE_GUIDE = {
  study: ['学习新词', '先回想词义，再选择答案。答题后读例句、记用法。'],
  review: ['复习巩固', '先回想再揭晓，根据记忆程度评分。到期词与薄弱词优先。'],
  quiz: ['单词测试', '用选择题检查词义记忆，也可以切换听力模式。'],
  spelling: ['拼写练习', '听发音、看释义，写出单词，再核对容易漏写的字母。'],
  cloze: ['语境辨析', '结合上下文和固定搭配，选择最适合句子的词。'],
  reading: ['短文精读', '读文章、找依据、答题，再核对译文与句子结构。'],
  browse: ['生词本', '回看学过的单词，也可以搜索全词库或筛选收藏。'],
};

export function StudyHeading({ mode, activeScope, setActiveScope, frequencyScopes, typeScopes, ranges, dueCount, openReview }) {
  const [title, guide] = MODE_GUIDE[mode] || MODE_GUIDE.study;
  const usesScope = !['cloze', 'reading', 'browse'].includes(mode);
  return (
    <div className="study-heading">
      <div><p className="workspace-label">申硕英语 / 每日练习</p><h2>{title}</h2><p>{guide}</p></div>
      {usesScope ? (
        <label className="scope-select"><span>学习范围</span>
          <select value={`${activeScope.kind}|${activeScope.value}`} onChange={(event) => {
            const [kind, value] = event.target.value.split('|');
            setActiveScope({ kind, value });
          }}>
            <option value="all|all">全部词库</option>
            <optgroup label="难度梯度">{frequencyScopes.map((s) => <option key={s.id} value={`frequency|${s.id}`}>{s.label} · {s.entries.length} 词</option>)}</optgroup>
            {frequencyScopes.map((s) => <optgroup key={s.id} label={`${s.label} · 分段练习`}>{Array.from({ length: Math.ceil(s.entries.length / STAGE_CHUNK_SIZE) }, (_, i) => <option key={i} value={`stage-chunk|${s.id}:${i}`}>{s.label} · 第 {i + 1} 段</option>)}</optgroup>)}
            <optgroup label="按词性">{typeScopes.map((s) => <option key={s.id} value={`type|${s.id}`}>{s.label}</option>)}</optgroup>
            <optgroup label="按字母分段">{ranges.map((r) => <option key={r.index} value={`range|${r.index}`}>{r.label}</option>)}</optgroup>
          </select>
        </label>
      ) : null}
      {mode === 'study' && dueCount > 0 ? <button className="review-reminder" type="button" onClick={openReview}>先复习 {dueCount} 个到期词 <ArrowRight size={16} /></button> : null}
    </div>
  );
}
