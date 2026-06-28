import { useEffect, useState } from 'react';

// Base-aware so it works from the domain root (iOS scheme / Windows) and a
// GitHub Pages project sub-path alike.
const DEFAULT_CLOZE_URL = `${import.meta.env.BASE_URL}data/cloze.json`;

export function useCloze(url = DEFAULT_CLOZE_URL) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`辨析题库读取失败：${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [url]);

  return { items, error, loading };
}
