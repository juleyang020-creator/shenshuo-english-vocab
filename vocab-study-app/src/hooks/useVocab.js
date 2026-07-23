import { useEffect, useState } from 'react';
import { fetchJsonWithRetry } from '../lib/fetchJson.js';

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

// IndexedDB cache so the app boots from a local copy on repeat visits instead
// of re-fetching + re-parsing the 8MB JSON every time. We read from cache
// first (instant render), then refresh in the background. If the network
// fails but cache exists, we silently keep the cached payload.
const CACHE_DB = 'shenshuo-vocab-cache';
const CACHE_STORE = 'payload';
const CACHE_KEY = 'vocab';
const MAX_RETRY = 2;

function openDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(CACHE_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(CACHE_STORE)) {
          req.result.createObjectStore(CACHE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readCache() {
  try {
    const db = await openDB();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeCache(payload) {
  try {
    const db = await openDB();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put(payload, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore — caching is best-effort
  }
}

export function useVocab(url = DEFAULT_VOCAB_URL) {
  const [payload, setPayload] = useState(FALLBACK_PAYLOAD);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let cancelled = false;

    async function load() {
      setLoading(true);
      // 1. Render from cache immediately if available.
      const cached = await readCache();
      if (cancelled) return;
      if (cached && mounted) {
        setPayload(cached);
        setLoading(false);
      }
      // 2. Refresh in background; fall back to cache silently on failure.
      try {
        const data = await fetchJsonWithRetry(url, { attempts: MAX_RETRY, label: '词库' });
        if (cancelled) return;
        if (mounted) {
          setPayload(data);
          setLoading(false);
          setError('');
        }
        writeCache(data);
      } catch (err) {
        if (cancelled) return;
        if (!cached && mounted) {
          setError(err?.message || '词库加载失败');
          setLoading(false);
        }
        // If we have a cached payload, keep using it.
      }
    }
    load();
    return () => {
      mounted = false;
      cancelled = true;
    };
  }, [url]);

  return { payload, error, loading };
}
