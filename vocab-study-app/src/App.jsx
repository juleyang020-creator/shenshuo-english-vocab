import { useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { StudyCard } from './components/StudyCard.jsx';
import { DetailTabs } from './components/DetailTabs.jsx';
import { RightRail } from './components/RightRail.jsx';
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
import { useVocab } from './hooks/useVocab.js';
import { useSpeechVoices } from './hooks/useSpeechVoices.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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
  const { payload, error: loadError } = useVocab();
  const [study, setStudy] = useState(INITIAL_STUDY);
  const [mode, setMode] = useState(INITIAL_LAST_SESSION.mode || 'study');
  // Default to the gaokao stage — the user's baseline is high-school English,
  // so we start with the words they probably saw before and need to relearn.
  const [activeScope, setActiveScope] = useState(
    INITIAL_LAST_SESSION.activeScope || { kind: 'frequency', value: 'gaokao' },
  );
  const [currentIndex, setCurrentIndex] = useState(INITIAL_LAST_SESSION.currentIndex || 0);
  const lastEntryIdRef = useRef(INITIAL_LAST_SESSION.currentEntryId || null);
  const restoredFromLastSessionRef = useRef(false);
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

  const searchTerm = normalizeSearch(search);
  const searchedEntries = useMemo(() => {
    if (!searchTerm) return rangeEntries;
    return entries.filter((entry) => {
      // Match across: word, IPA, compact definition, AND personal notes.
      const word = entry.word.toLowerCase();
      const definition = compactDefinition(entry).toLowerCase();
      const phonetic = (entry.phonetic || '').toLowerCase();
      const note = (study.notes[entry.id] || '').toLowerCase();
      if (
        !word.includes(searchTerm)
        && !definition.includes(searchTerm)
        && !phonetic.includes(searchTerm)
        && !note.includes(searchTerm)
      ) return false;
      if (searchFilter === 'all') return true;
      if (searchFilter === 'favorite') return Boolean(study.words[entry.id]?.favorite);
      if (searchFilter === 'weak') return isWeak(study.words[entry.id] || {});
      // Otherwise treat the filter id as a difficulty stage.
      return entry.difficultyStage === searchFilter;
    });
  }, [entries, rangeEntries, searchTerm, searchFilter, study]);

  const lockedChoiceEntryId = choiceResult?.entryId || '';
  const queue = useMemo(() => {
    const now = Date.now();
    if (mode === 'browse') {
      const browsePool = searchTerm ? searchedEntries : entries;
      return browsePool.filter((entry) => {
        const progress = getWordProgress(study, entry);
        return searchTerm || progress.favorite || isWeak(progress) || progress.attempts;
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
    entries,
    learnerEntries,
    lockedChoiceEntryId,
    mode,
    rangeEntries,
    reviewableRangeEntries,
    searchTerm,
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
    setCurrentIndex(0);
    setShowMeaning(mode === 'review' || mode === 'browse');
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scopeIntentKey, searchTerm, shuffleSeed]);

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
  useEffect(() => {
    setStudy((previous) => {
      const next = {
        mode,
        activeScope,
        currentIndex,
        currentEntryId: currentEntry?.id || null,
      };
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
  }, [mode, activeScope, currentIndex, currentEntry?.id]);

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
    setStudy((previous) => ({
      ...fresh,
      // Preserve audio + target preferences so the user doesn't have to redo
      // their settings.
      settings: {
        ...fresh.settings,
        dailyTarget: previous.settings?.dailyTarget || fresh.settings.dailyTarget,
        speech: previous.settings?.speech || fresh.settings.speech,
      },
    }));
    setMode('study');
    setActiveScope({ kind: 'frequency', value: 'gaokao' });
    setCurrentIndex(0);
    setShowMeaning(true);
    setQuizChoice(null);
    setChoiceResult(null);
    setSpellingInput('');
    setSpellingFeedback(null);
    lastEntryIdRef.current = null;
    saveStudyState(fresh, { immediate: true });
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
  });

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
        getStatsForEntries={(items) => getLearningStats(items, study)}
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
                setMode('browse');
                const index = searchedEntries.findIndex((item) => item.id === entry.id);
                setCurrentIndex(Math.max(index, 0));
              }}
            />
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
