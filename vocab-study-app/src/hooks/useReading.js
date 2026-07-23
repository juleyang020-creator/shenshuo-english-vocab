import { useEffect, useRef, useState } from 'react';
import { fetchJsonWithRetry } from '../lib/fetchJson.js';

// Base-aware so it works from the domain root and a GitHub Pages sub-path alike.
const DEFAULT_READING_URL = `${import.meta.env.BASE_URL}data/passages.json`;

function validatePassages(data) {
  if (!Array.isArray(data?.items)) {
    throw new Error('精读题库格式错误：items 不是数组');
  }
  const invalid = data.items.find((item) => {
    const questions = Array.isArray(item?.questions) ? item.questions : [];
    return (
      !item?.id
      || typeof item.passage !== 'string'
      || !item.passage.trim()
      || questions.length === 0
      || questions.some(
        (q) =>
          !Array.isArray(q?.options)
          || q.options.length !== 4
          || typeof q.answer !== 'number'
          || q.answer < 0
          || q.answer > 3,
      )
    );
  });
  if (invalid) {
    throw new Error(`精读题库格式错误：${invalid.id || '未知篇目'}`);
  }
  return data.items;
}

export function useReading({ enabled = true, url = DEFAULT_READING_URL } = {}) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError('');
    fetchJsonWithRetry(url, { label: '精读题库' })
      .then((data) => {
        setItems(validatePassages(data));
        setLoading(false);
      })
      .catch((err) => {
        fetchedRef.current = false;
        setError(err.message);
        setLoading(false);
      });
  }, [enabled, url]);

  return { items, error, loading };
}
