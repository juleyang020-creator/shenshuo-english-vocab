import { useMemo, useState } from 'react';
import { ExternalLink, Search, Volume2 } from 'lucide-react';
import { getSpeechText } from '../lib/speech.js';
import { shortDefinition } from '../lib/definition.js';
import { DIFFICULTY_STAGES } from '../lib/frequency.js';

const TABS = [
  ['source', '原书释义'],
  ['pronunciation', '发音'],
  ['spelling', '拼写'],
  ['note', '笔记'],
  ['search', '搜索'],
];

const STAGE_LABEL = Object.fromEntries(DIFFICULTY_STAGES.map((s) => [s.id, s.label]));
const TAG_LABEL = { gaokao: '高考', cet4: '四级', cet6: '六级' };

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = String(text).split(re);
  return (
    <>
      {parts.map((part, index) =>
        re.test(part) ? (
          <mark key={index}>{part}</mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

// Inline tokens from etymonline that benefit from a hover gloss. The English
// etymology text routinely names language families and grammatical terms;
// surfacing a short Chinese hint helps a Chinese-medium learner read the
// paragraph without context-switching to a dictionary.
const ETYMOLOGY_GLOSSES = [
  ['Proto-Indo-European', '原始印欧语 (PIE)，公元前 4500 年左右假定的共同祖语'],
  ['PIE', '原始印欧语 (Proto-Indo-European)'],
  ['Late Latin', '晚期拉丁语 (3-7 世纪)'],
  ['Vulgar Latin', '通俗拉丁语，罗曼语族的直接祖先'],
  ['Medieval Latin', '中古拉丁语 (中世纪学术与教会用语)'],
  ['Latin', '拉丁语'],
  ['Old French', '古法语 (9-14 世纪)'],
  ['Middle French', '中古法语 (14-17 世纪)'],
  ['Anglo-French', '盎格鲁-诺曼法语，诺曼征服后传入英国'],
  ['French', '法语'],
  ['Old English', '古英语，盎格鲁-撒克逊时期 (450-1150)'],
  ['Middle English', '中古英语 (1150-1500)'],
  ['Proto-Germanic', '原始日耳曼语'],
  ['Germanic', '日耳曼语族'],
  ['Old Norse', '古北欧语 (维京时期)'],
  ['Greek', '希腊语'],
  ['Sanskrit', '梵语'],
  ['Arabic', '阿拉伯语'],
  ['Spanish', '西班牙语'],
  ['Italian', '意大利语'],
];

function annotateEtymology(text) {
  if (!text) return null;
  const pattern = new RegExp(
    `\\b(${ETYMOLOGY_GLOSSES
      .map(([key]) => key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'))
      .join('|')})\\b`,
    'g',
  );
  const glossMap = Object.fromEntries(ETYMOLOGY_GLOSSES);
  const out = [];
  let cursor = 0;
  let counter = 0;
  for (const match of text.matchAll(pattern)) {
    const term = match[0];
    const start = match.index;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <span className="ety-gloss" key={`gloss-${counter++}`} title={glossMap[term]}>
        {term}
      </span>,
    );
    cursor = start + term.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function EtymologyPanel({ entry }) {
  const etymology = entry?.etymology;
  const etymologyZh = entry?.etymologyZh;
  const annotatedEn = useMemo(() => annotateEtymology(etymology), [etymology]);
  const annotatedZh = useMemo(() => annotateEtymology(etymologyZh), [etymologyZh]);
  const [showEnglish, setShowEnglish] = useState(false);
  if (!entry) return null;
  if (!etymology) {
    return (
      <div className="etymology etymology--empty">
        <div className="etymology__title">词源</div>
        <p>
          没有{' '}
          <a href="https://www.etymonline.com" target="_blank" rel="noreferrer">
            etymonline.com
          </a>{' '}
          收录的词源信息。日常基础词或较新的拼写可能没有词源条目。
        </p>
      </div>
    );
  }
  const years = entry?.etymologyYears;
  const word = entry?.word
    ? String(entry.word).split('/')[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, '-')
    : '';
  return (
    <div className="etymology">
      <div className="etymology__title">
        <span>词源</span>
        <div className="etymology__title-actions">
          <button
            className={`etymology__toggle ${showEnglish ? 'is-on' : ''}`.trim()}
            type="button"
            onClick={() => setShowEnglish((value) => !value)}
            title={showEnglish ? '隐藏英文原文' : '查看 etymonline 英文原文'}
          >
            {showEnglish ? '收起英文' : 'EN 原文'}
          </button>
          <small>来自 etymonline.com</small>
        </div>
      </div>
      <p className="etymology__text">
        {etymologyZh ? annotatedZh : annotatedEn}
      </p>
      {showEnglish && etymologyZh ? (
        <p className="etymology__text etymology__text--en">{annotatedEn}</p>
      ) : null}
      {years?.length ? (
        <div className="etymology__years">首见年份：{years.join(' / ')}</div>
      ) : null}
      <a
        className="etymology__link"
        href={`https://www.etymonline.com/word/${encodeURIComponent(word)}`}
        target="_blank"
        rel="noreferrer"
      >
        在 etymonline 查看完整词条 <ExternalLink size={12} />
      </a>
    </div>
  );
}

const SEARCH_FILTERS = [
  { id: 'all', label: '全部' },
  ...DIFFICULTY_STAGES.map((stage) => ({ id: stage.id, label: stage.label })),
  { id: 'favorite', label: '⭐ 收藏' },
  { id: 'weak', label: '薄弱' },
];

function LockedPanel({ label }) {
  return (
    <div className="detail-locked">
      <strong>{label}</strong>
      <span>作答或点“提示”后显示，避免提前看到答案</span>
    </div>
  );
}

export function DetailTabs({
  activeTab,
  setActiveTab,
  currentEntry,
  meaningLocked = false,
  spellingLocked = false,
  speechSettings,
  updateSpeechSetting,
  englishVoices,
  activeVoice,
  onPlay,
  noteValue,
  onNoteChange,
  search,
  setSearch,
  searchedEntries,
  searchFilter,
  setSearchFilter,
  searchRegisterFocus,
  onPickSearchResult,
  getWordProgress,
}) {
  return (
    <div className="card detail-card">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            className={activeTab === id ? 'is-active' : ''}
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'source' ? (
        meaningLocked ? (
          <LockedPanel label="原书释义已隐藏" />
        ) : (
          <div className="source-lines">
            {(currentEntry?.definitionLines || []).map((line, index) => (
              <p key={`${currentEntry.id}-source-${index}`}>{line}</p>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'spelling' ? (
        spellingLocked ? (
          <LockedPanel label="拼写答案已隐藏" />
        ) : (
          <div className="letter-grid">
            {(currentEntry?.word || '').split('').map((letter, index) => (
              <span key={`${letter}-${index}`}>{letter}</span>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'pronunciation' ? (
        <div className="pronunciation-pane">
          <div className="voice-preview">
            <div>
              <span>朗读词形</span>
              <strong>{currentEntry ? getSpeechText(currentEntry.word, speechSettings.accent) : '-'}</strong>
              <small>{activeVoice ? `${activeVoice.name} · ${activeVoice.lang}` : '没有读到可用英文语音'}</small>
            </div>
            <button type="button" onClick={onPlay}>
              <Volume2 size={18} /> 试听
            </button>
          </div>

          <div className="pronunciation-controls">
            <label>
              <span>口音</span>
              <div className="segmented-control">
                <button
                  className={speechSettings.accent === 'us' ? 'is-active' : ''}
                  type="button"
                  onClick={() => updateSpeechSetting('accent', 'us')}
                >
                  美音
                </button>
                <button
                  className={speechSettings.accent === 'uk' ? 'is-active' : ''}
                  type="button"
                  onClick={() => updateSpeechSetting('accent', 'uk')}
                >
                  英音
                </button>
              </div>
            </label>
            <label className="voice-select">
              <span>语音</span>
              <select
                value={speechSettings.voiceURI}
                onChange={(event) => updateSpeechSetting('voiceURI', event.target.value)}
              >
                <option value="">自动选择较自然的英文声音</option>
                {englishVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>语速 {Number(speechSettings.rate).toFixed(2)}</span>
              <input
                max="1.05"
                min="0.62"
                step="0.01"
                type="range"
                value={speechSettings.rate}
                onChange={(event) => updateSpeechSetting('rate', Number(event.target.value))}
              />
            </label>
            <label>
              <span>重复</span>
              <select
                value={speechSettings.repeat}
                onChange={(event) => updateSpeechSetting('repeat', Number(event.target.value))}
              >
                <option value={1}>读 1 遍</option>
                <option value={2}>读 2 遍</option>
                <option value={3}>读 3 遍</option>
              </select>
            </label>
            <label className="switch-row">
              <input
                checked={speechSettings.autoSpeak}
                type="checkbox"
                onChange={(event) => updateSpeechSetting('autoSpeak', event.target.checked)}
              />
              <span>切换到新词时自动发音</span>
            </label>
          </div>
        </div>
      ) : null}

      {activeTab === 'note' ? (
        <div className="note-pane">
          {meaningLocked ? (
            <LockedPanel label="词源已隐藏" />
          ) : (
            <EtymologyPanel entry={currentEntry} />
          )}
          <label className="note-pane__label">个人笔记</label>
          <textarea
            className="note-box"
            placeholder="记录易混点、例句、口诀"
            value={noteValue}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>
      ) : null}

      {activeTab === 'search' ? (
        <div className="search-pane">
          <label className="search-field">
            <Search size={19} />
            <input
              placeholder="按单词 / 中文 / 笔记 / 音标 搜索（按 / 快捷键）"
              type="search"
              value={search}
              ref={searchRegisterFocus}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="search-filters">
            {SEARCH_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`search-filter ${searchFilter === filter.id ? 'is-active' : ''}`.trim()}
                onClick={() => setSearchFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="search-summary">
            {search.trim() ? `匹配 ${searchedEntries.length} 个词条` : '请输入关键词'}
          </div>
          <div className="search-results">
            {searchedEntries.slice(0, 40).map((entry) => {
              const progress = getWordProgress ? getWordProgress(entry) : {};
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="search-result"
                  onClick={() => onPickSearchResult(entry)}
                >
                  <div className="search-result__head">
                    <strong>
                      <HighlightedText text={entry.word} query={search.trim()} />
                    </strong>
                    {entry.phonetic ? (
                      <code className="search-result__ipa">/{entry.phonetic}/</code>
                    ) : null}
                    {entry.difficultyStage ? (
                      <span className={`stage-chip stage-chip--${entry.difficultyStage}`}>
                        {STAGE_LABEL[entry.difficultyStage] || '未分级'}
                      </span>
                    ) : null}
                    {(entry.examTags || []).slice(0, 2).map((tag) => (
                      <span className={`exam-chip exam-chip--${tag}`} key={tag}>
                        {TAG_LABEL[tag] || tag}
                      </span>
                    ))}
                    {progress.favorite ? <span className="search-flag">⭐</span> : null}
                  </div>
                  <p className="search-result__def">
                    <HighlightedText
                      text={shortDefinition(entry)}
                      query={search.trim()}
                    />
                  </p>
                </button>
              );
            })}
            {searchedEntries.length > 40 ? (
              <div className="search-more">
                还有 {searchedEntries.length - 40} 条匹配，请输入更具体的关键词。
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
