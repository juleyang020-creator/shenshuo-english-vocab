// Derived learning statistics. Everything here is computed from data the app has
// been recording all along (study.words + study.daily) — nothing new is tracked,
// so these figures are meaningful immediately rather than only going forward.

import { dayTotal, getDayKey } from './streak.js';

/**
 * Lifetime answer accuracy across the word modes (学习/复习/测试/拼写).
 * `correct`/`wrong` on each word progress are cumulative counters written by
 * applyReview, so this needs no per-day bookkeeping.
 *
 * Note this is deliberately NOT a 7-day trend: `daily` never recorded per-day
 * correct/attempt counts, so a trend line could only start from today and would
 * read as "no data" for weeks. A lifetime number is honest and useful now.
 */
export function computeAccuracy(words) {
  let correct = 0;
  let wrong = 0;
  for (const progress of Object.values(words || {})) {
    correct += progress?.correct || 0;
    wrong += progress?.wrong || 0;
  }
  const total = correct + wrong;
  return {
    correct,
    wrong,
    total,
    percent: total ? Math.round((correct / total) * 100) : null,
  };
}

/** How many distinct days have any recorded study activity. */
export function countStudiedDays(daily) {
  return Object.keys(daily || {}).filter((key) => dayTotal(daily[key]) > 0).length;
}

/**
 * A calendar grid ending today: `weeks` columns of 7 days, each column starting
 * on Sunday, matching the familiar contribution-graph shape. Returns cells in
 * row-major order (row = weekday) so CSS grid can lay it out directly.
 */
export function buildHeatmap(daily, weeks = 12, today = new Date()) {
  const end = new Date(`${getDayKey(today)}T00:00:00`);
  // Anchor on the Sunday of the week `weeks - 1` weeks back, then run forward to
  // today inclusive. Anchoring on the START and counting a fixed weeks*7 days
  // instead would stop short by however many days the Sunday alignment shifted —
  // dropping the most recent week, today's cell included.
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  start.setDate(start.getDate() - start.getDay());

  const cells = [];
  let max = 0;
  // Step with setDate rather than adding fixed milliseconds so a DST change
  // can't shift the walk off calendar-day boundaries.
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = getDayKey(cursor);
    const count = dayTotal(daily?.[key]);
    if (count > max) max = count;
    cells.push({ key, count, weekday: cursor.getDay() });
  }
  return { cells, max, weeks };
}

/**
 * Bucket a day's activity into 0-4 so the heatmap has a small, readable palette.
 * Scaled against the daily target (not the observed max) so the colour means
 * "how close to your goal", which stays stable as history grows.
 */
export function heatLevel(count, dailyTarget = 120) {
  if (!count) return 0;
  const goal = Math.max(1, dailyTarget);
  const ratio = count / goal;
  if (ratio >= 1) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}
