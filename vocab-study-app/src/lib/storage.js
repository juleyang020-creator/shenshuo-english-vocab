import { progressDefaults } from './srs.js';
import { getTodayKey } from './streak.js';
import { DIFFICULTY_STAGES, WORD_TYPE_BUCKETS } from './frequency.js';

export const STORAGE_KEY = 'shen-shuo-vocab-study-v1';
const SCHEMA_VERSION = 2;

export const DEFAULT_SPEECH_SETTINGS = {
  accent: 'us',
  rate: 0.82,
  repeat: 1,
  autoSpeak: false,
  voiceURI: '',
};

const DEFAULT_SETTINGS = {
  dailyTarget: 120,
  shuffleSeed: '',
  lastSession: null,
};

const DEFAULT_SESSION = {
  mode: 'study',
  activeScope: { kind: 'frequency', value: 'gaokao' },
  currentIndex: 0,
  currentEntryId: null,
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isString = (value) => typeof value === 'string';
const isPosition = (value) => Number.isSafeInteger(value) && value >= 0;
const stageIds = new Set(DIFFICULTY_STAGES.map((stage) => stage.id));
const typeIds = new Set(WORD_TYPE_BUCKETS.map((type) => type.id));

function isValidScope(scope) {
  if (!isPlainObject(scope)) return false;
  if (scope.kind === 'all') return scope.value === undefined || scope.value === 'all';
  if (scope.kind === 'frequency') return stageIds.has(scope.value);
  if (scope.kind === 'type') return typeIds.has(scope.value);
  if (scope.kind === 'range') {
    return isPosition(scope.value) || (isString(scope.value) && /^\d+$/.test(scope.value) && isPosition(Number(scope.value)));
  }
  if (scope.kind === 'stage-chunk' && isString(scope.value)) {
    const [stage, index, extra] = scope.value.split(':');
    return stageIds.has(stage) && /^\d+$/.test(index || '') && isPosition(Number(index)) && extra === undefined;
  }
  return false;
}

const SETTING_RULES = {
  dailyTarget: isFiniteNumber,
  shuffleSeed: isString,
  lastSession: (value) => value === null || isPlainObject(value),
  speech: isPlainObject,
};
const SESSION_RULES = {
  mode: (value) => ['study', 'review', 'quiz', 'spelling', 'cloze', 'reading', 'browse'].includes(value),
  activeScope: isValidScope,
  currentIndex: isPosition,
  currentEntryId: (value) => value === null || isString(value),
};
const SPEECH_RULES = {
  accent: (value) => value === 'us' || value === 'uk',
  rate: (value) => isFiniteNumber(value) && value > 0,
  repeat: (value) => Number.isInteger(value) && value >= 1 && value <= 3,
  autoSpeak: (value) => typeof value === 'boolean',
  voiceURI: isString,
};

// External backups fail before overwrite; damaged local settings retain each
// healthy neighbour while invalid fields fall back to their own defaults.
function settingsFields(value, defaults, rules, label, strict) {
  const source = isPlainObject(value) ? value : {};
  const result = { ...defaults, ...source };
  for (const [key, valid] of Object.entries(rules)) {
    if (source[key] === undefined) {
      result[key] = defaults[key];
    } else if (!valid(source[key])) {
      if (strict) throw new Error(`文件已损坏：${label}.${key} 格式不对`);
      result[key] = defaults[key];
    }
  }
  return result;
}

function normalizeSettings(value, strict = false) {
  const defaults = { ...DEFAULT_SETTINGS, shuffleSeed: getTodayKey(), speech: { ...DEFAULT_SPEECH_SETTINGS } };
  const settings = settingsFields(value, defaults, SETTING_RULES, 'settings', strict);
  settings.dailyTarget = Math.min(500, Math.max(20, settings.dailyTarget));
  settings.shuffleSeed ||= defaults.shuffleSeed;
  if (settings.lastSession !== null) {
    settings.lastSession = settingsFields(settings.lastSession, DEFAULT_SESSION, SESSION_RULES, 'settings.lastSession', strict);
  }
  settings.speech = settingsFields(settings.speech, DEFAULT_SPEECH_SETTINGS, SPEECH_RULES, 'settings.speech', strict);
  settings.speech.rate = Math.min(1.05, Math.max(0.62, settings.speech.rate));
  return settings;
}

const DAILY_DEFAULTS = { seen: 0, known: 0, weak: 0, quiz: 0, cloze: 0, reading: 0 };

function validField(value, fallback, key) {
  if (typeof fallback === 'number') {
    return typeof value === 'number' && Number.isFinite(value) && (key === 'score' || value >= 0);
  }
  if (typeof fallback === 'boolean' || typeof fallback === 'string') return typeof value === typeof fallback;
  return true;
}

function normalizeRecord(value, defaults) {
  const result = { ...defaults, ...(isPlainObject(value) ? value : {}) };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (!validField(result[key], fallback, key)) result[key] = fallback;
  }
  return result;
}

