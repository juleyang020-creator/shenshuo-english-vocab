import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Star,
  Volume2,
  XCircle,
} from 'lucide-react';
import { IconButton } from './IconButton.jsx';
import { EmptyState } from './EmptyState.jsx';
import { cleanDefinitionLines, shortDefinition } from '../lib/definition.js';
import { DIFFICULTY_STAGES, LEVEL_LABEL, getExamTags } from '../lib/frequency.js';

const STAGE_LABEL = Object.fromEntries(DIFFICULTY_STAGES.map((stage) => [stage.id, stage.label]));

function SpellingPrompt({ entry, onPlay }) {
  return (
    <div className="spelling-prompt">
      <button
        type="button"
        className="spelling-prompt__audio"
        onClick={onPlay}
        aria-label="再听一次发音"
        title="再听一次发音 (P)"
      >
        <Volume2 size={42} />
        <span>点这里听一次发音</span>
      </button>
      {entry.phonetic ? (
        <div className="spelling-prompt__phonetic">/{entry.phonetic}/</div>
      ) : null}
      <div className="spelling-prompt__meaning">
        {cleanDefinitionLines(entry).slice(0, 4).map((line, index) => (
          <p key={`${entry.id}-prompt-${index}`}>{line}</p>
        ))}
      </div>
      <div className="spelling-prompt__hint">
        根据中文释义、音标和发音拼写出英文单词
      </div>
    </div>
  );
}

const MODE_TITLE = {
  study: '新词学习',
  review: '复习巩固',
  quiz: '单词测试',
  spelling: '拼写练习',
  browse: '生词本',
};

