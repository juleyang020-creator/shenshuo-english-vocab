import { progressDefaults } from './srs.js';
import { getTodayKey } from './streak.js';

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

export function loadStudyState() {
  if (typeof window === 'undefined') return defaultStudyState();
  let raw = {};
  try {
    raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return defaultStudyState();
  }
  const migrated = migrate(raw);
  const fallback = defaultStudyState();
  return {
    ...fallback,
    ...migrated,
    settings: {
      ...fallback.settings,
      ...(migrated.settings || {}),
      shuffleSeed: migrated.settings?.shuffleSeed || getTodayKey(),
      speech: { ...DEFAULT_SPEECH_SETTINGS, ...(migrated.settings?.speech || {}) },
    },
  };
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
  return { ...DEFAULT_SPEECH_SETTINGS, ...(settings || {}) };
}