function normalizeRecords(value, defaults) {
  return Object.fromEntries(
    Object.entries(isPlainObject(value) ? value : {})
      .filter(([, record]) => isPlainObject(record))
      .map(([id, record]) => [id, normalizeRecord(record, defaults)]),
  );
}

function validateRecord(value, defaults, label) {
  if (!isPlainObject(value)) throw new Error(`文件已损坏：${label} 不是有效记录`);
  for (const [key, fallback] of Object.entries(defaults)) {
    if (value[key] !== undefined && !validField(value[key], fallback, key)) {
      throw new Error(`文件已损坏：${label} 的 ${key} 格式不对`);
    }
  }
}

export function defaultStudyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    words: {},
    notes: {},
    daily: {},
    // lastItemId / lastPassageId remember where you were INSIDE these modules.
    // settings.lastSession only tracks the word-queue cursor, so without these
    // the 辨析 / 精读 modules restarted at item 1 on every open.
    cloze: { seen: 0, correct: 0, lastItemId: null },
    reading: { seen: 0, correct: 0, done: {}, lastPassageId: null, level: null },
    settings: {
      ...DEFAULT_SETTINGS,
      shuffleSeed: getTodayKey(),
      speech: { ...DEFAULT_SPEECH_SETTINGS },
    },
  };
}

// Multi-step migration: each step bumps the schema by one version. Running
// them in a loop means a v1 payload can be upgraded to vN even if the user
// skipped intermediate releases. Add new steps here when SCHEMA_VERSION
// increments.
function migrateStep(state, fromVersion) {
  if (fromVersion < 2) {
    const words = state.words || {};
    const upgraded = {};
    for (const [id, raw] of Object.entries(words)) {
      if (!isPlainObject(raw)) continue;
      const previousScore = Math.max(0, Number(raw?.score) || 0);
      upgraded[id] = {
        ...progressDefaults(),
        ...raw,
        easiness: raw.easiness ?? 2.5,
        repetitions: raw.repetitions ?? previousScore,
        interval: raw.interval ?? (previousScore ? Math.max(1, previousScore) : 0),
      };
    }
    return { ...state, words: upgraded, schemaVersion: 2 };
  }
  return state;
}

function migrate(stored) {
  if (!stored || typeof stored !== 'object') return defaultStudyState();
  let state = stored;
  let version = Number(state.schemaVersion) || 1;
  while (version < SCHEMA_VERSION) {
    const next = migrateStep(state, version);
    const nextVersion = Number(next.schemaVersion) || version + 1;
    if (nextVersion <= version) {
      // Guard against a buggy step that doesn't bump the version, otherwise
      // we'd loop forever.
      state = next;
      break;
    }
    state = next;
    version = nextVersion;
  }
  return state;
}

// Merge an arbitrary (possibly older) study payload onto the current defaults,
// running the same migration chain a normal load uses. Shared by loadStudyState
// and by importing a backup file, so an exported v1 file upgrades exactly the way
// a v1 localStorage record would.
function hydrate(raw, { strictSettings = false } = {}) {
  const migrated = migrate(raw);
  const fallback = defaultStudyState();
  // The spread below would happily carry a null/!object container through from a
  // corrupt record and crash every consumer, so re-assert the containers the app
  // dereferences unguarded. Belt and braces with parseImportedStudyState's checks:
  // this also covers a localStorage record damaged outside the import path.
  const container = (value, fallbackValue) =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? value : fallbackValue;
  return {
    ...fallback,
    ...migrated,
    words: normalizeRecords(migrated.words, progressDefaults()),
    notes: Object.fromEntries(
      Object.entries(container(migrated.notes, {})).filter(([, note]) => typeof note === 'string'),
    ),
    daily: normalizeRecords(migrated.daily, DAILY_DEFAULTS),
    cloze: normalizeRecord(migrated.cloze, fallback.cloze),
    reading: {
      ...normalizeRecord(migrated.reading, fallback.reading),
      done: container(migrated.reading?.done, {}),
    },
    settings: normalizeSettings(migrated.settings, strictSettings),
  };
}

