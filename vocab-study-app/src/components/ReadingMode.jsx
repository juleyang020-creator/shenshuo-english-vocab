import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Languages, Scissors, XCircle } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';
import { GlossedText } from './GlossedText.jsx';
import { stableShuffle } from '../lib/shuffle.js';

const LEVEL_LABEL = { gaokao: '高考', cet4: '四级', cet6: '六级', postgrad: '考研' };

export function ReadingMode({ items, loading, error, shuffleSeed, stats, onAnswer, glossary, knownWords }) {
  const queue = useMemo(
    () => (items.length ? stableShuffle(items, `${shuffleSeed}:reading`) : []),
    [items, shuffleSeed],
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [showParse, setShowParse] = useState(false);

  const current = queue.length ? queue[Math.min(index, queue.length - 1)] : null;

  useEffect(() => {
    setAnswers({});
    setShowTranslation(false);
    setShowParse(false);
  }, [current?.id]);

  if (loading) {
    return (
      <div className="card primary-card">
        <div className="notice">精读材料加载中…</div>
      </div>
    );
  }
  if (error || !queue.length) {
    return (
      <div className="card primary-card">
        <EmptyState
          title={error ? '精读材料读取失败' : '暂无精读材料'}
          detail={error || '稍后再试，或重新生成精读题库。'}
        />
      </div>
    );
  }

  const questions = Array.isArray(current.questions) ? current.questions : [];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= questions.length && questions.length > 0;
  const correctCount = questions.reduce(
    (n, q, i) => n + (answers[i] !== undefined && answers[i] === q.answer ? 1 : 0),
    0,
  );
  const accuracy = stats?.seen ? Math.round((stats.correct / stats.seen) * 100) : null;
  const paragraphs = String(current.passage).split(/\n{2,}/).filter(Boolean);
  const translationParagraphs = String(current.translation || '').split(/\n{2,}/).filter(Boolean);

  function pick(qIndex, optIndex) {
    if (answers[qIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
    onAnswer?.(questions[qIndex].answer === optIndex);
  }
  function go(delta) {
    setIndex((i) => (queue.length ? (i + delta + queue.length) % queue.length : 0));
  }

  return (
    <div className="card primary-card reading-card">
      <div className="card-toolbar">
        <div>
          <strong>短文精读</strong>
          <span>{current.topic}</span>
          {current.level ? (
            <span className="queue-badge">{LEVEL_LABEL[current.level] || current.level}</span>
          ) : null}
        </div>
        <div className="toolbar-center">
          第 {index + 1} / {queue.length} 篇
        </div>
        <div className="toolbar-actions">
          {accuracy !== null ? <span className="cloze-acc">正确率 {accuracy}%</span> : null}
        </div>
      </div>

      <div className="reading-body">
        <h3 className="reading-title">{current.title}</h3>
        <div className="reading-meta">
          {current.wordCount ? <span>{current.wordCount} words</span> : null}
          {questions.length ? <span>{questions.length} 题</span> : null}
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

      <div className="card-footer">
        <button type="button" onClick={() => go(-1)}>
          <ChevronLeft size={18} /> 上一篇
        </button>
        <button type="button" onClick={() => go(1)}>
          下一篇 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
