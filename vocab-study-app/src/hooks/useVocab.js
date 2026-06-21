import { useEffect, useState } from 'react';

const FALLBACK_PAYLOAD = {
  meta: {
    sourcePdf: '同等学力人员申请硕士学位英语水平全国统一考试大纲（第六版）.pdf',
    appendix: '附录一 词汇表',
    entryCount: 0,
  },
  entries: [],
};

// Resolve the data path relative to the build's base URL so it works whether
// the app is served from the domain root (iOS scheme, Windows, user pages) or
// a GitHub Pages project sub-path (/repo/). import.meta.env.BASE_URL always
// ends with a slash.
const DEFAULT_VOCAB_URL = `${import.meta.env.BASE_URL}data/vocab.json`;

export function useVocab(url = DEFAULT_VOCAB_URL) {
  const [payload, setPayload] = useState(FALLBACK_PAYLOAD);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`词库读取失败：${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        setPayload(data);
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

  return { payload, error, loading };
}
