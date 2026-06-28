import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Lightbulb, XCircle } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';
import { stableShuffle, seededRandom } from '../lib/shuffle.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

const LEVEL_LABEL = {
  gaokao: '高考',
  cet4: '四级',
  cet6: '六级',
  postgrad: '考研',
};

function shuffleOptions(options, seed) {
  const random = seededRandom(seed);
  const array = options.map((opt, i) => ({ opt, k: random() + i * 1e-6 }));
  array.sort((a, b) => a.k - b.k);
  return array.map((x) => x.opt);
}

function SentenceWithBlank({ sentence, answered, answerWord }) {
  const idx = sentence.indexOf('___');
  const before = idx >= 0 ? sentence.slice(0, idx) : sentence;
  const after = idx >= 0 ? sentence.slice(idx + 3) : '';
  return (
    <p className="cloze-sentence">
      <span>{before}</span>
      <span className={`cloze-blank ${answered ? 'is-filled' : ''}`.trim()}>
        {answered ? answerWord : ' '}
      </span>
      <span>{after}</span>
    </p>
  );
}

export function ClozeMode({ items, loading, error, shuffleSeed, stats, onAnswer }) {
  const queue = useMemo(
    () => (items.length ? stableShuffle(items, `${shuffleSeed}:cloze`) : []),
    [items, shuffleSeed],
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null); // chosen word
  const current = queue.length ? queue[Math.min(index, queue.length - 1)] : null;
  const answered = selected !== null;

  const options = useMemo(
    () => (current ? shuffleOptions(current.options, `${shuffleSeed}:${current.id}`) : []),
    [current, shuffleSeed],
  );

  useEffect(() => {
    setSelected(null);
  }, [current?.id]);

  function pick(word) {
    if (answered || !current) return;
    setSelected(word);
    const correct = current.options.some((o) => o.word === word && o.correct);
    onAnswer?.(Boolean(correct));
  }

  function next() {
    setSelected(null);
    setIndex((i) => (queue.length ? (i + 1) % queue.length : 0));
  }
  function previous() {
    setSelected(null);
    setIndex((i) => (queue.length ? (i - 1 + queue.length) % queue.length : 0));
  }

  useKeyboardShortcuts(
    {
      ArrowLeft: () => previous(),
      ArrowRight: () => {
        if (answered) next();
      },
      1: () => options[0] && pick(options[0].word),
      2: () => options[1] && pick(options[1].word),
      3: () => options[2] && pick(options[2].word),
      4: () => options[3] && pick(options[3].word),
    },
    { enabled: Boolean(current) },
  );

  if (loading) {
    return (
      <div className="card primary-card">
        <div className="notice">辨析题库加载中…</div>
      </div>
    );
  }
  if (error || !queue.length) {
    return (
      <div className="card primary-card">
        <EmptyState
          title={error ? '辨析题库读取失败' : '辨析题库为空'}
          detail={error || '稍后再试，或重新构建词库。'}
        />
      </div>
    );
  }

  const correctOption = current.options.find((o) => o.correct);
  const accuracy = stats?.seen ? Math.round((stats.correct / stats.seen) * 100) : null;

  return (
    <div className="card primary-card cloze-card">
      <div className="card-toolbar">
        <div>
          <strong>近义辨析</strong>
          <span>{current.theme}</span>
          {current.level ? <span className="queue-badge">{LEVEL_LABEL[current.level] || current.level}</span> : null}
        </div>
        <div className="toolbar-center">
          第 {index + 1} / {queue.length} 题
        </div>
        <div className="toolbar-actions">
          {accuracy !== null ? <span className="cloze-acc">正确率 {accuracy}%</span> : null}
        </div>
      </div>

      <div className="cloze-body">
        <SentenceWithBlank sentence={current.sentence} answered={answered} answerWord={correctOption?.word} />

        <div className="cloze-options">
          {options.map((opt, i) => {
            const isCorrect = opt.correct;
            const isChosen = selected === opt.word;
            const cls = answered
              ? isCorrect
                ? 'is-correct'
                : isChosen
                  ? 'is-wrong'
                  : 'is-dimmed'
              : '';
            return (
              <button
                key={opt.word}
                type="button"
                className={`cloze-option ${cls}`.trim()}
                disabled={answered}
                onClick={() => pick(opt.word)}
              >
                <span className="cloze-option__key">{String.fromCharCode(65 + i)}</span>
                <span className="cloze-option__word">{opt.word}</span>
                {answered ? <span className="cloze-option__zh">{opt.zh}</span> : null}
              </button>
            );
          })}
        </div>

        {answered ? (
          <div className={`cloze-feedback ${selected === correctOption?.word ? 'is-correct' : 'is-wrong'}`.trim()}>
            <div className="cloze-feedback__head">
              {selected === correctOption?.word ? (
                <><CheckCircle2 size={18} /> 回答正确</>
              ) : (
                <><XCircle size={18} /> 选错了 · 正确答案：{correctOption?.word}</>
              )}
            </div>
            <p className="cloze-translation">{current.translation}</p>
            <div className="cloze-explain">
              <span className="cloze-explain__label"><Lightbulb size={14} /> 辨析</span>
              <p>{current.explain}</p>
            </div>
          </div>
        ) : (
          <div className="cloze-hint">选一个最贴切的词填入空格</div>
        )}
      </div>

      <div className="card-footer">
        <button type="button" onClick={previous}>
          <ChevronLeft size={18} /> 上一题
        </button>
        <button type="button" disabled={!answered} onClick={next}>
          下一题 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
