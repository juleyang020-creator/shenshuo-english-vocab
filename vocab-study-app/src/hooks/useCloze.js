import { useEffect, useRef, useState } from 'react';

// Base-aware so it works from the domain root (iOS scheme / Windows) and a
// GitHub Pages project sub-path alike.
const DEFAULT_CLOZE_URL = `${import.meta.env.BASE_URL}data/cloze.json`;

function validateClozeItems(data) {
  if (!Array.isArray(data?.items)) {
    throw new Error('辨析题库格式错误：items 不是数组');
  }
  const invalid = data.items.find((item) => {
    const options = Array.isArray(item?.options) ? item.options : [];
    return (
      !item?.id
      || typeof item.sentence !== 'string'
      || item.sentence.split('___').length !== 2
      || options.length !== 4
      || options.filter((option) => option?.correct === true).length !== 1
    );
  });
  if (invalid) {
    throw new Error(`辨析题库格式错误：${invalid.id || '未知题目'}`);
  }
  return data.items;
}

export function useCloze({ enabled = true, url = DEFAULT_CLOZE_URL } = {}) {
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
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`辨析题库读取失败：${response.status}`);
        return response.json();
      })
      .then((data) => {
        setItems(validateClozeItems(data));
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
