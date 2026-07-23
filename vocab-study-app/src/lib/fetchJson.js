// Shared JSON loader with a small retry + backoff, so a transient network blip
// doesn't dead-end a data-backed screen (previously only the main vocab loader
// retried; the cloze / reading题库 gave up on the first failed request and only
// re-tried if the user switched modes away and back).
//
// `cache: 'no-cache'` revalidates the static JSON with a cheap conditional
// request instead of trusting a possibly-stale HTTP cache. `label` keeps the
// error message specific to each data source (词库 / 辨析题库 / 精读题库).
export async function fetchJsonWithRetry(url, { attempts = 2, label = '数据' } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${label}读取失败：${response.status}`);
      return await response.json();
    } catch (err) {
      lastError = err;
      // brief backoff before retrying (300ms, then 600ms, …)
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
  throw lastError;
}