function renderSpellingFeedback(feedback) {
  if (!feedback) return null;
  return (
    <div
      className={`spelling-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}
      aria-live="polite"
    >
      <strong>{feedback.correct ? '拼写正确' : '差一点'}</strong>
      <div className="spelling-feedback__letters">
        {feedback.letters.map((cell, index) => (
          <span
            className={`spelling-cell spelling-cell--${cell.kind}`}
            key={`${cell.kind}-${index}`}
          >
            <span className="spelling-cell__main">
              {cell.kind === 'extra' ? cell.actual : cell.expected}
            </span>
            {cell.kind === 'wrong' ? (
              <span className="spelling-cell__sub">{cell.actual}</span>
            ) : null}
          </span>
        ))}
      </div>
      {!feedback.correct ? (
        <small>正确拼写：{feedback.expected}</small>
      ) : null}
    </div>
  );
}

export function StudyCard({
  mode,
  activeScopeMeta,
  currentEntry,
  currentProgress,
  queue,
  currentIndex,
  isChoiceMode,
  answeredChoice,
  quizOptions,
  quizChoice,
  choiceResult,
  showMeaning,
  spellingInput,
  spellingFeedback,
  onSpellingInput,
  onSpellingSubmit,
  onPlay,
  onToggleFavorite,
  onChoice,
  onMaster,
  onReveal,
  onMark,
  onToggleMeaning,
  onPrevious,
  onNext,
  entriesCount,
}) {
  return (
    <div className="card primary-card">
      <div className="card-toolbar">
        <div>
          <strong>{MODE_TITLE[mode] || '新词学习'}</strong>
          <span>{activeScopeMeta?.label || '词库'}</span>
          <span className="queue-badge">乱序</span>
        </div>
        <div className="toolbar-center">
          第 {queue.length ? currentIndex + 1 : 0} / {queue.length || 0} 词
        </div>
        <div className="toolbar-actions">
          <IconButton label="发音 (P)" onClick={onPlay}>
            <Volume2 size={19} />
          </IconButton>
          <IconButton
            className={currentProgress.favorite ? 'is-favorite' : ''}
            label="收藏 (S)"
            onClick={onToggleFavorite}
          >
            <Star size={19} />
          </IconButton>
        </div>
      </div>

      {currentEntry ? (
        <>
          <div className="word-card">
            <div className="word-meta">
              {currentEntry.difficultyStage ? (
                <span className={`stage-chip stage-chip--${currentEntry.difficultyStage}`}>
                  {STAGE_LABEL[currentEntry.difficultyStage] || '未分级'}
                </span>
              ) : null}
              {getExamTags(currentEntry).map((tag) => (
                <span className={`exam-chip exam-chip--${tag}`} key={tag}>
                  {LEVEL_LABEL[tag] || tag}
                </span>
              ))}
              {currentEntry.cocaBand ? (
                <span className="coca-chip" title={`COCA 频率排名 ${currentEntry.cocaRank}`}>
                  COCA {currentEntry.cocaBand}
                </span>
              ) : null}
              {currentProgress.mastered ? (
                <span className="mastered-chip" title="已标记认识，不再进入复习">
                  已掌握
                </span>
              ) : null}
              <span>PDF 第 {currentEntry.pdfPage} 页</span>
              <span>书页 {currentEntry.printedPage}</span>
              <span>{currentEntry.source}</span>
            </div>
            {mode === 'spelling' && !spellingFeedback ? (
              <SpellingPrompt entry={currentEntry} onPlay={onPlay} />
            ) : (
              <>
                <button className="word-title" type="button" onClick={onPlay}>
                  {currentEntry.word}
                  <Volume2 size={25} />
                </button>
                {currentEntry.phonetic ? (
                  <div className="phonetic">/{currentEntry.phonetic}/</div>
                ) : null}
                <div className={`meaning ${showMeaning ? 'is-visible' : ''}`}>
                  {cleanDefinitionLines(currentEntry).slice(0, 4).map((line, index) => (
                    <p key={`${currentEntry.id}-${index}`}>{line}</p>
                  ))}
                </div>
              </>
            )}
            {isChoiceMode ? (
              <div className="quiz-options">
                {quizOptions.map((option, index) => (
                  <button
                    className={`quiz-option ${
                      answeredChoice && option.id === currentEntry.id
                        ? 'is-correct'
                        : quizChoice === option.id
                          ? 'is-wrong'
                          : ''
                    }`.trim()}
                    disabled={answeredChoice}
                    key={option.id}
                    type="button"
                    aria-label={`选项 ${String.fromCharCode(65 + index)}：${option.definition}`}
                    onClick={() => onChoice(option)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    {option.definition}
                  </button>
                ))}
              </div>
            ) : null}
            {isChoiceMode && answeredChoice ? (
              <div className={`choice-feedback ${choiceResult.correct ? 'is-correct' : 'is-wrong'}`.trim()}>
                <strong>
                  {choiceResult.correct
                    ? '回答正确'
                    : choiceResult.revealed
                      ? '先记住它，之后会再考你'
                      : '选错了'}
                </strong>
                <span>正确释义：{shortDefinition(currentEntry)}</span>
              </div>
            ) : null}
            {mode === 'study' ? (
              <div className="mastery-row">
                <button
                  className="mastery mastery--known"
                  type="button"
                  disabled={!choiceResult?.correct}
                  onClick={onMaster}
                  title={choiceResult?.correct ? '这个词以后不再出现' : '答对之后才能选'}
                >
                  <CheckCircle2 size={20} />
                  <span>认识</span>
                  <small>{choiceResult?.correct ? '不再复习 · K' : '答对后可选'}</small>
                </button>
                <button
                  className="mastery mastery--unknown"
                  type="button"
                  disabled={answeredChoice}
                  onClick={onReveal}
                  title="直接看答案，并加入之后的复习"
                >
                  <XCircle size={20} />
                  <span>不认识</span>
                  <small>看答案 · F</small>
                </button>
              </div>
            ) : null}
            {mode === 'spelling' ? (
              <>
                <form className="spelling-box" onSubmit={onSpellingSubmit}>
                  <input
                    autoComplete="off"
                    autoFocus
                    disabled={Boolean(spellingFeedback)}
                    key={currentEntry.id}
                    placeholder="输入英文拼写"
                    type="text"
                    value={spellingInput}
                    onChange={(event) => onSpellingInput(event.target.value)}
                  />
                  <button type="submit" disabled={Boolean(spellingFeedback)}>
                    提交
                  </button>
                </form>
                {renderSpellingFeedback(spellingFeedback)}
              </>
            ) : null}
          </div>

          {!isChoiceMode && mode !== 'spelling' ? (
            <div className="action-row">
              <button className="decision decision--know" type="button" onClick={() => onMark('know')}>
                <CheckCircle2 size={23} />
                <span>认识</span>
                <small>1 / 2 / K</small>
              </button>
              <button className="decision decision--unsure" type="button" onClick={() => onMark('unsure')}>
                <CircleHelp size={23} />
                <span>有点印象</span>
                <small>U / 3</small>
              </button>
              <button className="decision decision--forgot" type="button" onClick={() => onMark('forgot')}>
                <XCircle size={23} />
                <span>不认识</span>
                <small>F / 4</small>
              </button>
            </div>
          ) : null}

          <div className="card-footer">
            <button type="button" onClick={onPrevious}>
              <ChevronLeft size={18} /> 上一词
            </button>
            <button
              className="ghost-button"
              disabled={isChoiceMode && !answeredChoice}
              type="button"
              onClick={onToggleMeaning}
            >
              <Lightbulb size={18} /> {showMeaning ? '收起释义' : '提示'}
            </button>
            <button disabled={isChoiceMode && !answeredChoice} type="button" onClick={onNext}>
              下一词 <ChevronRight size={18} />
            </button>
          </div>
          <div className="keyboard-hint">← → 翻页 · 空格 提示 · 1-4 选项 · K/U/F 评分 · P 发音 · S 收藏</div>
        </>
      ) : (
        <EmptyState
          title={entriesCount ? '当前队列为空' : '词库正在生成'}
          detail={
            entriesCount
              ? mode === 'review'
                ? '复习巩固只显示已经学习过的新词。请先在"学习新词"里完成选择题。'
                : '这个范围或分类可能已经学完，可以切换范围、频率或词汇类型。'
              : '完成 OCR 后会自动读取大纲词汇。'
          }
        />
      )}
    </div>
  );
}
