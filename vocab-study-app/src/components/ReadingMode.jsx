import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Languages, Lock, Scissors, XCircle } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';
import { GlossedText } from './GlossedText.jsx';
import {
  READING_LEVELS as LEVELS,
  READING_UNLOCK_AFTER as UNLOCK_AFTER,
  countReadingByLevel,
  createReadingSession,
  isReadingLevelUnlocked,
  moveReadingSession,
  prepareReadingQuestions,
} from '../lib/reading.js';

const EMPTY_DONE = {};

export function ReadingMode({ items, loading, error, shuffleSeed, stats, onAnswer, onComplete, onPositionChange, glossary, knownWords }) {
  const doneMap = stats?.done || EMPTY_DONE;
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [showParse, setShowParse] = useState(false);
  const persistedPositionRef = useRef(null);

  useEffect(() => {
    if (!items.length) return;
    if (!session) {
      setSession(createReadingSession(items, stats, shuffleSeed));
    } else if (session.seed !== shuffleSeed) {
      setSession(createReadingSession(items, { ...stats, level: session.level, lastPassageId: session.passageId }, shuffleSeed));
    }
  }, [items, session, stats, shuffleSeed]);

  const counts = useMemo(() => countReadingByLevel(items, doneMap), [items, doneMap]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const level = session?.level || 'gaokao';
  const queue = session?.queueIds || [];
  const index = session ? queue.indexOf(session.passageId) : -1;
  const current = itemsById.get(session?.passageId) || null;
  const questions = useMemo(() => prepareReadingQuestions(current, shuffleSeed), [current, shuffleSeed]);

  // Also persist the first displayed passage: a learner can leave or refresh
  // before ever pressing a navigation button.
  useEffect(() => {
    if (!current || !onPositionChange) return;
    const position = `${level}:${current.id}`;
    if (persistedPositionRef.current === position) return;
    persistedPositionRef.current = position;
    onPositionChange(current.id, level);
  }, [current, level, onPositionChange]);

  useEffect(() => {
    setAnswers({});
    setShowTranslation(false);
    setShowParse(false);
  }, [current?.id, shuffleSeed]);

  function chooseLevel(id, unlocked) {
    if (!unlocked || id === level) return;
    setSession(createReadingSession(items, { ...stats, level: id, lastPassageId: null }, shuffleSeed));
  }

  if (loading || (items.length > 0 && !session)) {
    return (
      <div className="card primary-card">
        <div className="notice">精读材料加载中…</div>
      </div>
    );
  }
  if (error || !items.length) {
    return (
      <div className="card primary-card">
        <EmptyState
          title={error ? '精读材料读取失败' : '暂无精读材料'}
          detail={error || '稍后再试，或重新生成精读题库。'}
        />
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= questions.length && questions.length > 0;
  const correctCount = questions.reduce(
    (n, q, i) => n + (answers[i] !== undefined && answers[i] === q.answer ? 1 : 0),
    0,
  );
  const accuracy = stats?.seen ? Math.round((stats.correct / stats.seen) * 100) : null;
  const paragraphs = String(current?.passage || '').split(/\n{2,}/).filter(Boolean);
  const translationParagraphs = String(current?.translation || '').split(/\n{2,}/).filter(Boolean);

  function pick(qIndex, optIndex) {
    if (!current || answers[qIndex] !== undefined) return;
    const next = { ...answers, [qIndex]: optIndex };
    setAnswers(next);
    onAnswer?.(questions[qIndex].answer === optIndex);
    if (Object.keys(next).length === questions.length) {
      const correct = questions.reduce((n, q, i) => n + (next[i] === q.answer ? 1 : 0), 0);
      onComplete?.(current, correct);
    }
  }
  function go(delta) {
    setSession((previous) => previous ? moveReadingSession(previous, delta) : previous);
  }

  return (
    <div className="card primary-card reading-card">
      <div className="card-toolbar">
        <div>
          <strong>短文精读</strong>
          {current?.topic ? <span>{current.topic}</span> : null}
        </div>
        <div className="toolbar-center">
          第 {queue.length ? index + 1 : 0} / {queue.length} 篇
        </div>
        <div className="toolbar-actions">
          {accuracy !== null ? <span className="cloze-acc">正确率 {accuracy}%</span> : null}
        </div>
      </div>

      <div className="reading-levels">
        {LEVELS.map(({ id, label }) => {
          const unlocked = isReadingLevelUnlocked(id, counts.done);
          const total = counts.total[id] || 0;
          const done = counts.done[id] || 0;
          const prevLabel = LEVELS[LEVELS.findIndex((l) => l.id === id) - 1]?.label;
          return (
            <button
              key={id}
              type="button"
              className={`level-tab ${level === id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`.replace(/\s+/g, ' ').trim()}
              disabled={!unlocked}
              aria-pressed={level === id}
              onClick={() => chooseLevel(id, unlocked)}
              title={unlocked ? '' : `完成 ${UNLOCK_AFTER} 篇${prevLabel}后解锁`}
            >
              {!unlocked ? <Lock size={12} /> : null}
              <span>{label}</span>
              <em>{unlocked ? `${done}/${total}` : `完成${UNLOCK_AFTER}篇${prevLabel}解锁`}</em>
            </button>
          );
        })}
      </div>

      {!current ? (
        <div className="reading-body">
          <EmptyState title="这个难度还没有材料" detail="换个难度试试。" />
        </div>
      ) : (
      <div className="reading-body">
        <h3 className="reading-title">{current.title}</h3>
        <div className="reading-meta">
          {current.wordCount ? <span>{current.wordCount} 词</span> : null}
          {questions.length ? <span>{questions.length} 题</span> : null}
          {doneMap[current.id] ? <span className="reading-done">已读过</span> : null}
          {allAnswered ? <span className="reading-score">本篇 {correctCount}/{questions.length}</span> : null}
        </div>
        <div className="reading-guide">
          <strong>这一篇这样学</strong>
          <p>① 通读英文，找出每段主旨　② 回到原文定位依据，完成 {questions.length} 题　③ 对照解析与译文，复述文章大意</p>
        </div>
        <p className="reading-source">
          {current.sourceType === 'generated-practice' ? 'AI 辅助编写的模拟阅读' : '英语阅读练习'} · 未标注为历年真题，题目按文中信息作答。
        </p>

        <article className="reading-passage" lang="en" aria-label="英文原文">
          {paragraphs.map((p, i) => (
            <p key={i}>
              <GlossedText text={p} glossary={glossary} knownWords={knownWords} />
            </p>
          ))}
        </article>
        <p className="reading-gloss-hint">遇到影响理解的生词，可点带虚线的词查看中文。先试着从上下文猜词。</p>

        {Array.isArray(current.keyWords) && current.keyWords.length ? (
          <div className="reading-words">
            <span className="reading-words__label">重点词汇</span>
            <div className="reading-words__list">
              {current.keyWords.map((k) => (
                <span className="reading-word" key={k.word}>
                  <b>{k.word}</b> {k.zh}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="reading-questions">
          <div className="reading-section-heading">
            <h4>理解与定位</h4>
            <span aria-live="polite">已答 {answeredCount} / {questions.length} 题</span>
          </div>
          {questions.map((q, qi) => {
            const chosen = answers[qi];
            const done = chosen !== undefined;
            return (
              <div className="reading-q" key={`${current.id}:${qi}`} role="group" aria-labelledby={`reading-question-${qi}`}>
                <p className="reading-q__text" id={`reading-question-${qi}`} lang="en">
                  <span className="reading-q__no">{qi + 1}</span>
                  {q.q}
                </p>
                <div className="reading-q__options">
                  {q.options.map((opt, oi) => {
                    const isAnswer = oi === q.answer;
                    const cls = done
                      ? isAnswer
                        ? 'is-correct'
                        : chosen === oi
                          ? 'is-wrong'
                          : 'is-dimmed'
                      : '';
                    return (
                      <button
                        key={oi}
                        type="button"
                        className={`reading-option ${cls}`.trim()}
                        disabled={done}
                        lang="en"
                        onClick={() => pick(qi, oi)}
                      >
                        <span className="reading-option__key">{String.fromCharCode(65 + oi)}</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {done ? (
                  <div className={`reading-explain ${chosen === q.answer ? 'is-correct' : 'is-wrong'}`} role="status">
                    <span className="reading-explain__head">
                      {chosen === q.answer ? (
                        <><CheckCircle2 size={15} /> 正确</>
                      ) : (
                        <><XCircle size={15} /> 选错了 · 正确答案 {String.fromCharCode(65 + q.answer)}</>
                      )}
                    </span>
                    <p>{q.explain}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {allAnswered ? (
          <div className="reading-completion" role="status">
            <strong>本篇完成 · 答对 {correctCount} / {questions.length} 题</strong>
            <p>{correctCount === questions.length
              ? '现在试着用 1～2 句英文概括文章，再对照长难句与译文检查理解。'
              : `还有 ${questions.length - correctCount} 题值得回看。先找到原文依据，比较干扰项，再对照译文确认。`}</p>
            <span>复盘完成后，点击「下一篇」继续。</span>
          </div>
        ) : null}

        <div className="reading-tools">
          <button
            type="button"
            className={`reading-toggle ${showParse ? 'is-on' : ''}`.trim()}
            disabled={!allAnswered}
            aria-expanded={showParse}
            aria-controls="reading-parse"
            onClick={() => setShowParse((v) => !v)}
            title={allAnswered ? '' : '答完题后可查看'}
          >
            <Scissors size={15} /> 长难句拆解
          </button>
          <button
            type="button"
            className={`reading-toggle ${showTranslation ? 'is-on' : ''}`.trim()}
            disabled={!allAnswered}
            aria-expanded={showTranslation}
            aria-controls="reading-translation"
            onClick={() => setShowTranslation((v) => !v)}
            title={allAnswered ? '' : '答完题后可查看'}
          >
            <Languages size={15} /> 全文翻译
          </button>
          {!allAnswered ? <span className="reading-lock-hint">再答 {questions.length - answeredCount} 题，可看拆句和译文</span> : null}
        </div>

        {showParse && Array.isArray(current.longSentences) ? (
          <div className="reading-parse" id="reading-parse">
            {current.longSentences.map((s, i) => (
              <div className="reading-parse__item" key={i}>
                <p className="reading-parse__en">{s.sentence}</p>
                {s.skeleton ? <p className="reading-parse__row"><em>骨架</em>{s.skeleton}</p> : null}
                {s.modifiers ? <p className="reading-parse__row"><em>修饰</em>{s.modifiers}</p> : null}
                {s.translation ? <p className="reading-parse__row"><em>翻译</em>{s.translation}</p> : null}
                {s.tip ? <p className="reading-parse__tip">💡 {s.tip}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        {showTranslation ? (
          <div className="reading-translation" id="reading-translation">
            {translationParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
      </div>
      )}

      <div className="card-footer">
        <button type="button" onClick={() => go(-1)} disabled={!current}>
          <ChevronLeft size={18} /> 上一篇
        </button>
        <button type="button" onClick={() => go(1)} disabled={!current}>
          下一篇 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
