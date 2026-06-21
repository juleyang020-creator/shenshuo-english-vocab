const DAY_MS = 86_400_000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function getDayKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function getTodayKey() {
  return getDayKey(new Date());
}

function parseKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

function formatUtc(ms) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function dayCount(daily, key) {
  return daily?.[key]?.seen || 0;
}

export function computeCurrentStreak(daily, todayKey = getTodayKey()) {
  if (!daily) return 0;
  let cursor = parseKey(todayKey);
  if (!dayCount(daily, todayKey)) cursor -= DAY_MS;
  let count = 0;
  while (dayCount(daily, formatUtc(cursor)) > 0) {
    count += 1;
    cursor -= DAY_MS;
  }
  return count;
}

export function computeLongestStreak(daily) {
  if (!daily) return 0;
  const keys = Object.keys(daily).filter((key) => dayCount(daily, key) > 0).sort();
  if (!keys.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < keys.length; index += 1) {
    const diff = Math.round((parseKey(keys[index]) - parseKey(keys[index - 1])) / DAY_MS);
    if (diff === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export function summarizeRecentDays(daily, days = 7, todayKey = getTodayKey()) {
  const result = [];
  let cursor = parseKey(todayKey);
  for (let index = 0; index < days; index += 1) {
    const key = formatUtc(cursor);
    const entry = daily?.[key] || { seen: 0, known: 0, weak: 0, quiz: 0 };
    result.unshift({ key, ...entry });
    cursor -= DAY_MS;
  }
  return result;
}
