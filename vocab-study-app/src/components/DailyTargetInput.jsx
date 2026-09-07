import { useEffect, useState } from 'react';

export function DailyTargetInput({ value, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const next = draft.trim() ? Math.min(500, Math.max(20, Number(draft) || value)) : value;
    onCommit(next);
    setDraft(String(next));
  }
  return <input aria-label="今日目标" min="20" max="500" type="number" inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}
