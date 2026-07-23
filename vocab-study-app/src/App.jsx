import { useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { StudyCard } from './components/StudyCard.jsx';
import { DetailTabs } from './components/DetailTabs.jsx';
import { RightRail } from './components/RightRail.jsx';
import { ClozeMode } from './components/ClozeMode.jsx';
import { ReadingMode } from './components/ReadingMode.jsx';
import {
  defaultStudyState,
  loadStudyState,
  saveStudyState,
  normalizeSpeechSettings,
} from './lib/storage.js';
import { applyReview, hasStartedLearning, isDue, isKnown, isWeak, progressDefaults } from './lib/srs.js';
import { computeCurrentStreak, computeLongestStreak, getTodayKey } from './lib/streak.js';
import { compactDefinition, hasUsableChineseDefinition, shortDefinition } from './lib/definition.js';
import { FREQUENCY_BUCKETS, WORD_TYPE_BUCKETS, getExamFrequencyId, getWordTypeIds } from './lib/frequency.js';
import { makeRanges, STAGE_CHUNK_SIZE } from './lib/scope.js';
import { shuffle, stableShuffle } from './lib/shuffle.js';
import { chooseEnglishVoice, getEnglishVoices, speakWord } from './lib/speech.js';
import { diffSpelling } from './lib/spelling.js';
import { buildGlossary } from './lib/glossary.js';
import { clamp } from './lib/math.js';
import { useVocab } from './hooks/useVocab.js';
import { useCloze } from './hooks/useCloze.js';
import { useReading } from './hooks/useReading.js';
import { useSpeechVoices } from './hooks/useSpeechVoices.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

function normalizeSearch(value) {
  return value.trim().toLowerCase();
}

function getWordProgress(study, entry) {
  return study.words[entry?.id] || {};
}

function getLearningStats(items, study) {
  let learned = 0;
  let known = 0;
  for (const entry of items) {
    const progress = getWordProgress(study, entry);
    if (hasStartedLearning(progress)) learned += 1;
    if (isKnown(progress)) known += 1;
  }
  return { learned, known, total: items.length };
}

const INITIAL_STUDY = loadStudyState();
const INITIAL_LAST_SESSION = INITIAL_STUDY.settings?.lastSession || {};

export default function App() {
  const { payload, error: loadError, loading } = useVocab();
  const [study, setStudy] = useState(INITIAL_STUDY);
  const [mode, setMode] = useState(INITIAL_LAST_SESSION.mode || 'study');
  const { items: clozeItems, error: clozeError, loading: clozeLoading } = useCloze({ enabled: mode === 'cloze' });
  const { items: readingItems, error: readingError, loading: readingLoading } = useReading({ enabled: mode === 'reading' });
  // Default to the gaokao stage — the user's baseline is high-school English,
  // so we start with the words they probably saw before and need to relearn.
  const [activeScope, setActiveScope] = useState(
    INITIAL_LAST_SESSION.activeScope || { kind: 'frequency', value: 'gaokao' },
  );
  const [currentIndex, setCurrentIndex] = useState(INITIAL_LAST_SESSION.currentIndex || 0);
  const lastEntryIdRef = useRef(INITIAL_LAST_SESSION.currentEntryId || null);
  const restoredFromLastSessionRef = useRef(false);
  // Armed right before a search-result pick flips mode to 'browse', so the
  // scope/mode reset effect skips zeroing the cursor that one time and the picked
  // word stays selected. Only armed when the pick actually changes mode (see
  // onPickSearchResult) — otherwise the flag would dangle and swallow a later reset.
  const skipNextResetRef = useRef(false);
  // Meaning starts hidden in the testing modes (study/quiz/spelling) so the
  // answer isn't visible the moment the app opens — only revealed after the
  // learner responds or taps 提示. The reset effect skips the very first mount
  // (it restores the saved position instead), so this initial value matters.
  const [showMeaning, setShowMeaning] = useState(
    INITIAL_LAST_SESSION.mode === 'review' || INITIAL_LAST_SESSION.mode === 'browse',
  );
  const [activeTab, setActiveTab] = useState('source');
  const [search, setSearch] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const searchInputRef = useRef(null);
  const [quizChoice, setQuizChoice] = useState(null);
  const [choiceResult, setChoiceResult] = useState(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [spellingFeedback, setSpellingFeedback] = useState(null);
  const speechVoices = useSpeechVoices();

  useEffect(() => {
    saveStudyState(study);
  }, [study]);

  const entries = payload.entries || [];
  const todayKey = getTodayKey();

  // The old build aggressively filtered out a 672-word "basic" set. For a
  // learner at gaokao-76 baseline those words are exactly what needs the most
  // drilling, so we keep every entry and let the stage scopes (gaokao /
  // cet4 / cet6 / master / advanced) carry the difficulty signal instead.
  const learnerEntries = entries;
  const shuffleSeed = study.settings.shuffleSeed || todayKey;
  const ranges = useMemo(() => makeRanges(learnerEntries), [learnerEntries]);

  // Glossary (word -> Chinese) is built once from the vocab; the known-word set
  // recomputes as the learner marks words known, so example-sentence markings
  // shrink over time.
  const glossary = useMemo(() => buildGlossary(entries), [entries]);
  const knownWords = useMemo(() => {
    const set = new Set();
    for (const entry of entries) {
      if (isKnown(study.words[entry.id])) set.add((entry.word || '').toLowerCase());
    }
    return set;
  }, [entries, study.words]);

  const frequencyScopes = useMemo(
    () =>
      FREQUENCY_BUCKETS.map((bucket) => ({
        ...bucket,
        entries: learnerEntries.filter((entry) => getExamFrequencyId(entry) === bucket.id),
      })),
    [learnerEntries],
  );

  const typeScopes = useMemo(
    () =>
      WORD_TYPE_BUCKETS.map((bucket) => ({
        ...bucket,
        entries: learnerEntries.filter((entry) => getWordTypeIds(entry).includes(bucket.id)),
      })),
    [learnerEntries],
  );

  // Pre-compute per-scope learning stats so Sidebar doesn't re-iterate every
  // entry on each render. Previously getStatsForEntries(scope.entries) was
  // called inline in Sidebar for all ~21 scopes — each call walking hundreds
  // of entries — every time study changed.
  const frequencyScopeStats = useMemo(
    () => frequencyScopes.map((scope) => getLearningStats(scope.entries, study)),
    [frequencyScopes, study],
  );
  const typeScopeStats = useMemo(
    () => typeScopes.map((scope) => getLearningStats(scope.entries, study)),
    [typeScopes, study],
  );

  const rangeStats = useMemo(
    () =>
      ranges.map((range) => getLearningStats(learnerEntries.slice(range.start, range.end), study)),
    [ranges, learnerEntries, study],
  );

  const activeScopeMeta = useMemo(() => {
    if (activeScope.kind === 'frequency') {
      const scope = frequencyScopes.find((item) => item.id === activeScope.value) || frequencyScopes[0];
      return { ...scope, key: `frequency:${scope?.id || 'high'}` };
    }
    if (activeScope.kind === 'stage-chunk') {
      const [stageId, chunkRaw] = String(activeScope.value).split(':');
      const stage = frequencyScopes.find((item) => item.id === stageId) || frequencyScopes[0];
      const stageEntries = stage?.entries || [];
      const chunkIndex = clamp(Number(chunkRaw) || 0, 0, Math.max(0, Math.ceil(stageEntries.length / STAGE_CHUNK_SIZE) - 1));
      const start = chunkIndex * STAGE_CHUNK_SIZE;
      const end = Math.min(stageEntries.length, start + STAGE_CHUNK_SIZE);
      const chunkEntries = stageEntries.slice(start, end);
      return {
        ...stage,
        label: `${stage?.label || '阶段'} · 第 ${chunkIndex + 1} 段`,
        detail: `${start + 1}-${end} / ${stageEntries.length}`,
        entries: chunkEntries,
        key: `stage-chunk:${stageId}:${chunkIndex}`,
      };
    }
    if (activeScope.kind === 'type') {
      const scope = typeScopes.find((item) => item.id === activeScope.value) || typeScopes[0];
      return { ...scope, key: `type:${scope?.id || 'verb'}` };
    }
    const safeIndex = clamp(Number(activeScope.value) || 0, 0, Math.max(ranges.length - 1, 0));
    const range = ranges[safeIndex] || ranges[0] || {
      start: 0,
      end: learnerEntries.length,
      label: '全部词',
      index: 0,
    };
    return {
      ...range,
      id: `${range.index}`,
      detail: '顺序分段',
      entries: learnerEntries.slice(range.start, range.end),
      key: `range:${range.index || 0}`,
    };
  }, [activeScope, frequencyScopes, learnerEntries, ranges, typeScopes]);

  const rangeEntries = activeScopeMeta?.entries || [];
  const reviewableEntries = useMemo(
    () => learnerEntries.filter((entry) => hasStartedLearning(getWordProgress(study, entry))),
    [learnerEntries, study],
  );
  const reviewableRangeEntries = useMemo(
    () => rangeEntries.filter((entry) => hasStartedLearning(getWordProgress(study, entry))),
    [rangeEntries, study],
  );

  // Debounce the search term so fast typing doesn't trigger a 5390-entry ×
  // 20-regex scan on every keystroke. compactDefinition is now cached, but
  // the filter pass + string comparisons still add up on slower devices.
  const searchTerm = normalizeSearch(search);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  useEffect(() => {
    if (!searchTerm) {
      setDebouncedSearchTerm('');
      return;
    }
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchedEntries = useMemo(() => {
    if (!debouncedSearchTerm) return rangeEntries;
    return entries.filter((entry) => {
      // Match across: word, IPA, compact definition, AND personal notes.
      const word = entry.word.toLowerCase();
      const definition = compactDefinition(entry).toLowerCase();
      const phonetic = (entry.phonetic || '').toLowerCase();
      const note = (study.notes[entry.id] || '').toLowerCase();
      if (
        !word.includes(debouncedSearchTerm)
        && !definition.includes(debouncedSearchTerm)
        && !phonetic.includes(debouncedSearchTerm)
        && !note.includes(debouncedSearchTerm)
      ) return false;
      if (searchFilter === 'all') return true;
      if (searchFilter === 'favorite') return Boolean(study.words[entry.id]?.favorite);
      if (searchFilter === 'weak') return isWeak(study.words[entry.id] || {});
      // Otherwise treat the filter id as a difficulty stage.
      return entry.difficultyStage === searchFilter;
    });
  }, [entries, rangeEntries, debouncedSearchTerm, searchFilter, study]);

  const lockedChoiceEntryId = choiceResult?.entryId || '';
  const queue = useMemo(() => {
    const now = Date.now();
    if (mode === 'browse') {
      const browsePool = debouncedSearchTerm ? searchedEntries : entries;
      return browsePool.filter((entry) => {
        const progress = getWordProgress(study, entry);
        return debouncedSearchTerm || progress.favorite || isWeak(progress) || progress.attempts;
      });
    }
    if (mode === 'review') {
      const due = reviewableRangeEntries.filter((entry) => {
        const progress = getWordProgress(study, entry);
        return isDue(progress, now) || isWeak(progress);
      });
      return due.length
        ? stableShuffle(due, `${shuffleSeed}:review-due:${activeScopeMeta.key}`)
        : stableShuffle(reviewableRangeEntries, `${shuffleSeed}:review:${activeScopeMeta.key}`);
    }
    if (mode === 'quiz' || mode === 'spelling') {
      return stableShuffle(
        rangeEntries.length ? rangeEntries : learnerEntries,
        `${shuffleSeed}:${mode}:${activeScopeMeta.key}`,
      );
    }
    return stableShuffle(
      rangeEntries.filter(
        (entry) => !isKnown(getWordProgress(study, entry)) || entry.id === lockedChoiceEntryId,
      ),
      `${shuffleSeed}:study:${activeScopeMeta.key}`,
    );
  }, [
    activeScopeMeta.key,
    debouncedSearchTerm,
    entries,
    learnerEntries,
    lockedChoiceEntryId,
    mode,
    rangeEntries,
    reviewableRangeEntries,
    searchedEntries,
    shuffleSeed,
    study,
  ]);

  const currentEntry = queue.length ? queue[clamp(currentIndex, 0, queue.length - 1)] : null;
  const currentProgress = getWordProgress(study, currentEntry);
  const isChoiceMode = mode === 'study' || mode === 'quiz';
  const answeredChoice = isChoiceMode && choiceResult?.entryId === currentEntry?.id;

  const todayStats = study.daily[todayKey] || { seen: 0, known: 0, weak: 0, quiz: 0 };
  const dailyTarget = study.settings.dailyTarget || 120;
  const speechSettings = normalizeSpeechSettings(study.settings.speech);
  const englishVoices = useMemo(() => getEnglishVoices(speechVoices), [speechVoices]);
  const activeVoice = chooseEnglishVoice(speechVoices, speechSettings.accent, speechSettings.voiceURI);

  const allKnown = useMemo(
    () => learnerEntries.filter((entry) => isKnown(getWordProgress(study, entry))).length,
    [learnerEntries, study],
  );
  const activeStats = getLearningStats(rangeEntries, study);
  const usableOptionEntries = useMemo(
    () => learnerEntries.filter(hasUsableChineseDefinition),
    [learnerEntries],
  );
  const weakEntries = useMemo(
    () =>
      learnerEntries
        .filter((entry) => isWeak(getWordProgress(study, entry)))
        .sort(
          (left, right) =>
            (getWordProgress(study, right).wrong || 0) -
            (getWordProgress(study, left).wrong || 0),
        ),
    [learnerEntries, study],
  );
  const dueEntries = useMemo(
    () => reviewableEntries.filter((entry) => isDue(getWordProgress(study, entry))),
    [reviewableEntries, study],
  );
  const progressValue = dailyTarget ? (todayStats.seen / dailyTarget) * 100 : 0;
  const streak = useMemo(
    () => computeCurrentStreak(study.daily, todayKey),
    [study.daily, todayKey],
  );
  const longestStreak = useMemo(() => computeLongestStreak(study.daily), [study.daily]);

  const quizOptions = useMemo(() => {
    if (!currentEntry || learnerEntries.length < 4 || !isChoiceMode) return [];
    const distractorPool = usableOptionEntries.filter((entry) => entry.id !== currentEntry.id);
    const wrongOptions = shuffle(distractorPool).slice(0, 3);
    return shuffle([currentEntry, ...wrongOptions]).map((entry) => ({
      id: entry.id,
      word: entry.word,
      definition: shortDefinition(entry),
    }));
  }, [currentEntry, isChoiceMode, learnerEntries.length, usableOptionEntries]);

  // A stable "user intent" key for the current scope. We deliberately don't
  // use activeScopeMeta.key here because that one can shift on initial render
  // (chunk indices get clamped to 0 while vocab is still loading), which would
  // otherwise tear down the just-restored session position.
  const scopeIntentKey = `${activeScope.kind}:${activeScope.value}`;

  // Reset cursor on user-driven scope/mode changes. The very first render is
  // skipped so that the persisted currentIndex / lastEntryId survive a reload.
  useEffect(() => {
    if (!restoredFromLastSessionRef.current) return;
    // A search-result pick sets its own cursor and flips to browse; honour that
    // one jump instead of zeroing over it.
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    setCurrentIndex(0);
    setShowMeaning(mode === 'review' || mode === 'browse');
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scopeIntentKey, debouncedSearchTerm, shuffleSeed]);

  // Once the queue is populated for the first time, jump to the last-studied
  // entry (if it still exists in that queue). Runs at most once.
  useEffect(() => {
    if (restoredFromLastSessionRef.current) return;
    if (!queue.length) return;
    restoredFromLastSessionRef.current = true;
    const targetId = lastEntryIdRef.current;
    if (!targetId) return;
    const idx = queue.findIndex((entry) => entry.id === targetId);
    if (idx >= 0) setCurrentIndex(idx);
  }, [queue]);

  useEffect(() => {
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
  }, [currentEntry?.id]);

  // Persist last session — mode, scope, position — so reopening the app
  // resumes where the user left off instead of dropping back to word #1.
  // Debounced (1.2s) so rapid word navigation doesn't trigger a study state
  // update on every keystroke. The ref captures the latest intent so the
  // flush always writes the most recent position even if the user keeps
  // navigating within the debounce window.
  const lastSessionIntentRef = useRef(null);
  lastSessionIntentRef.current = {
    mode,
    activeScope,
    currentIndex,
    currentEntryId: currentEntry?.id || null,
  };
  // Mirror the latest study into a ref so the page-close flush can persist the
  // most recent state synchronously without routing through setStudy (a state
  // update during unload never commits, so its follow-up save would be lost).
  const studyRef = useRef(study);
  studyRef.current = study;
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = lastSessionIntentRef.current;
      if (!next) return;
      setStudy((previous) => {
        const prev = previous.settings?.lastSession || {};
        if (
          prev.mode === next.mode
          && prev.currentIndex === next.currentIndex
          && prev.currentEntryId === next.currentEntryId
          && prev.activeScope?.kind === next.activeScope.kind
          && prev.activeScope?.value === next.activeScope.value
        ) {
          return previous;
        }
        return {
          ...previous,
          settings: { ...previous.settings, lastSession: next },
        };
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [mode, activeScope, currentIndex, currentEntry?.id]);

  // Also flush lastSession when the page is being closed so the final
  // position is saved even if the user closes within the debounce window.
  useEffect(() => {
    // Persist synchronously via saveStudyState (not setStudy): during page
    // teardown a state update never commits, so the debounced [study] save that
    // would follow it never runs and the final position is lost. Writing the
    // merged state straight to storage side-steps React entirely.
    function persistLastSession() {
      const next = lastSessionIntentRef.current;
      if (!next) return;
      const current = studyRef.current;
      const prev = current.settings?.lastSession || {};
      if (
        prev.mode === next.mode
        && prev.currentIndex === next.currentIndex
        && prev.currentEntryId === next.currentEntryId
        && prev.activeScope?.kind === next.activeScope.kind
        && prev.activeScope?.value === next.activeScope.value
      ) {
        return;
      }
      saveStudyState(
        { ...current, settings: { ...current.settings, lastSession: next } },
        { immediate: true },
      );
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') persistLastSession();
    }
    window.addEventListener('beforeunload', persistLastSession);
    window.addEventListener('pagehide', persistLastSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', persistLastSession);
      window.removeEventListener('pagehide', persistLastSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!currentEntry) return;
    // Spelling mode is essentially dictation, so we force auto-play there
    // regardless of the user's general autoSpeak preference.
    const shouldAutoPlay = speechSettings.autoSpeak || mode === 'spelling';
    if (!shouldAutoPlay) return;
    speakWord(currentEntry.word, speechSettings, speechVoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentEntry?.id,
    mode,
    speechSettings.autoSpeak,
    speechSettings.accent,
    speechSettings.rate,
    speechSettings.repeat,
  ]);

  function updateWord(entry, updater) {
    if (!entry) return;
    setStudy((previous) => {
      const previousWord = previous.words[entry.id] || {};
      const nextWord = updater(previousWord);
      return {
        ...previous,
        words: { ...previous.words, [entry.id]: nextWord },
      };
    });
  }

  function recordCloze(correct) {
    setStudy((previous) => {
      const current = previous.daily[todayKey] || { seen: 0, known: 0, weak: 0, quiz: 0 };
      const cloze = previous.cloze || { seen: 0, correct: 0 };
      return {
        ...previous,
        cloze: { seen: cloze.seen + 1, correct: cloze.correct + (correct ? 1 : 0) },
        daily: {
          ...previous.daily,
          [todayKey]: { ...current, cloze: (current.cloze || 0) + 1 },
        },
      };
    });
  }

  function recordReading(correct) {
    setStudy((previous) => {
      const current = previous.daily[todayKey] || { seen: 0, known: 0, weak: 0, quiz: 0 };
      const reading = previous.reading || { seen: 0, correct: 0 };
      return {
        ...previous,
        reading: { seen: reading.seen + 1, correct: reading.correct + (correct ? 1 : 0) },
        daily: {
          ...previous.daily,
          [todayKey]: { ...current, reading: (current.reading || 0) + 1 },
        },
      };
    });
  }

  function recordReadingComplete(passage, correctCount) {
    if (!passage) return;
    setStudy((previous) => {
      const reading = previous.reading || { seen: 0, correct: 0, done: {} };
      return {
        ...previous,
        reading: {
          ...reading,
          done: {
            ...(reading.done || {}),
            [passage.id]: {
              level: passage.level,
              correct: correctCount,
              total: (passage.questions || []).length,
            },
          },
        },
      };
    });
  }

  function updateDaily(result) {
    setStudy((previous) => {
      const current = previous.daily[todayKey] || { seen: 0, known: 0, weak: 0, quiz: 0 };
      return {
        ...previous,
        daily: {
          ...previous.daily,
          [todayKey]: {
            ...current,
            seen: current.seen + 1,
            known: current.known + (result === 'know' || result === 'correct' ? 1 : 0),
            weak: current.weak + (result === 'forgot' || result === 'wrong' ? 1 : 0),
            quiz: current.quiz + (mode === 'quiz' ? 1 : 0),
          },
        },
      };
    });
  }

  function goNext() {
    setShowMeaning(mode === 'review' || mode === 'browse');
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
    setCurrentIndex((index) => (queue.length ? (index + 1) % queue.length : 0));
  }

  function goPrevious() {
    setShowMeaning(mode === 'review' || mode === 'browse');
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
    setCurrentIndex((index) => (queue.length ? (index - 1 + queue.length) % queue.length : 0));
  }

  function markEntry(result, options = {}) {
    if (!currentEntry) return;
    const { advance = true } = options;
    updateWord(currentEntry, (word) => applyReview(word, result));
    updateDaily(result);
    if (advance) goNext();
  }

  function toggleFavorite(entry = currentEntry) {
    if (!entry) return;
    updateWord(entry, (word) => ({
      ...progressDefaults(),
      ...word,
      favorite: !word.favorite,
    }));
  }

  function updateNote(value) {
    if (!currentEntry) return;
    setStudy((previous) => ({
      ...previous,
      notes: { ...previous.notes, [currentEntry.id]: value },
    }));
  }

  function setDailyTarget(value) {
    setStudy((previous) => ({
      ...previous,
      settings: { ...previous.settings, dailyTarget: clamp(Number(value) || 1, 20, 500) },
    }));
  }

  function updateSpeechSetting(key, value) {
    setStudy((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        speech: { ...normalizeSpeechSettings(previous.settings?.speech), [key]: value },
      },
    }));
  }

  function reshuffleQueue() {
    setStudy((previous) => ({
      ...previous,
      settings: { ...previous.settings, shuffleSeed: `${Date.now()}` },
    }));
  }

  function resetAllProgress() {
    const confirmed = window.confirm(
      '确认清除所有学习进度？\n\n会清空：单词记忆、薄弱词、每日记录、笔记、收藏\n会保留：发音偏好、每日目标'
    );
    if (!confirmed) return;
    const fresh = defaultStudyState();
    // Preserve audio + target preferences so the user doesn't have to redo their
    // settings. Build the preserved state once and use it for BOTH the in-memory
    // update and the immediate save, so the synchronous write isn't a settings-
    // less `fresh` that a later debounced save then has to correct.
    const preserved = {
      ...fresh,
      settings: {
        ...fresh.settings,
        dailyTarget: study.settings?.dailyTarget || fresh.settings.dailyTarget,
        speech: study.settings?.speech || fresh.settings.speech,
      },
    };
    setStudy(preserved);
    setMode('study');
    setActiveScope({ kind: 'frequency', value: 'gaokao' });
    setCurrentIndex(0);
    setShowMeaning(true);
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
    lastEntryIdRef.current = null;
    saveStudyState(preserved, { immediate: true });
  }

  function handleChoice(option) {
    if (!currentEntry || answeredChoice) return;
    const correct = option.id === currentEntry.id;
    setQuizChoice(option.id);
    setChoiceResult({ entryId: currentEntry.id, selectedId: option.id, correct });
    setShowMeaning(true);
    markEntry(correct ? 'correct' : 'wrong', { advance: false });
  }

  function playCurrentWord() {
    speakWord(currentEntry?.word, speechSettings, speechVoices);
  }

  function handleSpellingSubmit(event) {
    event.preventDefault();
    if (!currentEntry || spellingFeedback) return;
    const feedback = diffSpelling(currentEntry.word, spellingInput);
    setSpellingFeedback(feedback);
    setShowMeaning(true);
    markEntry(feedback.correct ? 'correct' : 'wrong', { advance: false });
  }

  const choicePickEnabled = isChoiceMode && !answeredChoice && quizOptions.length > 0;
  const decisionEnabled = !isChoiceMode && mode !== 'spelling' && Boolean(currentEntry);
  useKeyboardShortcuts({
    ArrowLeft: () => goPrevious(),
    ArrowRight: () => {
      if (isChoiceMode && !answeredChoice) return;
      goNext();
    },
    ' ': () => setShowMeaning((value) => !value),
    p: () => playCurrentWord(),
    s: () => toggleFavorite(),
    '1': () => {
      if (choicePickEnabled && quizOptions[0]) handleChoice(quizOptions[0]);
      else if (decisionEnabled) markEntry('know');
    },
    '2': () => {
      if (choicePickEnabled && quizOptions[1]) handleChoice(quizOptions[1]);
      else if (decisionEnabled) markEntry('unsure');
    },
    '3': () => {
      if (choicePickEnabled && quizOptions[2]) handleChoice(quizOptions[2]);
      else if (decisionEnabled) markEntry('forgot');
    },
    '4': () => {
      if (choicePickEnabled && quizOptions[3]) handleChoice(quizOptions[3]);
    },
    k: () => {
      if (decisionEnabled) markEntry('know');
    },
    u: () => {
      if (decisionEnabled) markEntry('unsure');
    },
    f: () => {
      if (decisionEnabled) markEntry('forgot');
    },
    '/': () => {
      setActiveTab('search');
      requestAnimationFrame(() => searchInputRef.current?.focus());
    },
    // The cloze module owns its own keyboard handlers (1-4 / arrows); the reading
    // module has no keyboard controls, so disable these global keys there too —
    // otherwise a stray 1/2/3/K/U/F/S/arrow press would silently grade or move a
    // word in the hidden study queue behind the passage.
  }, { enabled: mode !== 'cloze' && mode !== 'reading' });

  return (
    <div className="app-shell">
      <Sidebar
        mode={mode}
        setMode={setMode}
        ranges={ranges}
        activeScope={activeScope}
        setActiveScope={setActiveScope}
        rangeStats={rangeStats}
        frequencyScopes={frequencyScopes}
        typeScopes={typeScopes}
        frequencyScopeStats={frequencyScopeStats}
        typeScopeStats={typeScopeStats}
      />

      <main className="workspace">
        <Topbar
          todayStats={todayStats}
          dailyTarget={dailyTarget}
          setDailyTarget={setDailyTarget}
          allKnown={allKnown}
          totalEntries={learnerEntries.length}
          progressValue={progressValue}
          streak={streak}
          longestStreak={longestStreak}
          reshuffleQueue={reshuffleQueue}
          openPronunciation={() => setActiveTab('pronunciation')}
          openReview={() => setMode('review')}
        />

        <div className="content-grid">
          <section className="study-area">
            {loadError ? <div className="notice">{loadError}</div> : null}
            {loading && !loadError && entries.length === 0 ? (
              <div className="notice">词库加载中，请稍候…</div>
            ) : null}

            {mode === 'reading' ? (
              <ReadingMode
                items={readingItems}
                loading={readingLoading}
                error={readingError}
                shuffleSeed={shuffleSeed}
                stats={study.reading}
                onAnswer={recordReading}
                onComplete={recordReadingComplete}
                glossary={glossary}
                knownWords={knownWords}
              />
            ) : mode === 'cloze' ? (
              <ClozeMode
                items={clozeItems}
                loading={clozeLoading}
                error={clozeError}
                shuffleSeed={shuffleSeed}
                stats={study.cloze}
                onAnswer={recordCloze}
                glossary={glossary}
                knownWords={knownWords}
              />
            ) : (
            <>
            <StudyCard
              mode={mode}
              activeScopeMeta={activeScopeMeta}
              currentEntry={currentEntry}
              currentProgress={currentProgress}
              queue={queue}
              currentIndex={currentIndex}
              isChoiceMode={isChoiceMode}
              answeredChoice={answeredChoice}
              quizOptions={quizOptions}
              quizChoice={quizChoice}
              choiceResult={choiceResult}
              showMeaning={showMeaning}
              spellingInput={spellingInput}
              spellingFeedback={spellingFeedback}
              onSpellingInput={setSpellingInput}
              onSpellingSubmit={handleSpellingSubmit}
              onPlay={playCurrentWord}
              onToggleFavorite={() => toggleFavorite()}
              onChoice={handleChoice}
              onMark={markEntry}
              onToggleMeaning={() => setShowMeaning((value) => !value)}
              onPrevious={goPrevious}
              onNext={goNext}
              entriesCount={entries.length}
            />

            <DetailTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              currentEntry={currentEntry}
              // Hide answer-revealing panels until the learner has answered (or
              // tapped 提示). In a choice question the Chinese meaning is the
              // answer; in spelling the letter grid is the answer.
              meaningLocked={isChoiceMode && !answeredChoice && !showMeaning}
              spellingLocked={mode === 'spelling' && !spellingFeedback}
              speechSettings={speechSettings}
              updateSpeechSetting={updateSpeechSetting}
              englishVoices={englishVoices}
              activeVoice={activeVoice}
              onPlay={playCurrentWord}
              noteValue={currentEntry ? study.notes[currentEntry.id] || '' : ''}
              onNoteChange={updateNote}
              search={search}
              setSearch={setSearch}
              searchedEntries={searchedEntries}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              searchRegisterFocus={searchInputRef}
              getWordProgress={(entry) => getWordProgress(study, entry)}
              onPickSearchResult={(entry) => {
                const index = Math.max(
                  searchedEntries.findIndex((item) => item.id === entry.id),
                  0,
                );
                // Only arm the reset-skip when this pick actually changes mode;
                // if we're already in browse, setMode is a no-op so the reset
                // effect never fires and an armed flag would dangle.
                if (mode !== 'browse') {
                  skipNextResetRef.current = true;
                  setShowMeaning(true);
                }
                setMode('browse');
                setCurrentIndex(index);
              }}
            />
            </>
            )}
          </section>

          <RightRail
            dailyTarget={dailyTarget}
            todayStats={todayStats}
            weakEntries={weakEntries}
            dueEntries={dueEntries}
            learnerEntriesCount={learnerEntries.length}
            activeStats={activeStats}
            stageCounts={payload.meta?.stageCounts || {}}
            payload={payload}
            study={study}
            activeScope={activeScope}
            setMode={setMode}
            setActiveScope={setActiveScope}
            getWordProgress={(entry) => getWordProgress(study, entry)}
            resetAllProgress={resetAllProgress}
          />
        </div>
      </main>
    </div>
  );
}
