import {
  BookOpen,
  FileText,
  Layers3,
  ListChecks,
  PencilLine,
  Replace,
  RotateCcw,
  Star,
  MoreHorizontal,
} from 'lucide-react';
import { ScopeButton } from './ScopeButton.jsx';

export const MODES = [
  { id: 'study', label: '学习新词', icon: Layers3 },
  { id: 'review', label: '复习巩固', icon: RotateCcw },
  { id: 'quiz', label: '单词测试', icon: ListChecks },
  { id: 'spelling', label: '拼写练习', icon: PencilLine },
  { id: 'cloze', label: '语境辨析', icon: Replace },
  { id: 'reading', label: '短文精读', icon: FileText },
  { id: 'browse', label: '生词本', icon: BookOpen },
];

export function Sidebar({
  mode,
  setMode,
  ranges,
  activeScope,
  setActiveScope,
  rangeStats,
  frequencyScopes,
  typeScopes,
  frequencyScopeStats,
  typeScopeStats,
  onOpenFavorites,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__icon">
          <BookOpen size={32} />
        </div>
        <div>
          <h1>申硕英语·词汇学习</h1>
          <p>基于考试大纲（第六版）</p>
        </div>
      </div>

      <nav className="nav-section" aria-label="学习模式">
        <span className="section-label">学习模式</span>
        {MODES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-item ${['quiz', 'spelling', 'browse'].includes(item.id) ? 'nav-extra' : ''} ${mode === item.id ? 'is-active' : ''}`.trim()}
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              aria-current={mode === item.id ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <details className="mobile-more">
          <summary className={['quiz', 'spelling', 'browse'].includes(mode) ? 'is-active' : ''}><MoreHorizontal size={20} /><span>更多</span></summary>
          <div className="mobile-more__menu">
            {MODES.filter((item) => ['quiz', 'spelling', 'browse'].includes(item.id)).map((item) => <button key={item.id} type="button" aria-current={mode === item.id ? 'page' : undefined} onClick={(event) => { setMode(item.id); event.currentTarget.closest('details').open = false; }}>{item.label}</button>)}
            <button type="button" onClick={(event) => { onOpenFavorites(); event.currentTarget.closest('details').open = false; }}>我的收藏</button>
          </div>
        </details>
      </nav>

      <div className="nav-section scope-list">
        <span className="section-label">按难度梯度</span>
        {frequencyScopes.map((scope, index) => (
          <ScopeButton
            active={(activeScope.kind === 'frequency' && activeScope.value === scope.id) || (activeScope.kind === 'stage-chunk' && String(activeScope.value).startsWith(`${scope.id}:`))}
            detail={scope.detail}
            key={scope.id}
            label={scope.label}
            stats={frequencyScopeStats?.[index] || { learned: 0, known: 0, total: scope.entries?.length || 0 }}
            onClick={() => setActiveScope({ kind: 'frequency', value: scope.id })}
          />
        ))}
      </div>

      <details className="nav-section scope-list scope-disclosure">
        <summary className="section-label">按词汇类型</summary>
        {typeScopes.map((scope, index) => (
          <ScopeButton
            active={activeScope.kind === 'type' && activeScope.value === scope.id}
            detail={scope.detail}
            key={scope.id}
            label={scope.label}
            stats={typeScopeStats?.[index] || { learned: 0, known: 0, total: scope.entries?.length || 0 }}
            onClick={() => setActiveScope({ kind: 'type', value: scope.id })}
          />
        ))}
      </details>

      <details className="nav-section range-list scope-disclosure">
        <summary className="section-label">按字母分段</summary>
        {ranges.map((range) => (
          <ScopeButton
            active={activeScope.kind === 'range' && Number(activeScope.value) === range.index}
            detail="顺序分段"
            key={range.label}
            label={range.label}
            stats={rangeStats[range.index]}
            onClick={() => setActiveScope({ kind: 'range', value: range.index })}
          />
        ))}
      </details>

      {/* Used to be a second, identical door to 生词本 (both just setMode('browse')).
          Now it earns its place: it lands in 生词本 with the list already filtered
          to favourites. */}
      <button className="favorite-link" type="button" onClick={onOpenFavorites}>
        <Star size={21} />
        我的收藏
      </button>
    </aside>
  );
}
