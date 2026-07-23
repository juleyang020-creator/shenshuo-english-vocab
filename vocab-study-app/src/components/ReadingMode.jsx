import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Languages, Lock, Scissors, XCircle } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';
import { GlossedText } from './GlossedText.jsx';
import { stableShuffle } from '../lib/shuffle.js';

const LEVELS = [
  { id: 'gaokao', label: '高考' },
  { id: 'cet4', label: '四级' },
  { id: 'cet6', label: '六级' },
];
// Finishing this many passages at a level unlocks the next — a light gate that
// keeps a beginner on level-appropriate material instead of a wall of unknowns.
const UNLOCK_AFTER = 6;

function countByLevel(items, doneMap) {
  const total = {};
  const done = {};
  for (const it of items) {
    total[it.level] = (total[it.level] || 0) + 1;
    if (doneMap[it.id]) done[it.level] = (done[it.level] || 0) + 1;
  }
  return { total, done };
}

function isUnlocked(levelId, done) {
  const idx = LEVELS.findIndex((l) => l.id === levelId);
  if (idx <= 0) return true;
  const prev = LEVELS[idx - 1].id;
  return (done[prev] || 0) >= UNLOCK_AFTER;
}

function pickDefaultLevel(items, doneMap) {
  const { total, done } = countByLevel(items, doneMap);
  // lowest unlocked level that still has unread passages
  for (const { id } of LEVELS) {
    if (isUnlocked(id, done) && (done[id] || 0) < (total[id] || 0)) return id;
  }
  // else highest unlocked level
  let fallback = 'gaokao';
  for (const { id } of LEVELS) if (isUnlocked(id, done)) fallback = id;
  return fallback;
}

export function ReadingMode({ items, loading, error, shuffleSeed, stats, onAnswer, onComplete, onPositionChange, glossary, knownWords }) {
  const doneMap = stats?.done || {};
  const [level, setLevel] = useState('gaokao');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [showParse, setShowParse] = useState(false);
  const initedRef = useRef(false);
  // The passage we owe the learner a jump back to. Held until a queue actually
  // containing it shows up — the saved level is applied asynchronously, so the
  // first queue we see may still be the default level's.
  const pendingPassageRef = useRef(stats?.lastPassageId || null);

  // Restore the level tab last chosen (when it's still unlocked); otherwise pick
  // the lowest unlocked level that still has unread passages.
  useEffect(() => {
    if (initedRef.current || !items.length) return;
    initedRef.current = true;
    const saved = stats?.level;
    const done = countByLevel(items, doneMap).done;
    if (saved && LEVELS.some((l) => l.id === saved) && isUnlocked(saved, done)) {
      setLevel(saved);
      return;
    }
    pendingPassageRef.current = null; // saved level unusable — don't chase its passage
    setLevel(pickDefaultLevel(items, doneMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, doneMap]);

  const counts = useMemo(() => countByLevel(items, doneMap), [items, doneMap]);

  // Queue: this level's passages, unread ones first, deterministically shuffled.
  const queue = useMemo(() => {
    const pool = items.filter((it) => it.level === level);
    const shuffled = stableShuffle(pool, `${shuffleSeed}:reading:${level}`);
    const unread = shuffled.filter((it) => !doneMap[it.id]);
    const read = shuffled.filter((it) => doneMap[it.id]);
    return [...unread, ...read];
  }, [items, level, shuffleSeed, doneMap]);

  const current = queue.length ? queue[Math.min(index, queue.length - 1)] : null;

  // Consume the pending restore as soon as a queue containing that passage
  // appears (i.e. once the saved level has been applied).
  useEffect(() => {
    const targetId = pendingPassageRef.current;
    if (!targetId || !queue.length) return;
    const idx = queue.findIndex((item) => item.id === targetId);
    if (idx >= 0) {
      pendingPassageRef.current = null;
      setIndex(idx);
    }
  }, [queue]);

  useEffect(() => {
    setAnswers({});
    setShowTranslation(false);
    setShowParse(false);
  }, [current?.id]);

  function chooseLevel(id, unlocked) {
    if (!unlocked || id === level) return;
    pendingPassageRef.current = null; // an explicit tab change outranks any restore
    setLevel(id);
    setIndex(0);
    onPositionChange?.(null, id);
  }

  if (loading) {
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

  const questions = Array.isArray(current?.questions) ? current.questions : [];
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
    if (!queue.length) return;
    const nextIndex = (index + delta + queue.length) % queue.length;
    pendingPassageRef.current = null;
    setIndex(nextIndex);
    onPositionChange?.(queue[nextIndex]?.id, level);
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
          const unlocked = isUnlocked(id, counts.done);
          const total = counts.total[id] || 0;
          const done = counts.done[id] || 0;
          const prevLabel = LEVELS[LEVELS.findIndex((l) => l.id === id) - 1]?.label;
          return (
            <button
              key={id}
              type="button"
              className={`level-tab ${level === id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`.replace(/\s+/g, ' ').trim()}
              disabled={!unlocked}
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
          {current.wordCount ? <span>{current.wordCount} words</span> : null}
          {questions.length ? <span>{questions.length} 题</span> : null}
          {doneMap[current.id] ? <span className="reading-done">已读过</span> : null}
          {allAnswered ? <span className="reading-score">本篇 {correctCount}/{questions.length}</span> : null}
        </div>

        <article className="reading-passage">
          {paragraphs.map((p, i) => (
            <p key={i}>
              <GlossedText text={p} glossary={glossary} knownWords={knownWords} />
            </p>
          ))}
        </article>
        <p className="reading-gloss-hint">带虚线的词是你还没掌握的 —— 点一下看中文，不用离开文章</p>

        {Array.isArray(current.keyWords) && current.keyWords.length ? (
          <div className="reading-words">
            <span className="reading-words__label">生词</span>
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
          {questions.map((q, qi) => {
            const chosen = answers[qi];
            const done = chosen !== undefined;
            return (
              <div className="reading-q" key={qi}>
                <p className="reading-q__text">
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
                        onClick={() => pick(qi, oi)}
                      >
                        <span className="reading-option__key">{String.fromCharCode(65 + oi)}</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {done ? (
                  <div className={`reading-explain ${chosen === q.answer ? 'is-correct' : 'is-wrong'}`}>
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

        <div className="reading-tools">
          <button
            type="button"
            className={`reading-toggle ${showParse ? 'is-on' : ''}`.trim()}
            disabled={!allAnswered}
            onClick={() => setShowParse((v) => !v)}
            title={allAnswered ? '' : '答完题后可查看'}
          >
            <Scissors size={15} /> 长难句拆解
          </button>
          <button
            type="button"
            className={`reading-toggle ${showTranslation ? 'is-on' : ''}`.trim()}
            disabled={!allAnswered}
            onClick={() => setShowTranslation((v) => !v)}
            title={allAnswered ? '' : '答完题后可查看'}
          >
            <Languages size={15} /> 全文翻译
          </button>
          {!allAnswered ? <span className="reading-lock-hint">答完 {questions.length} 题后解锁</span> : null}
        </div>

        {showParse && Array.isArray(current.longSentences) ? (
          <div className="reading-parse">
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
          <div className="reading-translation">
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
