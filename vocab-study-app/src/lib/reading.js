import { stableShuffle } from './shuffle.js';

export const READING_LEVELS = [
  { id: 'gaokao', label: '高考' },
  { id: 'cet4', label: '四级' },
  { id: 'cet6', label: '六级' },
];
export const READING_UNLOCK_AFTER = 6;

export function countReadingByLevel(items, doneMap = {}) {
  const total = {};
  const done = {};
  for (const item of items) {
    total[item.level] = (total[item.level] || 0) + 1;
    if (doneMap[item.id]) done[item.level] = (done[item.level] || 0) + 1;
  }
  return { total, done };
}

export function isReadingLevelUnlocked(levelId, done) {
  const index = READING_LEVELS.findIndex((level) => level.id === levelId);
  if (index < 0) return false;
  if (index === 0) return true;
  return (done[READING_LEVELS[index - 1].id] || 0) >= READING_UNLOCK_AFTER;
}

export function createReadingSession(items, stats = {}, seed) {
  const doneMap = stats.done || {};
  const { total, done } = countReadingByLevel(items, doneMap);
  const unlocked = READING_LEVELS.filter(({ id }) => isReadingLevelUnlocked(id, done));
  const savedLevelUsable = unlocked.some(({ id }) => id === stats.level);
  const level = savedLevelUsable
    ? stats.level
    : (unlocked.find(({ id }) => (done[id] || 0) < (total[id] || 0)) || unlocked.at(-1)).id;
  const shuffled = stableShuffle(items.filter((item) => item.level === level), `${seed}:reading:${level}`);
  const queue = [...shuffled.filter((item) => !doneMap[item.id]), ...shuffled.filter((item) => doneMap[item.id])];
  const restored = savedLevelUsable && queue.some((item) => item.id === stats.lastPassageId);

  // Snapshot the order when entering a level. Completing the current passage
  // must not move it away while its answers and explanations are being read.
  return {
    level,
    seed,
    queueIds: queue.map((item) => item.id),
    passageId: restored ? stats.lastPassageId : queue[0]?.id || null,
  };
}

export function moveReadingSession(session, delta) {
  if (!session.queueIds.length) return session;
  const currentIndex = Math.max(0, session.queueIds.indexOf(session.passageId));
  const nextIndex = (currentIndex + delta + session.queueIds.length) % session.queueIds.length;
  return { ...session, passageId: session.queueIds[nextIndex] };
}

export function prepareReadingQuestions(passage, seed) {
  return (passage?.questions || []).map((question, questionIndex) => {
    const order = stableShuffle(question.options.map((_, index) => index), `${seed}:reading:${passage.id}:question:${questionIndex}`);
    const letters = Object.fromEntries(order.map((original, displayed) => [String.fromCharCode(65 + original), String.fromCharCode(65 + displayed)]));
    return {
      ...question,
      options: order.map((index) => question.options[index]),
      answer: order.indexOf(question.answer),
      // Standalone letters are option references in this question bank. Match
      // them in one pass so a permutation cannot remap an already changed letter.
      explain: String(question.explain || '').replace(/(?<![A-Za-z0-9_])[A-D](?![A-Za-z0-9_])/g, (letter) => letters[letter]),
    };
  });
}