// Accepts the parsed contents of a backup file and returns a usable study state,
// or throws with a human-readable reason. Deliberately strict about the shape:
// importing overwrites everything, so a wrong file must fail loudly rather than
// silently wipe the learner's progress.
// Validate individual records too: null word entries break migration, and a
// non-string note breaks search only after the backup has overwritten progress.
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseImportedStudyState(parsed) {
  if (isPlainObject(parsed) && (
    (parsed.app !== undefined && parsed.app !== 'shenshuo-english-vocab')
    || (parsed.kind !== undefined && parsed.kind !== 'study-backup')
  )) {
    throw new Error('文件格式不对：不是本应用的学习记录备份');
  }
  const payload = isPlainObject(parsed?.study) ? parsed.study : parsed;
  if (!isPlainObject(payload)) {
    throw new Error('文件格式不对：不是学习记录备份');
  }
  const hasKnownShape =
    payload.words !== undefined || payload.daily !== undefined || payload.settings !== undefined;
  if (!hasKnownShape) {
    throw new Error('文件里没有学习记录（缺少 words / daily / settings）');
  }
  // Every container the app dereferences without its own guard must be checked.
  for (const key of ['words', 'daily', 'notes', 'settings', 'cloze', 'reading']) {
    if (payload[key] !== undefined && !isPlainObject(payload[key])) {
      throw new Error(`文件已损坏：${key} 不是对象`);
    }
  }
  for (const [id, record] of Object.entries(payload.words || {})) {
    validateRecord(record, progressDefaults(), `单词记录 ${id}`);
  }
  for (const [id, note] of Object.entries(payload.notes || {})) {
    if (typeof note !== 'string') throw new Error(`文件已损坏：笔记 ${id} 不是文字`);
  }
  for (const [day, record] of Object.entries(payload.daily || {})) {
    validateRecord(record, DAILY_DEFAULTS, `每日记录 ${day}`);
  }
  const defaults = defaultStudyState();
  for (const key of ['cloze', 'reading']) {
    if (payload[key] !== undefined) validateRecord(payload[key], defaults[key], key);
  }
  if (payload.reading?.done !== undefined && !isPlainObject(payload.reading.done)) {
    throw new Error('文件已损坏：已读篇目不是有效记录');
  }
  return hydrate(payload, { strictSettings: true });
}

export function loadStudyState() {
  if (typeof window === 'undefined') return defaultStudyState();
  let raw = {};
  try {
    raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return defaultStudyState();
  }
  return hydrate(raw);
}

let saveTimer = null;
let pendingState = null;
let listenersAttached = false;

function flushPending() {
  if (!pendingState || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingState));
    pendingState = null;
  } catch (error) {
    console.warn('保存学习进度失败：', error);
  }
}

function attachLifecycleListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('beforeunload', flushPending);
  window.addEventListener('pagehide', flushPending);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
  listenersAttached = true;
}

export function saveStudyState(state, { immediate = false } = {}) {
  pendingState = state;
  attachLifecycleListeners();
  if (saveTimer) clearTimeout(saveTimer);
  if (immediate) {
    flushPending();
  } else {
    saveTimer = setTimeout(flushPending, 400);
  }
}

// Ask the browser to treat our storage as persistent. Progress lives entirely in
// localStorage + IndexedDB, and browsers evict "best-effort" storage under disk
// pressure — iOS Safari also clears it for sites left unopened for ~7 days, which
// would silently wipe every word the learner has studied. Best-effort and safe:
// unsupported browsers just no-op, and it never prompts on its own.
export function requestPersistentStorage() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // ignore — persistence is an optimisation, never a requirement
  }
}

export function normalizeSpeechSettings(settings = {}) {
  const normalized = settingsFields(settings, DEFAULT_SPEECH_SETTINGS, SPEECH_RULES, 'speech', false);
  normalized.rate = Math.min(1.05, Math.max(0.62, normalized.rate));
  return normalized;
}
