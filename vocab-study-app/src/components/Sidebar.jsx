import {
  BookOpen,
  FileText,
  Layers3,
  ListChecks,
  PencilLine,
  Replace,
  RotateCcw,
  Star,
} from 'lucide-react';
import { ScopeButton } from './ScopeButton.jsx';

export const MODES = [
  { id: 'study', label: '学习新词', icon: Layers3 },
  { id: 'review', label: '复习巩固', icon: RotateCcw },
  { id: 'quiz', label: '单词测试', icon: ListChecks },
  { id: 'spelling', label: '拼写练习', icon: PencilLine },
  { id: 'cloze', label: '近义辨析', icon: Replace },
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
              className={`nav-item ${mode === item.id ? 'is-active' : ''}`.trim()}
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="nav-section scope-list">
        <span className="section-label">按难度梯度</span>
        {frequencyScopes.map((scope, index) => (
          <ScopeButton
            active={activeScope.kind === 'frequency' && activeScope.value === scope.id}
            detail={scope.detail}
            key={scope.id}
            label={scope.label}
            stats={frequencyScopeStats?.[index] || { learned: 0, known: 0, total: scope.entries?.length || 0 }}
            onClick={() => setActiveScope({ kind: 'frequency', value: scope.id })}
          />
        ))}
      </div>

      <div className="nav-section scope-list">
        <span className="section-label">按词汇类型</span>
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
      </div>

      <div className="nav-section range-list">
        <span className="section-label">词汇范围（按字母顺序）</span>
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
      </div>

      <button className="favorite-link" type="button" onClick={() => setMode('browse')}>
        <Star size={21} />
        我的收藏
      </button>
    </aside>
  );
}
