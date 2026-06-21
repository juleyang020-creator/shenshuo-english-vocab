// Lightweight SM-2 style spaced repetition.
// Each word progress carries: easiness (default 2.5), interval (days),
// repetitions, score, attempts, correct, wrong, lastSeen, nextReview.
// The three study buttons and quiz/spelling outcomes map to SM-2 quality:
//   know    -> 5
//   unsure  -> 3
//   forgot  -> 1
//   correct -> 4
//   wrong   -> 1

const DAY_MS = 86_400_000;
const MIN_EF = 1.3;
const DEFAULT_EF = 2.5;

const QUALITY_BY_RESULT = {
  know: 5,
  unsure: 3,
  forgot: 1,
  correct: 4,
  wrong: 1,
};

export function progressDefaults() {
  return {
    score: 0,
    easiness: DEFAULT_EF,
    interval: 0,
    repetitions: 0,
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastSeen: 0,
    nextReview: 0,
    favorite: false,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function applyReview(previous, result, now = Date.now()) {
  const base = { ...progressDefaults(), ...(previous || {}) };
  const quality = QUALITY_BY_RESULT[result] ?? 3;

  let { easiness, repetitions, interval } = base;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * easiness));
  }

  easiness = easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (easiness < MIN_EF) easiness = MIN_EF;

  const intervalMs = interval * DAY_MS;
  const jitter = Math.floor((Math.random() - 0.5) * Math.min(intervalMs * 0.05, DAY_MS / 2));

  const scoreDelta = quality >= 4 ? 1 : quality <= 2 ? -1 : 0;
  const nextScore = clamp((base.score || 0) + scoreDelta, -4, 12);

  return {
    ...base,
    easiness: Math.round(easiness * 1000) / 1000,
    repetitions,
    interval,
    score: nextScore,
    attempts: base.attempts + 1,
    correct: base.correct + (quality >= 4 ? 1 : 0),
    wrong: base.wrong + (quality <= 2 ? 1 : 0),
    lastSeen: now,
    nextReview: now + intervalMs + jitter,
  };
}

export function isKnown(progress) {
  if (!progress) return false;
  return (progress.repetitions || 0) >= 3 || (progress.score || 0) >= 3;
}

export function isWeak(progress) {
  if (!progress) return false;
  return (progress.wrong || 0) > (progress.correct || 0) || (progress.score || 0) < 0;
}

export function isDue(progress, now = Date.now()) {
  return Boolean(progress?.nextReview && progress.nextReview <= now);
}

export function hasStartedLearning(progress) {
  return Boolean(progress && ((progress.attempts || 0) > 0 || progress.lastSeen));
}

export function describeNextReview(progress, now = Date.now()) {
  if (!progress?.nextReview) return '';
  const diff = progress.nextReview - now;
  if (diff <= 0) return '需复习';
  const days = Math.round(diff / DAY_MS);
  if (days >= 1) return `${days} 天后`;
  const hours = Math.max(1, Math.round(diff / 3_600_000));
  return `${hours} 小时后`;
}
