import { useEffect, useRef } from 'react';

// Attach window-level keyboard shortcuts. The handlers map is kept in a ref so
// that callers can pass in fresh closures every render without re-registering
// the listener (and without listing every dependency).
//
// Bindings are matched by event.key (case-insensitive for single letters) and
// optionally by modifier keys via the "ctrl+", "alt+", "shift+", "meta+" prefix.
// Example:
//   useKeyboardShortcuts({
//     ArrowLeft: () => goPrevious(),
//     ArrowRight: () => goNext(),
//     ' ': () => toggleMeaning(),
//     '1': () => pickOption(0),
//     k: () => mark('know'),
//     'shift+r': () => reshuffle(),
//   });

function describeKey(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  parts.push(key);
  return parts.join('+');
}

function shouldIgnoreTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(handlers, { enabled = true } = {}) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    function onKey(event) {
      if (shouldIgnoreTarget(event.target)) return;
      const map = ref.current || {};
      const longForm = describeKey(event);
      const handler = map[longForm] || map[event.key] || map[event.key?.toLowerCase?.()];
      if (typeof handler === 'function') {
        event.preventDefault();
        handler(event);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
