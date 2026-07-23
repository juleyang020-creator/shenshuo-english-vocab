import { useEffect, useState } from 'react';
import { isAlwaysKnown, lookupGloss } from '../lib/glossary.js';

// Split into word / non-word chunks, keeping separators so the text renders
// verbatim. Apostrophes/hyphens stay inside a word (e.g. "can't", "well-known").
const TOKEN_RE = /([A-Za-z][A-Za-z'’-]*)/g;

/**
 * Renders an English string, marking words that are (a) in our vocabulary and
 * (b) NOT yet known by the learner — with a tap/hover gloss showing the Chinese.
 * Basic/function words and words the learner already knows render plain, so the
 * marking shrinks as the learner's vocabulary grows.
 */
export function GlossedText({ text, glossary, knownWords }) {
  const [active, setActive] = useState(null); // { key, word, zh }

  useEffect(() => {
    if (!active) return undefined;
    const dismiss = () => setActive(null);
    // Defer so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', dismiss);
    };
  }, [active]);

  if (!text) return null;
  const parts = String(text).split(TOKEN_RE);

  return (
    <>
      {parts.map((part, i) => {
        // Odd indices are captured words; even are separators.
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        const lower = part.toLowerCase();
        if (isAlwaysKnown(part) || knownWords?.has(lower)) {
          return <span key={i}>{part}</span>;
        }
        const gloss = lookupGloss(part, glossary);
        if (!gloss) return <span key={i}>{part}</span>;
        const key = `${i}`;
        const isOpen = active?.key === key;
        return (
          <span key={i} className="gloss-wrap">
            <button
              type="button"
              className={`gloss ${isOpen ? 'is-open' : ''}`.trim()}
              title={gloss.zh}
              onClick={(e) => {
                e.stopPropagation();
                setActive(isOpen ? null : { key, word: part, zh: gloss.zh });
              }}
            >
              {part}
            </button>
            {isOpen ? (
              <span className="gloss-pop" role="tooltip">
                <b>{gloss.word}</b>
                <span>{gloss.zh}</span>
              </span>
            ) : null}
          </span>
        );
      })}
    </>
  );
}
